from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.chat.chat_message import ChatMessage, MessageRole
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

    async def find_last_messages(
        self,
        session_ids: list[int],
        role: MessageRole | None = None,
    ) -> dict[int, ChatMessage]:
        """여러 세션의 마지막 메시지를 한 번의 쿼리로. 반환: {session_id: 메시지}

        role을 주면 해당 역할의 마지막 메시지만 고른다.

        목록 화면의 미리보기용. 세션마다 find_messages를 부르면 쿼리 수가
        세션 수만큼 늘고, 한 줄 미리보기를 만들려고 그 세션의 모든 메시지를
        읽어오게 된다.

        최신 판정은 created_at이 아니라 id로 한다. created_at은 초 단위라 같은 초에
        들어온 질문/답변의 순서가 뒤집힐 수 있다.
        """
        if not session_ids:
            return {}

        conditions = [ChatMessage.session_id.in_(session_ids)]
        if role is not None:
            conditions.append(ChatMessage.role == role)

        latest = (
            select(
                ChatMessage.session_id.label("session_id"),
                func.max(ChatMessage.id).label("max_id"),
            )
            .where(*conditions)
            .group_by(ChatMessage.session_id)
            .subquery()
        )

        result = await self.db.execute(
            select(ChatMessage).join(latest, ChatMessage.id == latest.c.max_id)
        )
        return {m.session_id: m for m in result.scalars().all()}

    async def add_message(self, message: ChatMessage) -> ChatMessage:
        self.db.add(message)
        await self.db.flush()
        return message
