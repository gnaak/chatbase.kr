import json
from dataclasses import dataclass
from datetime import timedelta
from types import SimpleNamespace

from app.core.config.settings import settings
from typing import AsyncGenerator

from app.core.database.base import SessionLocal, now_kst
from app.core.logging import get_logger
from app.core.utils.response import fail, success
from app.module.api_key.api_key import Provider
from app.module.api_key.api_key_repository import ApiKeyRepository
from app.module.api_key.api_key_service import (
    SERVICE_MODEL,
    ApiKeyService,
    prefers_service_key,
    service_llm_key,
)
from app.module.bot.bot_repository import BotRepository
from app.module.chat.chat_message import ChatMessage, MessageRole
from app.module.chat.chat_repository import ChatRepository
from app.module.chat.chat_session import ChatSession
from app.module.infra.llm.llm_service import (
    LLMService,
    classify_llm_error,
    resolve_provider,
    strip_citations,
)
from app.module.llm_error.llm_error import LlmErrorChannel, LlmErrorKind
from app.module.llm_error.llm_error_repository import LlmErrorRepository
from app.module.payment.plan_lookup import limits_of
from app.module.usage.usage_service import (
    usage_service_for,
    visitor_unavailable_message,
)

logger = get_logger(__name__)


#: 주인이 fallback 을 안 썼을 때 우리 키 경로에서 대신 쓰는 문구.
#:
#: 이 값이 채워지면 `_should_enable_web_search` 가 False 가 되어 **web search 도
#: 같이 꺼진다.** 그게 의도다 — 우리 키 경로는 학습 자료 안에서만 답하게 두어야
#: 원가가 예측 가능하고, 지어내지도 않는다.
#:
#: 다국어 봇에서는 LLM 이 방문자 언어로 옮겨준다(`_build_system_prompt` 언어 규칙).
DEFAULT_FALLBACK = "죄송합니다. 관련된 내용을 찾을 수 없었어요."


def _uses_file_learning(bot) -> bool:
    """파일 학습을 쓰는 봇인가."""
    training_type = getattr(bot, "training_type", None) or "text"
    return training_type == "file" or bool(getattr(bot, "vector_store_id", None))


def _service_prompt_view(bot):
    """우리 키로 답할 때 **프롬프트 조립에만** 쓰는 봇 뷰.

    원본 `bot` 을 건드리지 않는다. DB 객체 필드를 바꾸면 같은 요청의 커밋에
    딸려 들어가서, 주인이 쓰지도 않은 fallback 이 저장된다.

    `vector_store_id` 를 None 으로 막는 이유: 벡터스토어는 **만든 계정에 귀속**된다.
    주인 키로 만든 `vs_...` 를 우리 키로 호출하면 그 계정에 없는 ID라 404다.
    """
    return SimpleNamespace(
        system_prompt=bot.system_prompt,
        training_text=bot.training_text,
        training_type=getattr(bot, "training_type", None) or "text",
        fallback=(bot.fallback or "").strip() or DEFAULT_FALLBACK,
        multilingual=getattr(bot, "multilingual", False),
        vector_store_id=None,
    )


def _preview_no_route_message(bot) -> str:
    """미리보기에서 호출할 경로가 없을 때 **주인에게** 보여줄 문구.

    방문자 경로(`visitor_unavailable_message`)와 달리 원인을 그대로 말한다 —
    여기는 고칠 사람이 보고 있는 화면이다. 중립 문구로 뭉개면 왜 안 되는지
    모른 채 봇 설정만 계속 만지게 된다.
    """
    if _uses_file_learning(bot):
        return (
            "파일 학습 봇은 내 OpenAI 키가 필요합니다. "
            "무료 제공 키로는 업로드한 파일을 읽을 수 없어요. "
            "API 키 화면에서 내 키를 등록하고 '내 키 사용'을 골라 주세요."
        )
    return (
        "호출할 API 키가 없습니다. API 키 화면에서 키를 등록해 주세요."
    )


@dataclass(frozen=True)
class LlmRoute:
    """이번 호출에 무엇을 쓸지. `resolve_llm_route` 가 만든다."""

    api_key: str
    model: str
    provider: Provider
    vector_store_id: str | None
    #: 프롬프트 조립용. 우리 키면 오버라이드가 적용된 뷰, 아니면 원본 bot.
    prompt_bot: object
    is_ours: bool


