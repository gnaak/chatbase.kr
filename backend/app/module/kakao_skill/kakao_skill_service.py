"""카카오 i 오픈빌더 스킬 서버.

오픈빌더가 사용자 발화를 이 엔드포인트로 POST하면, 기존 챗봇 엔진으로 답을 만들어
카카오 SkillResponse(JSON)로 돌려준다. 임베드 위젯과 같은 봇/학습자료/BYOK 키를 쓴다.

위젯과 다른 점:
  1. 응답 시간 제한 (오픈빌더 5초) — 초과하면 안내 문구로 대체
  2. 마크다운 미지원 — simpleText 평문으로 낮춰야 함
  3. 세션 id를 클라이언트가 들고 오지 않음 — (봇, 카카오 사용자)로 찾아 이어붙임
"""

import asyncio
import hashlib
import hmac
import re
import time
from datetime import timedelta

import httpx
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)

from app.core.config.settings import settings
from app.core.database.base import KST, now_kst
from app.core.utils.response import fail, success
from app.module.api_key.api_key import Provider
from app.module.chat.chat_message import ChatMessage, MessageRole
from app.module.chat.chat_session import ChatSession
from app.module.infra.llm.llm_service import classify_llm_error, resolve_provider
from app.module.llm_error.llm_error import LlmErrorChannel, LlmErrorKind

# 프롬프트 합성 규칙은 위젯과 반드시 같아야 하므로 chat_service를 SOT로 재사용한다.
from app.module.usage.usage_service import visitor_unavailable_message
from app.module.chat.chat_service import (
    _build_system_prompt,
    NO_KEY_OWNER_MESSAGE,
    VISITOR_LLM_ERROR_MESSAGE,
    _should_enable_web_search,
)

# 오픈빌더 스킬 서버는 5초 안에 응답해야 한다. 네트워크 왕복분을 빼고 끊는다.
# 블록에 Callback API를 켜두면 이 제한을 받지 않는다(아래 CALLBACK_TIMEOUT_SECONDS).
SKILL_TIMEOUT_SECONDS = 4.3
# 콜백 모드의 LLM 상한. 오픈빌더 콜백 설정 화면 기준 callbackUrl은 최대 5분 유효하다.
# 5분을 다 쓰지 않는 이유는 사용자 인내심 쪽이 먼저 바닥나기 때문이고,
# 상한 자체가 필요한 이유는 LLM이 멈췄을 때 대기 문구 이후로 아무 답도 못 받게 되기 때문이다.
CALLBACK_TIMEOUT_SECONDS = 60.0
# 콜백 모드에서 먼저 나가는 문구.
# 실측 결과 카카오는 이 값이 아니라 오픈빌더 콘솔의 "응답대기 메시지"를 표시한다.
# (공식 문서에는 data.text가 우선이라고 되어 있으나 실제 동작은 반대였다.)
# 카카오가 동작을 되돌리거나 콘솔 값이 비어 있을 때를 대비해 그대로 보낸다.
# 사용자에게 실제로 보이는 문구를 바꾸려면 오픈빌더 콘솔에서 수정해야 한다.
WAITING_MESSAGE = "답변을 준비하고 있어요. 잠시만 기다려 주세요 🙂"
# quickReplies 개수 상한. 카카오 제한이 10개다.
MAX_QUICK_REPLIES = 10
# 버튼 라벨 길이. 넘으면 카카오 UI에서 잘려서 무슨 질문인지 알 수 없다.
MAX_QUICK_REPLY_LABEL = 14
# simpleText 길이 상한 (카카오 제한에 여유를 둔 값)
MAX_TEXT_LENGTH = 1000
# 같은 카카오 사용자의 발화를 하나의 세션으로 묶는 시간
SESSION_TTL_HOURS = 6
# 대화 로그에서 카카오 유입을 구분하기 위한 visitor_id 접두사
VISITOR_PREFIX = "kakao:"


