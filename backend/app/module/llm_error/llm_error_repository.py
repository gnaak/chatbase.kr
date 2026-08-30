from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.module.llm_error.llm_error import LlmError, LlmErrorChannel, LlmErrorKind

logger = get_logger(__name__)

#: 저장할 예외 원문 길이. 컬럼 상한(500)과 맞춘다.
MESSAGE_MAX = 500


class LlmErrorRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record(
        self,
        *,
        bot_id: int,
        channel: LlmErrorChannel,
        kind: LlmErrorKind,
        provider: str,
        model: str,
        message: str,
    ) -> None:
        """오류 1건 적재. **커밋하지 않는다** — 호출부의 트랜잭션에 얹힌다.

        기록 실패가 방문자 응답을 막으면 안 된다. 이미 LLM이 터진 상황이라
        여기서 또 예외를 올리면 fallback 문구조차 못 나간다. 그래서 삼켜버리고
        로그만 남긴다 — 통계 숫자 하나보다 응답이 나가는 쪽이 중요하다.
        """
        try:
            self.db.add(
                LlmError(
                    bot_id=bot_id,
                    channel=channel,
                    kind=kind,
                    provider=(provider or "")[:20],
                    model=(model or "")[:50],
                    message=(message or "")[:MESSAGE_MAX],
                )
            )
            await self.db.flush()
        except Exception:
            logger.exception("LLM 오류 기록 실패 bot=%s kind=%s", bot_id, kind)

    async def count_by_kind_since(
        self, bot_ids: list[int], since: datetime
    ) -> list[tuple[str, int]]:
        """`(kind, 건수)`. 화면이 "무엇을 고쳐야 하는지"를 말하려면 종류가 필요하다."""
        if not bot_ids:
            return []
        result = await self.db.execute(
            select(LlmError.kind, func.count())
            .where(LlmError.bot_id.in_(bot_ids), LlmError.created_at >= since)
            .group_by(LlmError.kind)
        )
        return [(kind.value if hasattr(kind, "value") else str(kind), n) for kind, n in result.all()]

    async def last_at(self, bot_ids: list[int], since: datetime) -> datetime | None:
        """마지막 발생 시각. "지금도 나고 있는지"와 "아까 잠깐이었는지"를 가른다."""
        if not bot_ids:
            return None
        result = await self.db.execute(
            select(func.max(LlmError.created_at)).where(
                LlmError.bot_id.in_(bot_ids), LlmError.created_at >= since
            )
        )
        return result.scalar()