async def resolve_llm_route(bot, api_key_service, effective_model) -> LlmRoute | None:
    """주인 키 우선, 없으면 우리 키. `None` 이면 **LLM 을 부르면 안 된다.**

    BYOK 는 삭제하지 않고 우선순위만 뒤로 뒀다. 주인이 키를 등록해두면 그대로
    자기 모델·웹검색·파일학습을 쓰고, 안 했으면 우리 키로 기본 동작은 한다.
    가입하자마자 첫 대화가 실패하던 게 원래 문제였다.

    `None` 을 돌려주는 두 경우:
      - 우리 키가 설정돼 있지 않다
      - **파일 학습 봇이다.** 우리 키로는 벡터스토어를 못 읽는데, 그렇다고
        vec_id 만 빼고 호출하면 `_build_system_prompt` 의 `has_knowledge` 가
        False 가 되어 **자료 한정 규칙이 통째로 사라진다.** 호텔 FAQ 봇이
        체크인 시간을 지어내게 된다. 오류보다 나쁘다.
    """
    provider = resolve_provider(effective_model)

    # 제공 키를 쓸지는 계정 설정이다(키 화면에서 고른다). OpenAI 에만 해당한다 —
    # Anthropic·Google 은 우리가 키를 안 내주므로 그쪽 모델이면 본인 키뿐이다.
    prefers_service = provider == Provider.OPENAI and await prefers_service_key(
        api_key_service.api_key_repo.db, bot.user_id
    )

    owner_key = (
        None
        if prefers_service
        else await api_key_service.get_decrypted_key(bot.user_id, provider)
    )
    if owner_key:
        return LlmRoute(
            api_key=owner_key,
            model=effective_model,
            provider=provider,
            vector_store_id=(
                bot.vector_store_id if provider == Provider.OPENAI else None
            ),
            prompt_bot=bot,
            is_ours=False,
        )

    service_key = service_llm_key() if provider == Provider.OPENAI else ""
    if not service_key:
        # 제공 경로가 없다. 제공 키를 고른 계정이라 본인 키를 아직 안 봤다면
        # 여기서 본다 — 설정은 켜뒀는데 우리 키가 비어 있는 경우다.
        if prefers_service:
            owner_key = await api_key_service.get_decrypted_key(
                bot.user_id, provider
            )
            if owner_key:
                return LlmRoute(
                    api_key=owner_key,
                    model=effective_model,
                    provider=provider,
                    vector_store_id=bot.vector_store_id,
                    prompt_bot=bot,
                    is_ours=False,
                )
        return None
    if _uses_file_learning(bot):
        return None

    return LlmRoute(
        api_key=service_key,
        model=SERVICE_MODEL,
        provider=Provider.OPENAI,
        vector_store_id=None,
        prompt_bot=_service_prompt_view(bot),
        is_ours=True,
    )


#: LLM 에 보낼 최근 대화 턴 수(메시지 개수 기준, 질문+답변이 각각 1개).
#:
#: 이게 없으면 세션이 길어질수록 매 턴 입력이 커진다. 같은 "대화 1건"인데
#: 30번째 질문의 원가가 첫 질문의 몇 배가 되고, 그러면 건수 쿼터가 지출 상한
#: 구실을 못 한다. 실측에서 60메시지 세션의 누적이 4,234자였다.
#:
#: 20으로 잡은 근거: FAQ 봇은 앞 대화를 길게 참조할 일이 거의 없다. 질문+답변이
#: 한 턴에 2개씩이므로 최근 10턴이다. 상담을 길게 이어가는 봇이라면 이 값을
#: 올려야 하는데, 그건 지금 파는 상품(호텔·학원 FAQ)이 아니다.
LLM_HISTORY_LIMIT = 20


def _resolve_effective_model(bot_model: str, override: str | None) -> str:
    """body의 model override가 provider prefix 매칭되면 채택. 카탈로그는 DB SOT."""
    if not override:
        return bot_model
    val = override.strip()
    try:
        resolve_provider(val)
        return val
    except ValueError:
        return bot_model


#: 프롬프트에 적을 언어 이름. 'ko' 는 없다 — 원문이 한국어라 고정할 게 없고,
#: 기본값이라 여기 있으면 한국인 방문자에게도 규칙이 하나 더 붙는다.
_LANG_NAME = {
    "en": "영어",
    "ja": "일본어",
    "zh": "중국어",
}


