import json
from types import SimpleNamespace
from typing import AsyncGenerator

from app.core.database.base import SessionLocal, now_kst
from app.core.logging import get_logger
from app.core.utils.response import fail, success
from app.module.api_key.api_key import Provider
from app.module.api_key.api_key_repository import ApiKeyRepository
from app.module.api_key.api_key_service import ApiKeyService
from app.module.bot.bot_repository import BotRepository
from app.module.chat.chat_message import ChatMessage, MessageRole
from app.module.chat.chat_repository import ChatRepository
from app.module.chat.chat_session import ChatSession
from app.module.infra.llm.llm_service import (
    LLMService,
    resolve_provider,
    strip_citations,
)
from app.module.usage.usage_service import (
    usage_service_for,
    visitor_unavailable_message,
)

logger = get_logger(__name__)


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


def _build_system_prompt(bot, vector_store_id: str | None = None) -> str:
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
            parts.append(
                "중요 규칙:\n"
                "- 위에 제공된 참고 자료(또는 첨부된 파일)에 명시된 내용 안에서만 답변하세요.\n"
                "- 추측하거나 일반 상식/사전 지식으로 답변하지 마세요.\n"
                "- 자료에 없거나 확실하지 않은 질문에는 다른 말 없이 정확히 다음 문장을 그대로 답변하세요:\n"
                f'"{fallback}"'
            )
        else:
            parts.append(
                "중요 규칙:\n"
                "- 우선 위에 제공된 참고 자료(또는 첨부된 파일)에서 답을 찾으세요.\n"
                "- 자료에 답이 없으면 web search 도구를 사용해 인터넷에서 최신 정보를 검색해 답변하세요."
            )
    return "\n\n".join(parts)


def _should_enable_web_search(bot) -> bool:
    """fallback이 비어있으면 web search 활성. fallback을 설정하면 web search 대신 해당 메시지 사용."""
    return not (bot.fallback or "").strip()