# ── 시크릿 ────────────────────────────────────
def issue_secret(bot_slug: str) -> str:
    """봇 slug + 서버 hash_key에서 파생하는 스킬 시크릿.

    별도 컬럼 없이 결정적으로 계산되므로 마이그레이션이 필요 없다.
    채널을 여러 개 붙이거나 시크릿 개별 회전이 필요해지면 tb_bot_channels로 승격한다.
    """
    digest = hmac.new(
        settings.hash_key.encode(),
        f"kakao-skill:{bot_slug}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return digest[:32]


def _visitor_id(kakao_user_id: str) -> str:
    """카카오 user key를 고정 길이로 해싱. visitor_id 컬럼(64자)에 항상 들어간다."""
    return VISITOR_PREFIX + hashlib.sha256(kakao_user_id.encode()).hexdigest()[:40]


# ── 마크다운 → 카카오 평문 ─────────────────────
_CODE_FENCE = re.compile(r"^\s*```.*$", re.MULTILINE)
_TABLE_DIVIDER = re.compile(r"^\|?[\s:|-]+\|?$")
_IMAGE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_HEADING = re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE)
_QUOTE = re.compile(r"^\s{0,3}>\s?", re.MULTILINE)
_HR = re.compile(r"^\s{0,3}(?:[-*_]\s*){3,}$", re.MULTILINE)
_BOLD = re.compile(r"(\*\*|__)(.+?)\1", re.DOTALL)
_ITALIC = re.compile(r"(?<![\w*_])([*_])([^*_\n]+?)\1(?![\w*_])")
_INLINE_CODE = re.compile(r"`([^`\n]+)`")
_BULLET = re.compile(r"^(\s*)[-*+]\s+", re.MULTILINE)
_BLANKS = re.compile(r"\n{3,}")


def _flatten_table_rows(text: str) -> str:
    """`| a | b |` 행을 `a | b`로 낮추고 `|---|---|` 구분선은 통째로 버린다.

    구분선을 빈 줄로 남기면 헤더와 본문 사이가 벌어져 표가 끊겨 보인다.
    """
    lines = []
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("|") and s.endswith("|") and s.count("|") >= 2:
            if _TABLE_DIVIDER.fullmatch(s):
                continue
            cells = [c.strip() for c in s.strip("|").split("|")]
            lines.append(" | ".join(cells))
        else:
            lines.append(line)
    return "\n".join(lines)


def to_kakao_text(markdown: str) -> str:
    """카카오 simpleText는 마크다운을 렌더링하지 않는다. 기호가 그대로 노출되므로 평문화."""
    text = markdown or ""
    text = _CODE_FENCE.sub("", text)
    text = _flatten_table_rows(text)
    text = _IMAGE.sub(r"\1", text)
    text = _LINK.sub(r"\1 (\2)", text)
    text = _HEADING.sub("", text)
    text = _QUOTE.sub("", text)
    text = _HR.sub("", text)
    text = _BOLD.sub(r"\2", text)
    text = _ITALIC.sub(r"\2", text)
    text = _INLINE_CODE.sub(r"\1", text)
    text = _BULLET.sub(r"\1• ", text)
    text = _BLANKS.sub("\n\n", text).strip()

    if len(text) > MAX_TEXT_LENGTH:
        text = text[: MAX_TEXT_LENGTH - 1].rstrip() + "…"
    return text or "죄송해요, 답변을 만들지 못했어요."


def quick_replies_for(bot) -> list[dict]:
    """봇의 FAQ를 카카오 quickReplies(말풍선 아래 선택지 버튼)로 변환.

    위젯은 인사말 아래 FAQ 버튼을 이미 쓰고 있다. 카카오도 같은 자료를 쓰게 해서
    운영자가 FAQ를 한 번만 관리하면 두 채널에 다 반영되게 한다.

    action "message"는 label을 누르면 messageText를 사용자 발화로 보낸다.
    즉 다시 이 스킬로 들어오므로, 아래 FAQ 즉답 처리와 짝을 이룬다.
    """
    faqs = getattr(bot, "faqs", None) or []
    replies = []
    for faq in faqs[:MAX_QUICK_REPLIES]:
        question = (faq.get("q") or "").strip()
        if not question:
            continue
        replies.append(
            {
                "action": "message",
                # 라벨이 길면 카카오 UI에서 잘린다. 발화로는 원문을 그대로 보낸다.
                "label": question[:MAX_QUICK_REPLY_LABEL],
                "messageText": question,
            }
        )
    return replies