def _build_system_prompt(
    bot,
    vector_store_id: str | None = None,
    multilingual: bool = False,
    lang: str | None = None,
) -> str:
    """봇 system_prompt + 학습 텍스트 + (fallback 또는 web search) 규칙 합성.

    - 학습 자료 + fallback 있음: 자료에 없는 질문은 fallback 그대로 답변.
    - 학습 자료 + fallback 없음: 자료에 없는 질문은 web search로 답변.
    - 학습 자료 없음: 일반 자유 응답.

    vector_store_id는 provider 게이팅을 마친 값(= 실제로 LLM 호출에 전달되는 값)을 받는다.
    OpenAI가 아닌 모델은 파일 지식이 전달되지 않으므로, bot.vector_store_id가 남아 있어도
    '자료 한정' 규칙을 붙이면 안 된다. (붙이면 모든 질문에 fallback만 뱉는 봇이 됨)
    """
    parts: list[str] = []
    if (bot.system_prompt or "").strip():
        parts.append(bot.system_prompt.strip())

    # 다국어: 방문자가 쓴 언어로 답한다.
    #
    # 번역 API도 언어 감지도 쓰지 않는다 — LLM이 사용자 메시지를 보고 알아서
    # 맞춘다. 학습 자료가 한국어여도 답은 방문자 언어로 나가고, 원가는 0이다.
    #
    # QR에 `?lang=` 을 실어도 그건 **첫 인사말만** 정한다. 대화는 사용자가 실제로
    # 쓴 언어를 따라가는 게 맞다 — 일본인이 영어로 물으면 영어로 답해야 한다.
    if multilingual:
        # 방문자가 화면에서 언어를 골랐으면 **그 언어로 못 박는다.**
        # 안 그러면 일본어를 골라놓고 영어로 한 마디 던졌을 때 영어로 답이 가고,
        # 관광객 입장에서는 고른 게 무시된 것으로 보인다. 고르지 않았으면
        # (ko 기본) 사용자가 쓴 말을 따라간다.
        chosen = _LANG_NAME.get((lang or "").lower()) if lang else None
        if chosen:
            parts.append(
                f"언어 규칙:\n"
                f"- 방문자가 {chosen}를 선택했습니다. **항상 {chosen}로 답변하세요.**\n"
                f"- 질문이 다른 언어로 들어와도 답변은 {chosen}로 하세요.\n"
                "- 참고 자료가 다른 언어로 쓰여 있어도 옮겨서 답하세요.\n"
                "- 고유명사(상호·메뉴명·지명)는 원문을 함께 적어주세요. "
                "방문자가 현장에서 그 이름을 찾아야 하기 때문입니다."
            )
        else:
            parts.append(
                "언어 규칙:\n"
                "- 사용자가 사용한 언어와 같은 언어로 답변하세요.\n"
                "- 참고 자료가 다른 언어로 쓰여 있어도 답변은 사용자 언어로 옮겨서 하세요.\n"
                "- 고유명사(상호·메뉴명·지명)는 원문을 함께 적어주세요. "
                "방문자가 현장에서 그 이름을 찾아야 하기 때문입니다."
            )
    else:
        # 다국어가 꺼져 있으면 **한국어로 못 박는다.**
        #
        # 규칙을 아예 안 붙이면 LLM 은 기본 동작대로 사용자 언어를 따라간다 —
        # 영어로 물으면 영어로 답한다. 그러면 유료 기능인 다국어와 경계가 흐려지고,
        # 더 나쁜 건 **한 대화 안에서 언어가 섞인다**는 것이다:
        # 자료에 있는 질문은 영어로 답하는데, 자료에 없는 질문은 아래 fallback 규칙이
        # "정확히 그대로" 답하게 해서 한국어 문장이 튀어나온다.
        #
        # 그래서 여기서 한국어로 고정한다. fallback 이 한국어인 것과 앞뒤가 맞고,
        # 외국인 응대가 필요하면 그건 GLOBAL 이 파는 것이다.
        #
        # ⚠️ 대가가 있다: 봇 주인이 system_prompt 에 "영어로 답하라"고 써도 이 규칙이
        #    뒤에 붙어서 이긴다. 영어 봇을 만들려는 사용자가 막힌다는 뜻이다.
        #    그런 요구가 실제로 오면 봇 단위 `language` 설정으로 풀 것.
        parts.append(
            "언어 규칙:\n"
            "- 항상 한국어로 답변하세요.\n"
            "- 질문이 다른 언어로 들어와도 답변은 한국어로 하세요."
        )

    # training_type이 "file"이면 텍스트 학습은 쓰지 않는다.
    # (모드를 바꿔도 예전 training_text가 DB에 남아 조용히 주입되는 것 방지)
    training_type = getattr(bot, "training_type", None) or "text"
    training_text = bot.training_text if training_type != "file" else None
    if training_text:
        parts.append(
            "다음은 답변에 활용할 참고 자료입니다:\n" + training_text
        )

    has_knowledge = bool(training_text) or bool(vector_store_id)
    if has_knowledge:
        fallback = (bot.fallback or "").strip()
        if fallback:
            # 다국어일 때 fallback 을 "그대로" 답하게 두면 외국인 방문자에게
            # 한국어 문장이 튀어나온다. 4개 국어로 응대하다가 모르는 질문 하나에서
            # 한국어가 나오는 게 이 상품에서 제일 티나는 사고라 여기만 규칙을 바꾼다.
            fallback_rule = (
                "- 자료에 없거나 확실하지 않은 질문에는 다른 말 없이 "
                "다음 문장을 **사용자 언어로 옮겨서** 답변하세요:\n"
                if multilingual
                else "- 자료에 없거나 확실하지 않은 질문에는 다른 말 없이 정확히 "
                "다음 문장을 그대로 답변하세요:\n"
            )
            parts.append(
                "중요 규칙:\n"
                "- 위에 제공된 참고 자료(또는 첨부된 파일)에 명시된 내용 안에서만 답변하세요.\n"
                "- 추측하거나 일반 상식/사전 지식으로 답변하지 마세요.\n"
                + fallback_rule
                + f'"{fallback}"'
            )
        else:
            parts.append(
                "중요 규칙:\n"
                "- 우선 위에 제공된 참고 자료(또는 첨부된 파일)에서 답을 찾으세요.\n"
                "- 자료에 답이 없으면 web search 도구를 사용해 인터넷에서 최신 정보를 검색해 답변하세요."
            )
    return "\n\n".join(parts)


async def _multilingual_allowed(bot, usage_service) -> bool:
    """봇 설정과 **현재 플랜**을 모두 만족할 때만 다국어를 켠다.

    봇의 `multilingual` 플래그만 보면, GLOBAL을 한 달 결제해 켜둔 뒤 STANDARD로
    내려도 계속 돈다. 그러면 99,000원을 유지할 이유가 없어져 가격이 무너진다.
    `_ensure_multilingual_allowed`(쓰기 시점)만으로는 못 막는다 — 하향은 봇을
    건드리지 않고 일어나기 때문이다.

    판정할 수단이 없으면(usage_service 미주입) **끈다.** 확인 못 하는 유료 기능은
    주지 않는 쪽이 안전하고, 이 코드베이스가 `resolve_plan`에서 FREE로 떨어뜨리는
    것과 같은 방향이다.
    """
    if not getattr(bot, "multilingual", False):
        return False
    if usage_service is None:
        return False
    return not await usage_service.is_feature_blocked(bot, "multilingual")


