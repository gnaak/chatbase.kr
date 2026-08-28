from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.bot.bot import Bot
from app.module.chat.chat_message import ChatMessage, MessageRole
from app.module.chat.chat_session import ChatSession

#: 한 번에 훑는 메시지 상한.
#: fallback 직전 질문을 찾으려면 (세션, 순서)를 알아야 해서 메시지를 한 번에 읽고
#: 파이썬에서 걷는다. SQL 윈도 함수로 짜는 것보다 단순하고 결과가 같다.
#: 대화가 이 이상 쌓이면 집계 방식을 바꿔야 한다 — 그때 이 상수가 신호가 된다.
MESSAGE_SCAN_LIMIT = 20000


class StatsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_bots(self, user_id: int) -> list[Bot]:
        result = await self.db.execute(
            select(Bot).where(Bot.user_id == user_id).order_by(Bot.id)
        )
        return list(result.scalars().all())

    async def sessions_in_period(
        self, bot_ids: list[int], since: datetime
    ) -> list[tuple[int, int, str, datetime]]:
        """기간 내 활동한 세션 `(session_id, bot_id, visitor_id, started_at)`.

        `last_message_at` 기준이라 예전에 시작해 최근에 다시 대화한 세션도 들어온다.
        `started_at`을 함께 주는 이유는 "한 번 묻고 떠남"을 **기간 내 시작된 세션**
        에서만 세야 하기 때문이다. 재방문 세션을 이탈로 잡으면 안 된다.

        visitor_id로 유입 채널을 가른다 — `kakao:` 접두사면 카카오톡,
        `preview-`면 대시보드 미리보기(통계에서 제외), 나머지는 위젯.
        """
        if not bot_ids:
            return []
        result = await self.db.execute(
            select(
                ChatSession.id,
                ChatSession.bot_id,
                ChatSession.visitor_id,
                ChatSession.started_at,
            ).where(
                ChatSession.bot_id.in_(bot_ids),
                ChatSession.last_message_at >= since,
            )
        )
        return [(r[0], r[1], r[2], r[3]) for r in result.all()]

    async def messages_in_sessions(
        self, session_ids: list[int], since: datetime
    ) -> list[tuple[int, int, MessageRole, str, datetime]]:
        """`(session_id, id, role, content, created_at)`. id 순으로 정렬.

        **`since`로 메시지도 걸러야 한다.** 세션은 `last_message_at`으로 고르는데,
        오래 전에 시작해 최근에 한 번 더 대화한 세션이 있다. 메시지를 안 거르면
        "최근 7일"을 골라도 그 세션의 옛 메시지까지 전부 집계돼서 기간 선택이
        무의미해진다.

        created_at이 아니라 id로 정렬한다 — created_at은 초 단위라 같은 초에 들어온
        질문/답변의 순서가 뒤집힐 수 있고, fallback 직전 질문을 잘못 짚게 된다.
        """
        if not session_ids:
            return []
        result = await self.db.execute(
            select(
                ChatMessage.session_id,
                ChatMessage.id,
                ChatMessage.role,
                ChatMessage.content,
                ChatMessage.created_at,
            )
            .where(
                ChatMessage.session_id.in_(session_ids),
                ChatMessage.created_at >= since,
            )
            .order_by(ChatMessage.session_id, ChatMessage.id)
            .limit(MESSAGE_SCAN_LIMIT)
        )
        return [(r[0], r[1], r[2], r[3], r[4]) for r in result.all()]

    async def message_count(self, session_ids: list[int], since: datetime) -> int:
        """상한에 걸렸는지 판단하기 위한 실제 총계. 조건이 위와 같아야 한다."""
        if not session_ids:
            return 0
        result = await self.db.execute(
            select(func.count())
            .select_from(ChatMessage)
            .where(
                ChatMessage.session_id.in_(session_ids),
                ChatMessage.created_at >= since,
            )
        )
        return result.scalar_one()