def _match_faq(bot, utterance: str) -> str | None:
    """발화가 FAQ 질문과 일치하면 준비된 답을 돌려준다.

    선택지 버튼을 누르면 카카오가 그 질문을 사용자 발화로 다시 보내므로,
    여기서 잡아 LLM 없이 즉답한다. 사용자가 직접 같은 문장을 타이핑한 경우도
    같은 답이 나가는 게 맞다.
    """
    target = utterance.strip()
    if not target:
        return None
    for faq in getattr(bot, "faqs", None) or []:
        if (faq.get("q") or "").strip() == target:
            answer = (faq.get("a") or "").strip()
            if answer:
                return answer
    return None


def _template(text: str, quick_replies: list[dict] | None = None) -> dict:
    template: dict = {"outputs": [{"simpleText": {"text": text}}]}
    if quick_replies:
        template["quickReplies"] = quick_replies
    return template


def skill_response(
    text: str, quick_replies: list[dict] | None = None
) -> JSONResponse:
    """오픈빌더 SkillResponse.

    실패해도 200 + simpleText로 돌려준다. 4xx/5xx를 주면 오픈빌더가 원인을 감추고
    기본 에러만 띄워서 사용자가 어디서 막혔는지 알 수 없다.
    """
    return JSONResponse(
        status_code=200,
        content={"version": "2.0", "template": _template(text, quick_replies)},
    )


def callback_ack(text: str) -> JSONResponse:
    """콜백 모드의 즉시 응답.

    `useCallback: true`가 핵심이고, template을 같이 넣으면 무시된다.
    data.text가 대기 중 사용자에게 보일 문구다.
    """
    return JSONResponse(
        status_code=200,
        content={"version": "2.0", "useCallback": True, "data": {"text": text}},
    )


async def _answer_via_callback(bot_id: int, session_id: int, callback_url: str) -> None:
    """백그라운드에서 답을 만들어 콜백 URL로 밀어넣는다.

    요청은 이미 응답을 끝냈으므로 그 DB 세션은 쓸 수 없다. 여기서 새로 연다.
    콜백 URL은 1회용이라 어떤 경로로 끝나든 반드시 한 번은 POST해야 한다.
    아무것도 안 보내면 사용자는 대기 문구만 본 채로 대화가 끊긴다.
    """
    # 순환 import 방지 — 모듈 로드 시점이 아니라 호출 시점에 가져온다.
    from app.core.database.base import SessionLocal
    from app.module.api_key.api_key_repository import ApiKeyRepository
    from app.module.api_key.api_key_service import ApiKeyService
    from app.module.bot.bot_repository import BotRepository
    from app.module.chat.chat_repository import ChatRepository
    from app.module.infra.llm.llm_service import LLMService
    from app.module.llm_error.llm_error_repository import LlmErrorRepository
    from app.module.usage.usage_repository import UsageRepository
    from app.module.usage.usage_service import UsageService
    from app.module.user.user_repository import UserRepository

    text = "답변을 만들지 못했어요. 잠시 후 다시 물어봐 주세요."
    quick_replies: list[dict] = []
    try:
        async with SessionLocal() as db:
            chat_repo = ChatRepository(db)
            bot_repo = BotRepository(db)
            usage_service = UsageService(UsageRepository(db), UserRepository(db))

            service = KakaoSkillService(
                chat_repo=chat_repo,
                bot_repo=bot_repo,
                api_key_service=ApiKeyService(ApiKeyRepository(db)),
                llm_service=LLMService(),
                usage_service=usage_service,
                llm_error_repo=LlmErrorRepository(db),
            )

            bot = await bot_repo.find_by_id(bot_id)
            session = await chat_repo.find_session(session_id)
            if not bot or not session:
                logger.error("kakao callback: bot=%s session=%s 없음", bot_id, session_id)
            else:
                answer = await service._generate(
                    bot, session, timeout=CALLBACK_TIMEOUT_SECONDS
                )
                await chat_repo.add_message(
                    ChatMessage(
                        session_id=session.id,
                        role=MessageRole.BOT,
                        content=answer,
                    )
                )
                session.last_message_at = now_kst()
                await usage_service.record_message(bot)
                await db.commit()
                text = to_kakao_text(answer)
                # 세션이 닫히기 전에 뽑아둔다. 아래 POST는 with 블록 밖이다.
                quick_replies = quick_replies_for(bot)
    except Exception:
        logger.exception("kakao callback: 답변 생성 실패 bot=%s", bot_id)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                callback_url,
                json={"version": "2.0", "template": _template(text, quick_replies)},
            )
        logger.info("kakao callback: 전송 완료 bot=%s status=%s", bot_id, resp.status_code)
    except Exception:
        logger.exception("kakao callback: 전송 실패 bot=%s", bot_id)