def _should_enable_web_search(bot) -> bool:
    """fallback이 비어있으면 web search 활성. fallback을 설정하면 web search 대신 해당 메시지 사용."""
    return not (bot.fallback or "").strip()


#: 방문자에게 보일 LLM 오류 문구.
#:
#: `_format_llm_error`의 결과를 방문자에게 내보내면 안 된다. 상대는 봇 주인이 아니라
#: 그 사람의 고객이다. "The server is overloaded", "invalid api key" 같은 영문 원문은
#: 고객이 손쓸 수 없는 정보이고, 우리(또는 봇 주인)의 사정을 노출한다.
#: 원문은 로그에만 남기고, 주인에게는 대시보드에서 따로 알린다.
VISITOR_LLM_ERROR_MESSAGE = "일시적인 오류가 발생했어요. 잠시 후 다시 물어봐 주세요."


#: 키가 없을 때 **주인 대시보드**에 남길 문구. 방문자는 이걸 보지 않는다.
#: 종류는 `LlmErrorKind.AUTH` — "키를 다시 등록해야 한다"는 뜻이라 딱 맞는다.
#:
#: `bot.active` 를 시스템이 끄는 방식은 쓰지 않는다. 주인이 켠 걸 우리가 끄면
#: 주인은 "왜 꺼졌지"만 보고 다시 켜고, 또 꺼진다. 호출 시점에 판정한다.
NO_KEY_OWNER_MESSAGE = "API 키가 등록되지 않아 답변할 수 없습니다."


