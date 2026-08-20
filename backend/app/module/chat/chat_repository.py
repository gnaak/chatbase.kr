from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.chat.chat_message import ChatMessage
from app.module.chat.chat_session import ChatSession


class ChatRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 세션 ─────────────────────────────────
    async def find_session(self, session_id: int) -> ChatSession | None:
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def find_sessions_by_bot(self, bot_id: int) -> list[ChatSession]:
        result = await self.db.execute(
            select(ChatSession)
            .where(ChatSession.bot_id == bot_id)
            .order_by(ChatSession.last_message_at.desc())
        )
        return list(result.scalars().all())

    async def find_latest_session_by_visitor(
        self,
        bot_id: int,
        visitor_id: str,
    ) -> ChatSession | None:
        result = await self.db.execute(
            select(ChatSession)
            .where(
                ChatSession.bot_id == bot_id,
                ChatSession.visitor_id == visitor_id,
            )
            .order_by(ChatSession.last_message_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def find_latest_session_by_prefix(
        self,
        bot_id: int,
        prefix: str,
    ) -> ChatSession | None:
        """visitor_id 접두사로 유입 채널(예: kakao:)별 최근 세션을 찾는다."""
        result = await self.db.execute(
            select(ChatSession)
            .where(
                ChatSession.bot_id == bot_id,
                ChatSession.visitor_id.like(f"{prefix}%"),
            )
            .order_by(ChatSession.last_message_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def add_session(self, session: ChatSession) -> ChatSession:
        self.db.add(session)
        await self.db.flush()
        return session

    # ── 메시지 ───────────────────────────────
    async def find_messages(self, session_id: int) -> list[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        return list(result.scalars().all())

    async def add_message(self, message: ChatMessage) -> ChatMessage:
        self.db.add(message)
        await self.db.flush()
        return message