def _base_url(request) -> str:
    """대시보드에 표시할 스킬 URL의 절대 주소.

    스킴은 https로 고정한다. 카카오는 http URL을 스킬로 등록조차 받아주지 않는데,
    프록시가 넘기는 값은 믿을 수 없다 — nginx↔gunicorn은 평문이고, Cloudflare SSL이
    Flexible이면 X-Forwarded-Proto마저 http로 온다. 이 URL이 쓰이는 곳은 공개
    도메인뿐이므로 https 외의 값은 어차피 오답이다.
    """
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    ).split(",")[0].strip()
    return f"https://{host}".rstrip("/")


class KakaoSkillService:
    def __init__(
        self,
        chat_repo,
        bot_repo,
        api_key_service,
        llm_service,
        usage_service=None,
        llm_error_repo=None,
    ):
        self.chat_repo = chat_repo
        self.bot_repo = bot_repo
        self.api_key_service = api_key_service
        self.llm_service = llm_service
        self.usage_service = usage_service
        self.llm_error_repo = llm_error_repo

    # ── 오픈빌더 스킬 요청 처리 ──────────────
    async def handle_skill(self, request) -> JSONResponse:
        bot_slug = (request.path_params.get("bot_slug") or "").strip()

        provided = (
            request.query_params.get("secret")
            or request.headers.get("x-chatbase-secret")
            or ""
        ).strip()
        if not hmac.compare_digest(provided, issue_secret(bot_slug)):
            logger.warning("kakao secret mismatch bot=%s", bot_slug)
            return skill_response(
                "⚠️ 연결 시크릿이 올바르지 않습니다.\n"
                "대시보드에서 스킬 URL을 다시 복사해 오픈빌더에 등록해 주세요."
            )

        try:
            body = await request.json()
        except Exception:
            body = {}

        user_request = body.get("userRequest") or {}
        utterance = (user_request.get("utterance") or "").strip()
        kakao_user_id = ((user_request.get("user") or {}).get("id") or "").strip()

        bot = await self.bot_repo.find_by_slug(bot_slug)
        if not bot or not bot.active:
            return skill_response("⚠️ 연결된 챗봇을 찾을 수 없거나 비활성 상태입니다.")

        # 오픈빌더에는 4xx를 주면 원인이 감춰지므로 200 + 안내 문구로 돌려준다.
        # 여기서 답을 받는 상대는 봇 주인이 아니라 그 사람의 고객이므로
        # 플랜/과금 문구를 그대로 내보내지 않는다. (아래 로그로 주인 쪽에 남긴다)
        if self.usage_service:
            if await self.usage_service.is_feature_blocked(bot, "kakao_channel"):
                logger.info(
                    "kakao 차단(플랜에 카카오 채널 미포함) bot=%s user=%s",
                    bot.slug, bot.user_id,
                )
                return skill_response(visitor_unavailable_message(bot))
            if await self.usage_service.is_blocked(bot):
                logger.info(
                    "kakao 차단(월 대화 한도 초과) bot=%s user=%s",
                    bot.slug, bot.user_id,
                )
                return skill_response(visitor_unavailable_message(bot))

        quick_replies = quick_replies_for(bot)

        # 발화가 없는 요청 — 오픈빌더 웰컴 블록에 스킬을 붙인 경우가 여기로 온다.
        # 인사 메시지는 위젯에서 클라이언트가 꽂는 값이라 카카오로 안 간다.
        # 여기서 같은 문구를 내보내야 채널에서도 첫 화면에 인사말과 선택지가 뜬다.
        # 세션/사용량은 건드리지 않는다. 아직 대화가 시작된 게 아니다.
        if not utterance:
            greeting = (bot.greeting or "").strip() or "무엇을 도와드릴까요?"
            return skill_response(to_kakao_text(greeting), quick_replies)

        if not kakao_user_id:
            return skill_response(
                "⚠️ 카카오 사용자 정보를 받지 못했습니다. 실제 카카오톡 채널에서 다시 시도해 주세요."
            )

        session = await self._ensure_session(bot.id, _visitor_id(kakao_user_id))

        user_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.USER,
            content=utterance,
        )
        await self.chat_repo.add_message(user_msg)

        # 선택지 버튼을 누른 경우 — 발화가 FAQ 질문과 정확히 일치한다.
        # LLM을 부르지 않고 준비된 답을 바로 준다. 위젯의 FAQ 버튼과 동작을 맞추고,
        # 5초 제한도 사용자 API 비용도 걸리지 않는다.
        faq_answer = _match_faq(bot, utterance)
        if faq_answer:
            await self.chat_repo.add_message(
                ChatMessage(
                    session_id=session.id,
                    role=MessageRole.BOT,
                    content=faq_answer,
                )
            )
            session.last_message_at = now_kst()
            if self.usage_service:
                await self.usage_service.record_message(bot)
            await self.chat_repo.db.commit()
            logger.info("kakao FAQ 즉답 bot=%s", bot.slug)
            return skill_response(to_kakao_text(faq_answer), quick_replies)

        # 블록에서 Callback API를 켜두면 1회용 콜백 URL이 함께 온다.
        # 이때는 5초 제한을 안 받으므로, 즉시 대기 문구만 주고 답은 백그라운드에서 만든다.
        callback_url = (user_request.get("callbackUrl") or "").strip()
        if callback_url:
            # 백그라운드는 별도 DB 세션을 쓴다. 방금 넣은 사용자 발화가 히스토리에
            # 보이려면 여기서 먼저 확정해야 한다.
            session.last_message_at = now_kst()
            await self.chat_repo.db.commit()

            asyncio.create_task(
                _answer_via_callback(bot.id, session.id, callback_url)
            )
            return callback_ack(WAITING_MESSAGE)

        answer = await self._generate(bot, session)

        await self.chat_repo.add_message(
            ChatMessage(
                session_id=session.id,
                role=MessageRole.BOT,
                content=answer,
            )
        )
        session.last_message_at = now_kst()
        if self.usage_service:
            await self.usage_service.record_message(bot)
        await self.chat_repo.db.commit()

        return skill_response(to_kakao_text(answer), quick_replies)

    async def _ensure_session(self, bot_id: int, visitor_id: str) -> ChatSession:
        """TTL 안이면 직전 세션에 이어붙이고, 아니면 새로 만든다."""
        session = await self.chat_repo.find_latest_session_by_visitor(bot_id, visitor_id)
        if session and not self._is_expired(session):
            return session

        session = ChatSession(bot_id=bot_id, visitor_id=visitor_id)
        await self.chat_repo.add_session(session)
        return session

    @staticmethod
    def _is_expired(session: ChatSession) -> bool:
        last = session.last_message_at
        if last is None:
            return True
        # MySQL DATETIME은 naive로 돌아온다. now_kst()와 빼려면 tz를 붙여야 함.
        if last.tzinfo is None:
            last = KST.localize(last)
        return (now_kst() - last) > timedelta(hours=SESSION_TTL_HOURS)

    async def _record_error(self, bot, kind, provider_value: str, message: str) -> None:
        """LLM 실패를 통계용으로 남긴다. 주입이 없으면 조용히 넘어간다.

        커밋은 호출부에 맡긴다 — 동기 경로도 콜백 경로도 답변을 저장하면서
        어차피 커밋한다. 여기서 따로 커밋하면 그 트랜잭션을 반으로 자른다.
        """
        if not self.llm_error_repo:
            return
        await self.llm_error_repo.record(
            bot_id=bot.id,
            channel=LlmErrorChannel.KAKAO,
            kind=kind,
            provider=provider_value,
            model=bot.model,
            message=message,
        )

    async def _generate(
        self, bot, session: ChatSession, timeout: float = SKILL_TIMEOUT_SECONDS
    ) -> str:
        provider = resolve_provider(bot.model)
        api_key = await self.api_key_service.get_decrypted_key(bot.user_id, provider) or ""

        if not api_key:
            # 키가 없으면 LLM을 아예 부르지 않는다. 위젯 동기·스트리밍과 같은 판정이다.
            #
            # 빈 키로 부르면 SDK가 raise 하고, 그 결과로 카카오 상대에게
            # "일시적인 오류"가 간다. BYOK 라 키 없는 봇이 기본 상태인데
            # 그게 일시적이지도 않고, 주인이 써둔 fallback 도 안 쓰인다.
            logger.info(
                "kakao 키 없음 — fallback 응답 bot=%s user=%s provider=%s",
                bot.slug, bot.user_id, provider.value,
            )
            await self._record_error(
                bot, LlmErrorKind.AUTH, provider.value,
                NO_KEY_OWNER_MESSAGE,
            )
            return visitor_unavailable_message(bot)

        history = await self.chat_repo.find_messages(session.id)
        api_messages = [
            {
                "role": "user" if m.role == MessageRole.USER else "assistant",
                "content": m.content,
            }
            for m in history
        ]

        # vector_store는 OpenAI 모델일 때만 의미 있음 (위젯과 동일한 게이팅)
        vec_id = bot.vector_store_id if provider == Provider.OPENAI else None

        started = time.perf_counter()
        try:
            answer = await asyncio.wait_for(
                self.llm_service.chat(
                    model=bot.model,
                    system_prompt=_build_system_prompt(bot, vec_id),
                    messages=api_messages,
                    api_key=api_key,
                    vector_store_id=vec_id,
                    enable_web_search=_should_enable_web_search(bot),
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            elapsed = time.perf_counter() - started
            logger.warning(
                "kakao TIMEOUT bot=%s model=%s elapsed=%.2fs limit=%.1fs",
                bot.slug, bot.model, elapsed, timeout,
            )
            # 타임아웃도 주인이 알아야 한다 — 모델이 느려 카카오 채널만 조용히
            # 못 쓰는 상태가 될 수 있고, 그건 위젯 화면만 봐서는 안 보인다.
            await self._record_error(
                bot, LlmErrorKind.TIMEOUT, provider.value,
                f"{elapsed:.2f}s (limit {timeout:.1f}s)",
            )
            return (
                "답변을 만드는 데 시간이 조금 더 필요해요.\n"
                "한 번만 더 여쭤봐 주시겠어요?"
            )
        except Exception as exc:
            # 방문자에게는 중립 문구만. 원문(키 오류·크레딧 부족·제공자 과부하)은
            # 카카오톡 상대가 손쓸 수 없는 정보이고 봇 주인의 사정을 노출한다.
            logger.exception(
                "kakao LLM 호출 실패 bot=%s user=%s provider=%s",
                bot.slug, bot.user_id, provider.value,
            )
            await self._record_error(
                bot, LlmErrorKind(classify_llm_error(exc)), provider.value, str(exc)
            )
            return VISITOR_LLM_ERROR_MESSAGE

        elapsed = time.perf_counter() - started
        logger.info(
            "kakao ok bot=%s model=%s elapsed=%.2fs", bot.slug, bot.model, elapsed
        )

        if not answer.strip():
            return bot.fallback or "죄송해요, 질문을 이해하지 못했어요. 다시 한번 말씀해 주시겠어요?"
        return answer

    # ── 대시보드: 연결 정보 ──────────────────
    async def get_connection(self, request) -> JSONResponse:
        bot_slug = (request.path_params.get("bot_slug") or "").strip()
        user_id = request.user_id

        bot = await self.bot_repo.find_by_slug(bot_slug)
        if not bot or bot.user_id != user_id:
            fail("봇을 찾을 수 없습니다.", "BOT_NOT_FOUND", 404)

        secret = issue_secret(bot.slug)
        latest = await self.chat_repo.find_latest_session_by_prefix(
            bot.id, VISITOR_PREFIX
        )

        return success(
            data={
                "skill_url": (
                    f"{_base_url(request)}/api/kakao/skill/{bot.slug}?secret={secret}"
                ),
                "secret": secret,
                "connected": latest is not None,
                "last_message_at": (
                    latest.last_message_at.isoformat()
                    if latest and latest.last_message_at
                    else None
                ),
            }
        )
