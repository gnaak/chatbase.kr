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

    async def find_sessions_by_bot(
        self, bot_id: int, since=None
    ) -> list[ChatSession]:
        """`since` 를 주면 그 시각 이후 대화만. 플랜의 보관 기간에 쓴다.

        `last_message_at` 기준이다. 시작 시각으로 자르면 오래 전에 시작해서
        지금도 이어지는 대화가 사라진다 — 사용자는 방금 온 질문을 못 본다.
        """
        conditions = [ChatSession.bot_id == bot_id]
        if since is not None:
            conditions.append(ChatSession.last_message_at >= since)
        result = await self.db.execute(
            select(ChatSession)
            .where(*conditions)
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
    async def find_messages(
        self, session_id: int, limit: int | None = None
    ) -> list[ChatMessage]:
        """세션의 메시지. `limit`을 주면 **최근 N개**만, 순서는 그대로 오래된 것부터.

        기본값이 무제한인 이유: 대화 로그 화면(`get_session_messages`)은 전부
        보여줘야 한다. 자르는 건 LLM에 보낼 때만이라, 자르는 쪽이 명시적으로
        넘기게 두는 편이 안전하다. 기본값을 제한으로 두면 어느 날 로그 화면이
        조용히 잘린다.

        ⚠️ LLM 경로에서 이걸 안 넘기면 원가가 세션 길이에 비례해 늘어난다.
        같은 "대화 1건"인데 30번째 질문이 첫 질문의 몇 배가 된다. 건수 쿼터가
        지출 상한 구실을 못 하게 되는 지점이 여기다.
        """
        stmt = select(ChatMessage).where(ChatMessage.session_id == session_id)
        # created_at은 초 단위라 같은 초에 들어온 질문/답변의 순서가 뒤집힌다.
        # 아래 find_last_messages와 같은 이유로 id를 쓴다.
        if limit is None:
            result = await self.db.execute(stmt.order_by(ChatMessage.id.asc()))
            return list(result.scalars().all())

        # 최근 N개를 뽑으려면 내림차순으로 자르고 되돌린다.
        # 오름차순 + LIMIT 은 **앞쪽** N개라 정반대가 된다.
        result = await self.db.execute(
            stmt.order_by(ChatMessage.id.desc()).limit(limit)
        )
        return list(reversed(result.scalars().all()))

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
