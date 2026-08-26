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

from fastapi.responses import JSONResponse

from app.core.config.settings import settings
from app.core.database.base import KST, now_kst
from app.core.utils.response import fail, success
from app.module.api_key.api_key import Provider
from app.module.chat.chat_message import ChatMessage, MessageRole
from app.module.chat.chat_session import ChatSession
from app.module.infra.llm.llm_service import resolve_provider

# 프롬프트 합성 규칙은 위젯과 반드시 같아야 하므로 chat_service를 SOT로 재사용한다.
from app.module.usage.usage_service import PLAN_FEATURE_MESSAGE, QUOTA_MESSAGE
from app.module.chat.chat_service import (
    _build_system_prompt,
    _format_llm_error,
    _should_enable_web_search,
)

# 오픈빌더 스킬 서버는 5초 안에 응답해야 한다. 네트워크 왕복분을 빼고 끊는다.
SKILL_TIMEOUT_SECONDS = 4.3
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


def skill_response(text: str) -> JSONResponse:
    """오픈빌더 SkillResponse.

    실패해도 200 + simpleText로 돌려준다. 4xx/5xx를 주면 오픈빌더가 원인을 감추고
    기본 에러만 띄워서 사용자가 어디서 막혔는지 알 수 없다.
    """
    return JSONResponse(
        status_code=200,
        content={
            "version": "2.0",
            "template": {"outputs": [{"simpleText": {"text": text}}]},
        },
    )


def _base_url(request) -> str:
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    )
    return f"{proto}://{host}".rstrip("/")


class KakaoSkillService:
    def __init__(
        self,
        chat_repo,
        bot_repo,
        api_key_service,
        llm_service,
        usage_service=None,
    ):
        self.chat_repo = chat_repo
        self.bot_repo = bot_repo
        self.api_key_service = api_key_service
        self.llm_service = llm_service
        self.usage_service = usage_service

    # ── 오픈빌더 스킬 요청 처리 ──────────────
    async def handle_skill(self, request) -> JSONResponse:
        bot_slug = (request.path_params.get("bot_slug") or "").strip()

        provided = (
            request.query_params.get("secret")
            or request.headers.get("x-chatbase-secret")
            or ""
        ).strip()
        if not hmac.compare_digest(provided, issue_secret(bot_slug)):
            print(f"[kakao] secret mismatch bot={bot_slug}")
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

        if not utterance:
            return skill_response("무엇을 도와드릴까요?")
        if not kakao_user_id:
            return skill_response(
                "⚠️ 카카오 사용자 정보를 받지 못했습니다. 실제 카카오톡 채널에서 다시 시도해 주세요."
            )

        bot = await self.bot_repo.find_by_slug(bot_slug)
        if not bot or not bot.active:
            return skill_response("⚠️ 연결된 챗봇을 찾을 수 없거나 비활성 상태입니다.")

        # 오픈빌더에는 4xx를 주면 원인이 감춰지므로 200 + 안내 문구로 돌려준다.
        if self.usage_service:
            if await self.usage_service.is_feature_blocked(bot, "kakao_channel"):
                return skill_response(PLAN_FEATURE_MESSAGE)
            if await self.usage_service.is_blocked(bot):
                return skill_response(QUOTA_MESSAGE)

        session = await self._ensure_session(bot.id, _visitor_id(kakao_user_id))

        user_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.USER,
            content=utterance,
        )
        await self.chat_repo.add_message(user_msg)

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

        return skill_response(to_kakao_text(answer))

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

    async def _generate(self, bot, session: ChatSession) -> str:
        provider = resolve_provider(bot.model)
        api_key = await self.api_key_service.get_decrypted_key(bot.user_id, provider) or ""

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
                timeout=SKILL_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            elapsed = time.perf_counter() - started
            print(
                f"[kakao] TIMEOUT bot={bot.slug} model={bot.model} elapsed={elapsed:.2f}s"
            )
            return (
                "답변을 만드는 데 시간이 조금 더 필요해요.\n"
                "한 번만 더 여쭤봐 주시겠어요?"
            )
        except Exception as exc:
            print(f"[kakao] LLM call failed bot={bot.slug}: {exc}")
            return _format_llm_error(provider.value, exc)

        elapsed = time.perf_counter() - started
        print(f"[kakao] ok bot={bot.slug} model={bot.model} elapsed={elapsed:.2f}s")

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
