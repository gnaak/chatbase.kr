import json
from typing import AsyncGenerator

from app.core.database.base import SessionLocal, now_kst
from app.core.utils.response import fail, success
from app.module.api_key.api_key_repository import ApiKeyRepository
from app.module.api_key.api_key_service import ApiKeyService
from app.module.bot.bot_repository import BotRepository
from app.module.chat.chat_message import ChatMessage, MessageRole
from app.module.chat.chat_repository import ChatRepository
from app.module.chat.chat_session import ChatSession
from app.module.infra.llm.llm_service import LLMService, resolve_provider


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
    ):
        self.chat_repo = chat_repo
        self.bot_repo = bot_repo
        self.api_key_service = api_key_service
        self.llm_service = llm_service

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

        if not (bot_slug and visitor_id and content):
            fail("bot_id, visitor_id, content가 필요합니다.", "BAD_REQUEST")

        bot = await self.bot_repo.find_by_slug(bot_slug)
        if not bot or not bot.active:
            fail("이 챗봇은 현재 사용할 수 없습니다.", "BOT_UNAVAILABLE", 404)

        # 1) 세션 확보
        if session_id:
            session = await self.chat_repo.find_session(int(session_id))
            if not session or session.bot_id != bot.id:
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

        # 3) BYOK 키 확보
        provider = resolve_provider(bot.model)
        api_key = await self.api_key_service.get_decrypted_key(bot.user_id, provider)
        if not api_key:
            await self.chat_repo.db.commit()
            fail(
                f"{provider.value} API 키가 등록되어 있지 않습니다.",
                "API_KEY_MISSING",
                424,
            )

        # 4) LLM 호출 — 학습 데이터를 시스템 프롬프트에 합성
        history = await self.chat_repo.find_messages(session.id)
        api_messages = [
            {
                "role": "user" if m.role == MessageRole.USER else "assistant",
                "content": m.content,
            }
            for m in history
        ]

        system = (bot.system_prompt or "").strip()
        if bot.training_text:
            system = (
                (system + "\n\n" if system else "")
                + "다음은 답변에 활용할 참고 자료입니다:\n"
                + bot.training_text
            )

        try:
            answer = await self.llm_service.chat(
                model=bot.model,
                system_prompt=system,
                messages=api_messages,
                api_key=api_key,
            )
        except Exception as exc:
            answer = bot.fallback or "죄송합니다, 답변을 생성하지 못했습니다."
            # LLM 실패는 fallback으로 안내. 로그는 추후 통합.
            print(f"[chat] LLM call failed: {exc}")

        if not answer.strip():
            answer = bot.fallback or "죄송합니다, 답변을 생성하지 못했습니다."

        # 5) 봇 메시지 저장 + 세션 갱신
        bot_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.BOT,
            content=answer,
        )
        await self.chat_repo.add_message(bot_msg)

        session.last_message_at = now_kst()
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
    async def stream_message(self, request) -> AsyncGenerator[str, None]:
        """SSE 청크를 yield. 라우터에서 StreamingResponse로 감싸서 반환.

        주입된 self.chat_repo/bot_repo의 세션은 라우터 return 후 dependency
        cleanup으로 닫히므로, 이 메서드는 자체 SessionLocal 컨텍스트를 연다.
        """
        try:
            body = await request.json()
        except Exception as exc:
            yield _sse("error", {"message": f"본문 파싱 실패: {exc}"})
            return

        bot_slug = (body.get("bot_id") or "").strip()
        visitor_id = (body.get("visitor_id") or "").strip()
        content = (body.get("content") or "").strip()
        session_id = body.get("session_id")

        if not (bot_slug and visitor_id and content):
            yield _sse("error", {"message": "bot_id, visitor_id, content가 필요합니다."})
            return

        async with SessionLocal() as db:
            chat_repo = ChatRepository(db)
            bot_repo = BotRepository(db)
            api_key_repo = ApiKeyRepository(db)
            api_key_service = ApiKeyService(api_key_repo)

            try:
                bot = await bot_repo.find_by_slug(bot_slug)
                if not bot or not bot.active:
                    yield _sse("error", {"message": "이 챗봇은 현재 사용할 수 없습니다."})
                    return

                if session_id:
                    session = await chat_repo.find_session(int(session_id))
                    if not session or session.bot_id != bot.id:
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

                yield _sse(
                    "meta",
                    {
                        "session_id": session.id,
                        "user_message": _msg_to_dict(user_msg),
                    },
                )

                provider = resolve_provider(bot.model)
                api_key = await api_key_service.get_decrypted_key(bot.user_id, provider)
                if not api_key:
                    fallback = bot.fallback or "API 키가 등록되어 있지 않습니다."
                    bot_msg = ChatMessage(
                        session_id=session.id,
                        role=MessageRole.BOT,
                        content=fallback,
                    )
                    await chat_repo.add_message(bot_msg)
                    session.last_message_at = now_kst()
                    await db.commit()
                    await db.refresh(bot_msg)
                    yield _sse("chunk", {"text": fallback})
                    yield _sse("done", {"bot_message": _msg_to_dict(bot_msg)})
                    return

                system = (bot.system_prompt or "").strip()
                if bot.training_text:
                    system = (
                        (system + "\n\n" if system else "")
                        + "다음은 답변에 활용할 참고 자료입니다:\n"
                        + bot.training_text
                    )

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
                        model=bot.model,
                        system_prompt=system,
                        messages=api_messages,
                        api_key=api_key,
                    ):
                        full_text += chunk
                        yield _sse("chunk", {"text": chunk})
                except Exception as exc:
                    print(f"[chat] LLM stream failed: {exc}")
                    if not full_text.strip():
                        full_text = bot.fallback or "죄송합니다, 답변을 생성하지 못했습니다."
                        yield _sse("chunk", {"text": full_text})

                if not full_text.strip():
                    full_text = bot.fallback or "죄송합니다, 답변을 생성하지 못했습니다."
                    yield _sse("chunk", {"text": full_text})

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
                print(f"[chat] stream error: {exc}")
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

        # preview = 첫 사용자 메시지
        result = []
        for s in sessions:
            msgs = await self.chat_repo.find_messages(s.id)
            preview = next(
                (m.content for m in msgs if m.role == MessageRole.USER), None
            )
            d = _session_to_dict(s, preview)
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
