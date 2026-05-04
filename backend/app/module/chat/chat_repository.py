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
