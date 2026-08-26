from sqlalchemy import func, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.base import now_kst
from app.module.bot.bot import Bot
from app.module.usage.usage import UsageMonthly


def current_year_month() -> str:
    """KST 기준 "YYYY-MM"."""
    return now_kst().strftime("%Y-%m")


class UsageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def increment(self, user_id: int, bot_id: int, year_month: str) -> None:
        """봇×월 카운터 +1. 행이 없으면 만든다.

        `INSERT ... ON DUPLICATE KEY UPDATE`로 한 번에 처리한다.
        SELECT 후 UPDATE로 나누면 동시 요청에서 카운트가 새는데,
        uq_usage_bot_month 제약과 함께 쓰면 경쟁 상태 없이 올라간다.
        """
        stmt = mysql_insert(UsageMonthly).values(
            user_id=user_id,
            bot_id=bot_id,
            year_month=year_month,
            message_count=1,
        )
        stmt = stmt.on_duplicate_key_update(
            message_count=UsageMonthly.message_count + 1,
            updated_at=now_kst(),
        )
        await self.db.execute(stmt)

    async def total_for_user(self, user_id: int, year_month: str) -> int:
        """해당 월 사용자 전체 대화 건수. 한도 판정에 쓴다."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(UsageMonthly.message_count), 0)).where(
                UsageMonthly.user_id == user_id,
                UsageMonthly.year_month == year_month,
            )
        )
        return int(result.scalar() or 0)

    async def by_bot_for_user(
        self, user_id: int, year_month: str
    ) -> list[tuple[int, str | None, int]]:
        """봇별 사용량 `(bot_id, bot_name, message_count)`.

        이름까지 함께 뽑는다 — 대시보드에 `#3` 같은 id를 노출하면 쓸 수 없다.
        봇이 삭제되면 카운터도 CASCADE로 지워지지만, 조인이 비는 경우를 대비해
        outer join으로 두고 이름은 nullable로 받는다.
        """
        result = await self.db.execute(
            select(
                UsageMonthly.bot_id,
                Bot.name,
                UsageMonthly.message_count,
            )
            .join(Bot, Bot.id == UsageMonthly.bot_id, isouter=True)
            .where(
                UsageMonthly.user_id == user_id,
                UsageMonthly.year_month == year_month,
            )
            .order_by(UsageMonthly.message_count.desc())
        )
        return [(r[0], r[1], r[2]) for r in result.all()]