def _format_llm_error(provider_value: str, exc: Exception) -> str:
    """LLM SDK 에러를 **봇 주인이 보는 화면용**으로 가공. 원문을 그대로 포함한다.

    대시보드 미리보기에서만 쓴다. 방문자 경로는 VISITOR_LLM_ERROR_MESSAGE.
    """
    raw = str(exc)
    # 판정은 classify_llm_error 하나만 쓴다. 여기서 따로 문자열을 훑으면
    # 화면은 "키 오류"라는데 통계 화면은 "기타"로 잡히는 상태가 된다.
    kind = classify_llm_error(exc)
    if kind == "auth":
        hint = f"⚠️ {provider_value} API 키가 유효하지 않습니다. (없거나 잘못 입력됐을 수 있어요.)"
    elif kind == "quota":
        hint = f"⚠️ {provider_value} 토큰/크레딧이 부족하거나 호출 한도를 초과했습니다."
    else:
        hint = "⚠️ 모델 호출 실패"

    return f"{hint}\n\n```\n{raw}\n```"


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _msg_to_dict(msg: ChatMessage) -> dict:
    return {
        "id": msg.id,
        "role": msg.role.value,
        "content": msg.content,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


def _session_to_dict(session: ChatSession, last_message: str | None = None) -> dict:
    return {
        "id": session.id,
        "bot_id": session.bot_id,
        "visitor_id": session.visitor_id,
        #: 방문자가 고른 언어. 컬럼이 생기기 전 세션과 다국어 OFF 세션은 None이고,
        #: 둘을 구분할 방법이 없어 화면이 "-"로 표시한다.
        "lang": session.lang,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "last_message_at": (
            session.last_message_at.isoformat() if session.last_message_at else None
        ),
        "preview": last_message,
    }


class ChatService:
    def __init__(
        self,
        chat_repo: ChatRepository,
        bot_repo: BotRepository,
        api_key_service: ApiKeyService,
        llm_service: LLMService,
        usage_service=None,
    ):
        self.chat_repo = chat_repo
        self.bot_repo = bot_repo
        self.api_key_service = api_key_service
        self.llm_service = llm_service
        self.usage_service = usage_service

    # ── 임베드 위젯 streaming (SSE) ────────────
    async def stream_message(self, body: dict) -> AsyncGenerator[str, None]:
        """SSE 청크를 yield. 라우터에서 StreamingResponse로 감싸서 반환.

        body는 라우터에서 미리 파싱해 인자로 전달받는다. (StreamingResponse
        시작 후 receive 호출 시 uvicorn hang 회피)

        주입된 self.chat_repo/bot_repo의 세션은 라우터 return 후 dependency
        cleanup으로 닫히므로, 이 메서드는 자체 SessionLocal 컨텍스트를 연다.
        """
        logger.debug("[stream] 제너레이터 진입")
        bot_slug = (body.get("bot_id") or "").strip()
        visitor_id = (body.get("visitor_id") or "").strip()
        lang = (body.get("lang") or "").strip().lower()
        content = (body.get("content") or "").strip()
        session_id = body.get("session_id")
        model_override = body.get("model")

        if not (bot_slug and visitor_id and content):
            yield _sse("error", {"message": "bot_id, visitor_id, content가 필요합니다."})
            return

        logger.debug("[stream] SessionLocal 여는 중")
        async with SessionLocal() as db:
            logger.debug("[stream] db 획득")
            chat_repo = ChatRepository(db)
            bot_repo = BotRepository(db)
            api_key_repo = ApiKeyRepository(db)
            api_key_service = ApiKeyService(api_key_repo)
            usage_service = usage_service_for(db)

            try:
                bot = await bot_repo.find_by_slug(bot_slug)
                logger.debug("[stream] 봇 로드 bot=%s", bot.id if bot else None)
                if not bot or not bot.active:
                    yield _sse("error", {"message": "이 챗봇은 현재 사용할 수 없습니다."})
                    return

                # 스트림 시작 후엔 예외를 못 던지므로 SSE error로 알린다.
                # 위젯 상대는 봇 주인이 아니라 그 사람의 고객이라, 우리 과금 문구를
                # 그대로 내보내지 않는다. 주인 쪽에는 로그로 남긴다.
                if await usage_service.is_blocked(bot):
                    logger.info(
                        "위젯 차단(월 대화 한도 초과) bot=%s user=%s",
                        bot.slug, bot.user_id,
                    )
                    yield _sse("error", {"message": visitor_unavailable_message(bot)})
                    return

                if session_id:
                    session = await chat_repo.find_session(int(session_id))
                    # 세션 소유 방문자까지 검증 — bot_id만 보면 다른 방문자 세션 탈취 가능(IDOR)
                    if (
                        not session
                        or session.bot_id != bot.id
                        or session.visitor_id != visitor_id
                    ):
                        yield _sse("error", {"message": "세션이 유효하지 않습니다."})
                        return
                else:
                    session = ChatSession(bot_id=bot.id, visitor_id=visitor_id)
                    await chat_repo.add_session(session)

                user_msg = ChatMessage(
                    session_id=session.id,
                    role=MessageRole.USER,
                    content=content,
                )
                await chat_repo.add_message(user_msg)
                await db.commit()
                await db.refresh(user_msg)
                await db.refresh(session)

                logger.debug("[stream] meta 전송 직전")
                yield _sse(
                    "meta",
                    {
                        "session_id": session.id,
                        "user_message": _msg_to_dict(user_msg),
                    },
                )
                logger.debug("[stream] meta 전송 완료")

                # 주인 키 우선, 없으면 우리 키. None 이면 LLM 을 부르면 안 된다.
                route = await resolve_llm_route(
                    bot,
                    api_key_service,
                    _resolve_effective_model(bot.model, model_override),
                )
                effective_model = route.model if route else bot.model
                provider = route.provider if route else resolve_provider(bot.model)
                api_key = route.api_key if route else ""
                vec_id = route.vector_store_id if route else None

                # 프롬프트는 route 가 준 뷰로 짠다. 우리 키면 fallback 이 채워져
                # 있어서 web search 가 꺼지고 자료 한정으로 굳는다.
                system = _build_system_prompt(
                    route.prompt_bot if route else bot,
                    vec_id,
                    await _multilingual_allowed(bot, usage_service),
                    lang,
                )

                history = await chat_repo.find_messages(
                    session.id, limit=LLM_HISTORY_LIMIT
                )
                api_messages = [
                    {
                        "role": "user" if m.role == MessageRole.USER else "assistant",
                        "content": m.content,
                    }
                    for m in history
                ]

                full_text = ""

                if not api_key:
                    # 여기 오는 경우는 둘뿐이다(resolve_llm_route 참고):
                    #   - 주인 키도 우리 키도 없다
                    #   - 파일 학습 봇인데 주인 키가 없다 → 우리 키로 떨어뜨리면
                    #     자료 한정 규칙이 사라져 지어낸다. 그래서 일부러 안 부른다.
                    logger.info(
                        "스트리밍 호출 불가 — fallback 응답 bot=%s user=%s "
                        "provider=%s 파일학습=%s",
                        bot.slug, bot.user_id, provider.value,
                        _uses_file_learning(bot),
                    )
                    # 방문자는 중립 문구를 받으니 주인이 알 수 있게 DB에 남긴다.
                    # 아래 db.commit() 에 같이 실린다.
                    await LlmErrorRepository(db).record(
                        bot_id=bot.id,
                        channel=LlmErrorChannel.WIDGET,
                        kind=LlmErrorKind.AUTH,
                        provider=provider.value,
                        model=effective_model,
                        message=NO_KEY_OWNER_MESSAGE,
                    )
                    full_text = visitor_unavailable_message(bot)
                    yield _sse("chunk", {"text": full_text})
                else:
                    logger.debug("[stream] LLM 호출 시작 model=%s", effective_model)
                    try:
                        async for chunk in self.llm_service.chat_stream(
                            model=effective_model,
                            system_prompt=system,
                            messages=api_messages,
                            api_key=api_key,
                            vector_store_id=vec_id,
                            enable_web_search=_should_enable_web_search(
                                route.prompt_bot if route else bot
                            ),
                        ):
                            if not full_text:
                                logger.debug("[stream] 첫 청크 수신")
                            full_text += chunk
                            yield _sse("chunk", {"text": chunk})
                    except Exception as exc:
                        logger.exception(
                            "위젯 스트리밍 LLM 실패 bot=%s user=%s provider=%s chars=%d",
                            bot.slug, bot.user_id, provider.value, len(full_text),
                        )
                        # 방문자는 중립 문구만 받으므로, 주인이 알 수 있게 DB에도 남긴다.
                        # 아래 db.commit()에 같이 실린다.
                        await LlmErrorRepository(db).record(
                            bot_id=bot.id,
                            channel=LlmErrorChannel.WIDGET,
                            kind=LlmErrorKind(classify_llm_error(exc)),
                            provider=provider.value,
                            model=effective_model,
                            message=str(exc),
                        )
                        # 이미 일부가 나갔으면 이어서 붙이고, 아직이면 이 문구만 나간다.
                        err_msg = VISITOR_LLM_ERROR_MESSAGE
                        full_text = (full_text or "") + err_msg
                        yield _sse("chunk", {"text": err_msg})

                if not full_text.strip():
                    full_text = bot.fallback or "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
                    yield _sse("chunk", {"text": full_text})

                # 스트림에는 출처 마커가 섞여 나간다. 저장본까지 그대로 두면
                # 대화 로그에 남고, 다음 턴에 히스토리로 LLM에 되먹여진다.
                full_text = strip_citations(full_text)

                bot_msg = ChatMessage(
                    session_id=session.id,
                    role=MessageRole.BOT,
                    content=full_text,
                )
                await chat_repo.add_message(bot_msg)
                session.last_message_at = now_kst()
                session.lang = lang or session.lang
                await usage_service.record_message(bot)
                await db.commit()
                await db.refresh(bot_msg)

                yield _sse("done", {"bot_message": _msg_to_dict(bot_msg)})
            except Exception as exc:
                logger.exception("위젯 스트리밍 실패 bot=%s visitor=%s", bot_slug, visitor_id)
                yield _sse("error", {"message": str(exc)})

    # ── 대시보드 미리보기 (봇 소유자만, DB 저장 O, visitor_id=preview-{user_id}) ──
    async def preview_stream(
        self, body: dict, user_id: int
    ) -> AsyncGenerator[str, None]:
        """폼 override 그대로 LLM 호출. session/message DB에 저장하되
        visitor_id를 'preview-{user_id}'로 박아 일반 대화와 구분 가능."""
        bot_slug = (body.get("bot_id") or "").strip()
        content = (body.get("content") or "").strip()
        session_id = body.get("session_id")
        lang = (body.get("lang") or "").strip().lower()

        if not (bot_slug and content):
            yield _sse("error", {"message": "bot_id, content가 필요합니다."})
            return

        async with SessionLocal() as db:
            chat_repo = ChatRepository(db)
            bot_repo = BotRepository(db)
            api_key_repo = ApiKeyRepository(db)
            api_key_service = ApiKeyService(api_key_repo)
            # 자체 세션 경로라 주입된 self.usage_service 를 쓸 수 없다.
            # 다국어 플랜 게이팅에 필요하다.
            usage_service = usage_service_for(db)

            try:
                bot = await bot_repo.find_by_slug(bot_slug)
                if not bot:
                    yield _sse("error", {"message": "봇이 존재하지 않습니다."})
                    return
                if bot.user_id != user_id:
                    yield _sse("error", {"message": "권한이 없습니다."})
                    return

                visitor_id = f"preview-{user_id}"

                # 세션 확보 (있으면 검증, 없으면 새로)
                if session_id:
                    session = await chat_repo.find_session(int(session_id))
                    if (
                        not session
                        or session.bot_id != bot.id
                        or session.visitor_id != visitor_id
                    ):
                        yield _sse("error", {"message": "세션이 유효하지 않습니다."})
                        return
                else:
                    session = ChatSession(bot_id=bot.id, visitor_id=visitor_id)
                    await chat_repo.add_session(session)

                # 사용자 메시지 저장
                user_msg = ChatMessage(
                    session_id=session.id,
                    role=MessageRole.USER,
                    content=content,
                )
                await chat_repo.add_message(user_msg)
                await db.commit()
                await db.refresh(user_msg)
                await db.refresh(session)

                yield _sse(
                    "meta",
                    {
                        "session_id": session.id,
                        "user_message": _msg_to_dict(user_msg),
                    },
                )

                # 폼 override를 적용한 가벼운 가짜 bot
                preview_bot = SimpleNamespace(
                    user_id=bot.user_id,
                    # 저장 전 폼 값이 온다. 켜자마자 확인할 수 있어야 해서
                    # DB 값(bot.multilingual)보다 body 를 우선한다.
                    multilingual=bool(
                        body.get("multilingual", bot.multilingual)
                    ),
                    model=(body.get("model") or "").strip() or bot.model,
                    system_prompt=body.get("system_prompt")
                    if "system_prompt" in body
                    else bot.system_prompt,
                    training_text=body.get("training_text")
                    if "training_text" in body
                    else bot.training_text,
                    fallback=body.get("fallback")
                    if "fallback" in body
                    else bot.fallback,
                    training_type=body.get("training_type")
                    if "training_type" in body
                    else bot.training_type,
                    vector_store_id=bot.vector_store_id,
                )

                requested_model = _resolve_effective_model(preview_bot.model, None)
                # 위젯과 **같은 라우터**를 탄다. 미리보기가 다른 키·모델로 돌면
                # 여기서 확인한 답이 방문자가 받는 답이 아니게 된다.
                route = await resolve_llm_route(
                    preview_bot, api_key_service, requested_model
                )
                effective_model = route.model if route else requested_model
                provider = (
                    route.provider if route else resolve_provider(requested_model)
                )
                api_key = route.api_key if route else ""
                vec_id = route.vector_store_id if route else None

                # 미리보기도 플랜을 본다. 안 그러면 FREE 계정이 여기서
                # 다국어를 무제한으로 쓰고, 게이팅이 반쪽이 된다.
                system = _build_system_prompt(
                    route.prompt_bot if route else preview_bot,
                    vec_id,
                    await _multilingual_allowed(preview_bot, usage_service),
                    lang,
                )
                history = await chat_repo.find_messages(
                    session.id, limit=LLM_HISTORY_LIMIT
                )
                api_messages = [
                    {
                        "role": "user" if m.role == MessageRole.USER else "assistant",
                        "content": m.content,
                    }
                    for m in history
                ]

                full_text = ""
                if not route:
                    logger.info(
                        "미리보기 호출 불가 bot=%s user=%s 파일학습=%s",
                        bot.slug, user_id, _uses_file_learning(preview_bot),
                    )
                    full_text = _preview_no_route_message(preview_bot)
                    yield _sse("chunk", {"text": full_text})
                else:
                    try:
                        async for chunk in self.llm_service.chat_stream(
                            model=effective_model,
                            system_prompt=system,
                            messages=api_messages,
                            api_key=api_key,
                            vector_store_id=vec_id,
                            enable_web_search=_should_enable_web_search(
                                route.prompt_bot
                            ),
                        ):
                            full_text += chunk
                            yield _sse("chunk", {"text": chunk})
                    except Exception as exc:
                        # preview_bot은 폼 override를 얹은 SimpleNamespace라 slug가 없다. DB 객체를 쓴다.
                        logger.exception("미리보기 LLM 실패 bot=%s provider=%s", bot.slug, provider.value)
                        err_msg = _format_llm_error(provider.value, exc)
                        full_text += err_msg
                        yield _sse("chunk", {"text": err_msg})

                if not full_text.strip():
                    full_text = (preview_bot.fallback or "").strip() or "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
                    yield _sse("chunk", {"text": full_text})

                full_text = strip_citations(full_text)

                bot_msg = ChatMessage(
                    session_id=session.id,
                    role=MessageRole.BOT,
                    content=full_text,
                )
                await chat_repo.add_message(bot_msg)
                session.last_message_at = now_kst()
                session.lang = lang or session.lang
                await db.commit()
                await db.refresh(bot_msg)

                yield _sse("done", {"bot_message": _msg_to_dict(bot_msg)})
            except Exception as exc:
                logger.exception("미리보기 스트리밍 실패 user=%s", user_id)
                yield _sse("error", {"message": str(exc)})

    async def quick_stream(
        self, body: dict, user_id: int
    ) -> AsyncGenerator[str, None]:
        """저장되지 않은 봇의 즉시 미리보기. DB 저장 없음.
        body: {content, model, system_prompt?, training_text?, fallback?, history?[]}
        """
        content = (body.get("content") or "").strip()
        model = (body.get("model") or "").strip()
        lang = (body.get("lang") or "").strip().lower()

        if not (content and model):
            yield _sse("error", {"message": "content, model이 필요합니다."})
            return

        async with SessionLocal() as db:
            api_key_repo = ApiKeyRepository(db)
            api_key_service = ApiKeyService(api_key_repo)
            usage_service = usage_service_for(db)

            try:
                preview_bot = SimpleNamespace(
                    user_id=user_id,
                    multilingual=bool(body.get("multilingual", False)),
                    model=model,
                    system_prompt=body.get("system_prompt"),
                    training_text=body.get("training_text"),
                    fallback=body.get("fallback"),
                    training_type=body.get("training_type") or "text",
                    vector_store_id=None,
                )

                requested_model = _resolve_effective_model(preview_bot.model, None)
                route = await resolve_llm_route(
                    preview_bot, api_key_service, requested_model
                )
                effective_model = route.model if route else requested_model
                provider = (
                    route.provider if route else resolve_provider(requested_model)
                )
                api_key = route.api_key if route else ""

                system = _build_system_prompt(
                    route.prompt_bot if route else preview_bot,
                    None,
                    await _multilingual_allowed(preview_bot, usage_service),
                    lang,
                )

                raw_history = body.get("history") or []
                api_messages = [
                    {
                        "role": h.get("role", "user"),
                        "content": h.get("content", ""),
                    }
                    for h in raw_history
                    if h.get("content")
                ]
                api_messages.append({"role": "user", "content": content})

                full_text = ""
                if not route:
                    logger.info(
                        "즉시 미리보기 호출 불가 user=%s 파일학습=%s",
                        user_id, _uses_file_learning(preview_bot),
                    )
                    full_text = _preview_no_route_message(preview_bot)
                    yield _sse("chunk", {"text": full_text})
                else:
                    try:
                        async for chunk in self.llm_service.chat_stream(
                            model=effective_model,
                            system_prompt=system,
                            messages=api_messages,
                            api_key=api_key,
                            vector_store_id=None,
                            enable_web_search=_should_enable_web_search(
                                route.prompt_bot
                            ),
                        ):
                            full_text += chunk
                            yield _sse("chunk", {"text": chunk})
                    except Exception as exc:
                        logger.exception("즉시 미리보기 LLM 실패 provider=%s", provider.value)
                        err_msg = _format_llm_error(provider.value, exc)
                        full_text += err_msg
                        yield _sse("chunk", {"text": err_msg})

                if not full_text.strip():
                    full_text = (preview_bot.fallback or "").strip() or "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
                    yield _sse("chunk", {"text": full_text})

                yield _sse("done", {})
            except Exception as exc:
                logger.exception("즉시 미리보기 스트리밍 실패 user=%s", user_id)
                yield _sse("error", {"message": str(exc)})

    # ── 대시보드 (with_login) ─────────────────
    async def _history_cutoff(self, user_id: int):
        """이 계정이 **볼 수 있는** 가장 오래된 대화 시각. 무제한이면 None.

        플랜의 `history_days` 를 여기서 처음으로 실제 동작에 연결한다. 값만
        정의해두고 아무 데서도 안 쓰던 탓에, 가격표에 "대화 기록 7일"이라고
        써놓고 FREE 계정도 1년 전 대화를 그대로 볼 수 있었다.

        **지우지는 않는다.** 보관 기간이 지난 대화는 화면에서 가릴 뿐이고,
        플랜을 올리면 다시 보인다. 삭제로 구현하면 하향 한 번에 되돌릴 수 없는
        데이터 손실이 되고, 실수로 하향한 사람에게는 복구 수단이 없다.

        `usage_service` 를 거치지 않고 직접 조회한다 — 그건 주입이 선택이라
        (`usage_service=None` 가 기본) 여기서 기대면 주입을 빠뜨린 경로에서
        보관 기간이 조용히 사라진다.

        반환값은 **naive** 다. `now_kst()` 는 tz 가 붙은 값을 주는데 MySQL
        DATETIME 은 tz 없이 돌아와서, 그대로 비교하면
        `can't compare offset-naive and offset-aware datetimes` 로 터진다.
        저장할 때 KST 벽시계 값이 그대로 들어가므로 tz 만 떼면 맞다.
        (`stats_service` · `inquiry_service` 도 같은 이유로 같은 처리를 한다.)
        """
        limits = await limits_of(self.chat_repo.db, user_id)
        if limits.history_days is None:
            return None
        return (now_kst() - timedelta(days=limits.history_days)).replace(
            tzinfo=None
        )

    async def list_sessions(self, request):
        """query: bot_id(=slug) (optional). 안 주면 사용자 모든 봇의 세션."""
        user_id = request.user_id
        bot_slug = request.query_params.get("bot_id")
        since = await self._history_cutoff(user_id)

        if bot_slug:
            bot = await self.bot_repo.find_by_slug(bot_slug)
            if not bot or bot.user_id != user_id:
                fail("권한이 없습니다.", "FORBIDDEN", 403)
            sessions = await self.chat_repo.find_sessions_by_bot(bot.id, since)
            bot_id_to_slug = {bot.id: bot.slug}
        else:
            user_bots = await self.bot_repo.find_by_user(user_id)
            sessions = []
            for b in user_bots:
                sessions.extend(
                    await self.chat_repo.find_sessions_by_bot(b.id, since)
                )
            sessions.sort(
                key=lambda s: s.last_message_at or s.started_at, reverse=True
            )
            bot_id_to_slug = {b.id: b.slug for b in user_bots}

        # preview = 마지막 "사용자" 질문.
        # - 첫 질문이 아니라 마지막이어야 한다. 목록이 last_message_at 내림차순인데
        #   첫 메시지를 보여주면 정렬 기준과 어긋나고, 대화가 길어져도 preview가
        #   첫 질문에 멈춰 있다.
        # - 봇 답변이 아니라 사용자 질문이어야 한다. 답변은 길어서 2줄 클램프에
        #   잘리고 형식적인 문장이라 목록에서 세션 구분이 안 된다. 이 화면을 보는
        #   목적도 "고객이 무엇을 묻는가"다.
        last_messages = await self.chat_repo.find_last_messages(
            [s.id for s in sessions], role=MessageRole.USER
        )

        result = []
        for s in sessions:
            last = last_messages.get(s.id)
            d = _session_to_dict(s, last.content if last else None)
            d["bot_id"] = bot_id_to_slug.get(s.bot_id)  # 외부엔 slug로 노출
            result.append(d)
        return success(data=result)

    async def get_session_messages(self, request):
        user_id = request.user_id
        session_id = int(request.path_params.get("session_id"))
        session = await self.chat_repo.find_session(session_id)
        if not session:
            fail("세션이 존재하지 않습니다.", "SESSION_NOT_FOUND", 404)

        bot = await self.bot_repo.find_by_id(session.bot_id)
        if not bot or bot.user_id != user_id:
            fail("권한이 없습니다.", "FORBIDDEN", 403)

        # 목록에서 가려진 대화를 URL 로 직접 열면 보이는 구멍을 막는다.
        since = await self._history_cutoff(user_id)
        last_at = session.last_message_at or session.started_at
        # DB 에서 온 값은 naive 지만, 같은 세션에서 방금 now_kst() 로 채워진
        # 객체가 잡히면 aware 일 수 있다. 양쪽을 naive 로 맞춰 비교한다.
        if last_at is not None and last_at.tzinfo is not None:
            last_at = last_at.replace(tzinfo=None)
        if since is not None and last_at is not None and last_at < since:
            fail(
                "현재 플랜의 대화 기록 보관 기간이 지난 대화입니다. "
                "플랜을 올리면 다시 볼 수 있습니다.",
                "HISTORY_RETENTION_EXCEEDED",
                403,
            )

        messages = await self.chat_repo.find_messages(session.id)
        session_dict = _session_to_dict(session)
        session_dict["bot_id"] = bot.slug  # 외부엔 slug로 노출
        return success(
            data={
                "session": session_dict,
                "messages": [_msg_to_dict(m) for m in messages],
            }
        )