def _format_llm_error(provider_value: str, exc: Exception) -> str:
    """LLM SDK 에러 메시지를 사용자 친화적으로 가공."""
    raw = str(exc)
    low = raw.lower()
    if (
        "api_key" in low
        or "auth_token" in low
        or "x-api-key" in low
        or "authentication" in low
        or "401" in raw
        or "unauthorized" in low
        or "invalid api key" in low
        or "api key not valid" in low
    ):
        hint = f"⚠️ {provider_value} API 키가 유효하지 않습니다. (없거나 잘못 입력됐을 수 있어요.)"
    elif (
        "quota" in low
        or "insufficient" in low
        or "billing" in low
        or "credit" in low
        or "429" in raw
        or "rate limit" in low
    ):
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

    # ── 임베드 위젯에서 호출 (인증 없음) ──────────
    async def send_message(self, request):
        """body: {"bot_id", "visitor_id", "content", "session_id"?}

        반환: {"session_id", "user_message", "bot_message"}
        """
        body = await request.json()
        bot_slug = (body.get("bot_id") or "").strip()
        visitor_id = (body.get("visitor_id") or "").strip()
        content = (body.get("content") or "").strip()
        session_id = body.get("session_id")
        model_override = body.get("model")

        if not (bot_slug and visitor_id and content):
            fail("bot_id, visitor_id, content가 필요합니다.", "BAD_REQUEST")

        bot = await self.bot_repo.find_by_slug(bot_slug)
        if not bot or not bot.active:
            fail("이 챗봇은 현재 사용할 수 없습니다.", "BOT_UNAVAILABLE", 404)

        # 실제 방문자 대화 경로 — 월 대화 한도 확인. 프리뷰 경로에는 걸지 않는다.
        if self.usage_service:
            await self.usage_service.ensure_can_send(bot)

        effective_model = _resolve_effective_model(bot.model, model_override)

        # 1) 세션 확보
        if session_id:
            session = await self.chat_repo.find_session(int(session_id))
            # 세션 소유 방문자까지 검증 — bot_id만 보면 다른 방문자 세션 탈취 가능(IDOR)
            if (
                not session
                or session.bot_id != bot.id
                or session.visitor_id != visitor_id
            ):
                fail("세션이 유효하지 않습니다.", "INVALID_SESSION", 400)
        else:
            session = ChatSession(
                bot_id=bot.id,
                visitor_id=visitor_id,
            )
            await self.chat_repo.add_session(session)

        # 2) 사용자 메시지 저장
        user_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.USER,
            content=content,
        )
        await self.chat_repo.add_message(user_msg)

        # 3) BYOK 키 — 없으면 빈 문자열로 호출 시도. SDK가 raise하면 그 메시지가 답변.
        provider = resolve_provider(effective_model)
        api_key = await self.api_key_service.get_decrypted_key(bot.user_id, provider) or ""

        # 4) LLM 호출 — 학습 데이터를 시스템 프롬프트에 합성
        history = await self.chat_repo.find_messages(session.id)
        api_messages = [
            {
                "role": "user" if m.role == MessageRole.USER else "assistant",
                "content": m.content,
            }
            for m in history
        ]

        # vector_store는 OpenAI 모델일 때만 의미 있음
        vec_id = (
            bot.vector_store_id
            if provider == Provider.OPENAI
            else None
        )
        system = _build_system_prompt(bot, vec_id)
        try:
            answer = await self.llm_service.chat(
                model=effective_model,
                system_prompt=system,
                messages=api_messages,
                api_key=api_key,
                vector_store_id=vec_id,
                enable_web_search=_should_enable_web_search(bot),
            )
        except Exception as exc:
            # 키 누락/잘못된 키/모델 오류 등 모든 SDK 에러를 그대로 답변으로 노출
            print(f"[chat] LLM call failed: {exc}")
            answer = _format_llm_error(provider.value, exc)

        if not answer.strip():
            answer = bot.fallback or "죄송해요, 질문을 이해하지 못했어요. 다시 한번 말씀해 주시겠어요?"

        # 5) 봇 메시지 저장 + 세션 갱신
        bot_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.BOT,
            content=answer,
        )
        await self.chat_repo.add_message(bot_msg)

        session.last_message_at = now_kst()
        if self.usage_service:
            await self.usage_service.record_message(bot)
        await self.chat_repo.db.commit()
        await self.chat_repo.db.refresh(user_msg)
        await self.chat_repo.db.refresh(bot_msg)

        return success(
            data={
                "session_id": session.id,
                "user_message": _msg_to_dict(user_msg),
                "bot_message": _msg_to_dict(bot_msg),
            }
        )

    # ── 임베드 위젯 streaming (SSE) ────────────
    async def stream_message(self, body: dict) -> AsyncGenerator[str, None]:
        """SSE 청크를 yield. 라우터에서 StreamingResponse로 감싸서 반환.

        body는 라우터에서 미리 파싱해 인자로 전달받는다. (StreamingResponse
        시작 후 receive 호출 시 uvicorn hang 회피)

        주입된 self.chat_repo/bot_repo의 세션은 라우터 return 후 dependency
        cleanup으로 닫히므로, 이 메서드는 자체 SessionLocal 컨텍스트를 연다.
        """
        print("[stream] entered generator")
        bot_slug = (body.get("bot_id") or "").strip()
        visitor_id = (body.get("visitor_id") or "").strip()
        content = (body.get("content") or "").strip()
        session_id = body.get("session_id")
        model_override = body.get("model")

        if not (bot_slug and visitor_id and content):
            yield _sse("error", {"message": "bot_id, visitor_id, content가 필요합니다."})
            return

        print("[stream] opening SessionLocal...")
        async with SessionLocal() as db:
            print("[stream] db acquired")
            chat_repo = ChatRepository(db)
            bot_repo = BotRepository(db)
            api_key_repo = ApiKeyRepository(db)
            api_key_service = ApiKeyService(api_key_repo)
            usage_service = usage_service_for(db)

            try:
                bot = await bot_repo.find_by_slug(bot_slug)
                print(f"[stream] bot loaded: {bot.id if bot else None}")
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

                print("[stream] yielding meta")
                yield _sse(
                    "meta",
                    {
                        "session_id": session.id,
                        "user_message": _msg_to_dict(user_msg),
                    },
                )
                print("[stream] meta yielded")

                effective_model = _resolve_effective_model(bot.model, model_override)
                provider = resolve_provider(effective_model)
                # 키 없어도 빈 문자열로 호출 시도 — SDK 에러를 답변으로 노출
                api_key = (
                    await api_key_service.get_decrypted_key(bot.user_id, provider)
                ) or ""

                # vector_store는 OpenAI 모델일 때만 의미 있음
                vec_id = (
                    bot.vector_store_id
                    if provider == Provider.OPENAI
                    else None
                )
                system = _build_system_prompt(bot, vec_id)

                history = await chat_repo.find_messages(session.id)
                api_messages = [
                    {
                        "role": "user" if m.role == MessageRole.USER else "assistant",
                        "content": m.content,
                    }
                    for m in history
                ]

                full_text = ""
                print(f"[stream] starting LLM call: {effective_model}")
                try:
                    async for chunk in self.llm_service.chat_stream(
                        model=effective_model,
                        system_prompt=system,
                        messages=api_messages,
                        api_key=api_key,
                        vector_store_id=vec_id,
                        enable_web_search=_should_enable_web_search(bot),
                    ):
                        if not full_text:
                            print("[stream] first LLM chunk received")
                        full_text += chunk
                        yield _sse("chunk", {"text": chunk})
                except Exception as exc:
                    print(f"[chat] LLM stream failed: {exc}")
                    err_msg = _format_llm_error(provider.value, exc)
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
                await usage_service.record_message(bot)
                await db.commit()
                await db.refresh(bot_msg)

                yield _sse("done", {"bot_message": _msg_to_dict(bot_msg)})
            except Exception as exc:
                print(f"[chat] stream error: {exc}")
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

        if not (bot_slug and content):
            yield _sse("error", {"message": "bot_id, content가 필요합니다."})
            return

        async with SessionLocal() as db:
            chat_repo = ChatRepository(db)
            bot_repo = BotRepository(db)
            api_key_repo = ApiKeyRepository(db)
            api_key_service = ApiKeyService(api_key_repo)

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

                effective_model = _resolve_effective_model(preview_bot.model, None)
                provider = resolve_provider(effective_model)
                api_key = (
                    await api_key_service.get_decrypted_key(user_id, provider)
                ) or ""

                vec_id = (
                    preview_bot.vector_store_id
                    if provider == Provider.OPENAI
                    else None
                )
                system = _build_system_prompt(preview_bot, vec_id)
                history = await chat_repo.find_messages(session.id)
                api_messages = [
                    {
                        "role": "user" if m.role == MessageRole.USER else "assistant",
                        "content": m.content,
                    }
                    for m in history
                ]

                full_text = ""
                try:
                    async for chunk in self.llm_service.chat_stream(
                        model=effective_model,
                        system_prompt=system,
                        messages=api_messages,
                        api_key=api_key,
                        vector_store_id=vec_id,
                        enable_web_search=_should_enable_web_search(preview_bot),
                    ):
                        full_text += chunk
                        yield _sse("chunk", {"text": chunk})
                except Exception as exc:
                    print(f"[preview] LLM stream failed: {exc}")
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
                await db.commit()
                await db.refresh(bot_msg)

                yield _sse("done", {"bot_message": _msg_to_dict(bot_msg)})
            except Exception as exc:
                print(f"[preview] stream error: {exc}")
                yield _sse("error", {"message": str(exc)})

    async def quick_stream(
        self, body: dict, user_id: int
    ) -> AsyncGenerator[str, None]:
        """저장되지 않은 봇의 즉시 미리보기. DB 저장 없음.
        body: {content, model, system_prompt?, training_text?, fallback?, history?[]}
        """
        content = (body.get("content") or "").strip()
        model = (body.get("model") or "").strip()

        if not (content and model):
            yield _sse("error", {"message": "content, model이 필요합니다."})
            return

        async with SessionLocal() as db:
            api_key_repo = ApiKeyRepository(db)
            api_key_service = ApiKeyService(api_key_repo)

            try:
                preview_bot = SimpleNamespace(
                    user_id=user_id,
                    model=model,
                    system_prompt=body.get("system_prompt"),
                    training_text=body.get("training_text"),
                    fallback=body.get("fallback"),
                    training_type=body.get("training_type") or "text",
                    vector_store_id=None,
                )

                effective_model = _resolve_effective_model(preview_bot.model, None)
                provider = resolve_provider(effective_model)
                api_key = (
                    await api_key_service.get_decrypted_key(user_id, provider)
                ) or ""

                system = _build_system_prompt(preview_bot, None)

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
                try:
                    async for chunk in self.llm_service.chat_stream(
                        model=effective_model,
                        system_prompt=system,
                        messages=api_messages,
                        api_key=api_key,
                        vector_store_id=None,
                        enable_web_search=_should_enable_web_search(preview_bot),
                    ):
                        full_text += chunk
                        yield _sse("chunk", {"text": chunk})
                except Exception as exc:
                    print(f"[quick-preview] LLM stream failed: {exc}")
                    err_msg = _format_llm_error(provider.value, exc)
                    full_text += err_msg
                    yield _sse("chunk", {"text": err_msg})

                if not full_text.strip():
                    full_text = (preview_bot.fallback or "").strip() or "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
                    yield _sse("chunk", {"text": full_text})

                yield _sse("done", {})
            except Exception as exc:
                print(f"[quick-preview] stream error: {exc}")
                yield _sse("error", {"message": str(exc)})

    # ── 대시보드 (with_login) ─────────────────
    async def list_sessions(self, request):
        """query: bot_id(=slug) (optional). 안 주면 사용자 모든 봇의 세션."""
        user_id = request.user_id
        bot_slug = request.query_params.get("bot_id")

        if bot_slug:
            bot = await self.bot_repo.find_by_slug(bot_slug)
            if not bot or bot.user_id != user_id:
                fail("권한이 없습니다.", "FORBIDDEN", 403)
            sessions = await self.chat_repo.find_sessions_by_bot(bot.id)
            bot_id_to_slug = {bot.id: bot.slug}
        else:
            user_bots = await self.bot_repo.find_by_user(user_id)
            sessions = []
            for b in user_bots:
                sessions.extend(await self.chat_repo.find_sessions_by_bot(b.id))
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

        messages = await self.chat_repo.find_messages(session.id)
        session_dict = _session_to_dict(session)
        session_dict["bot_id"] = bot.slug  # 외부엔 slug로 노출
        return success(
            data={
                "session": session_dict,
                "messages": [_msg_to_dict(m) for m in messages],
            }
        )
