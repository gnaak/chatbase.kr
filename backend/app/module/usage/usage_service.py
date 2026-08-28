import logging

from app.core.utils.plan import limits_for, resolve_plan
from app.core.utils.response import fail, success
from app.module.usage.usage_repository import UsageRepository, current_year_month

logger = logging.getLogger(__name__)

#: 이 비율을 넘으면 대시보드에서 "곧 소진" 경고를 띄운다.
WARN_RATIO = 0.8

#: 플랜에 없는 기능을 쓰려 할 때의 안내. **봇 주인에게 보이는 경로에서만 쓴다.**
PLAN_FEATURE_MESSAGE = (
    "이 기능은 상위 플랜에서 이용할 수 있습니다. "
    "대시보드 > 결제에서 플랜을 확인해 주세요."
)

#: 한도 초과 안내. **봇 주인에게 보이는 경로에서만 쓴다.**
QUOTA_MESSAGE = (
    "이번 달 대화 한도를 모두 사용했습니다. "
    "플랜을 올리면 제한 없이 이용할 수 있습니다."
)

#: 봇 주인의 fallback도 비어 있을 때 방문자에게 보낼 마지막 문구.
DEFAULT_UNAVAILABLE_MESSAGE = "지금은 답변을 드릴 수 없습니다. 잠시 후 다시 시도해 주세요."


def visitor_unavailable_message(bot) -> str:
    """플랜/한도로 답변이 막혔을 때 **방문자**에게 보낼 문구.

    위 두 상수를 방문자에게 그대로 보내면 안 된다. 카카오톡 채널이나 위젯의
    상대는 봇 주인이 아니라 그 사람의 고객이다. "대시보드 > 결제에서 플랜을
    확인해 주세요"는 고객에게 의미가 없고, 우리 과금 사정을 남의 고객에게
    노출하는 셈이며, 고객은 자기가 뭘 잘못한 줄 안다.

    봇 주인이 정한 fallback이 있으면 그걸 쓴다. 무슨 말이 나갈지는 주인이
    통제해야 한다. 주인에게는 대시보드에서 따로 알린다.
    """
    return (getattr(bot, "fallback", None) or "").strip() or DEFAULT_UNAVAILABLE_MESSAGE


def usage_service_for(db):
    """자체 세션을 여는 스트리밍 경로용 팩토리.

    `stream_message`는 라우터 반환 후 세션이 닫히는 문제로 자체 SessionLocal을
    열기 때문에, 요청 스코프의 UsageService를 그대로 쓸 수 없다.
    """
    from app.module.usage.usage_repository import UsageRepository
    from app.module.user.user_repository import UserRepository

    return UsageService(UsageRepository(db), UserRepository(db))


class UsageService:
    def __init__(self, usage_repo: UsageRepository, user_repo):
        self.usage_repo = usage_repo
        self.user_repo = user_repo

    async def _plan_of(self, user_id: int) -> str | None:
        user = await self.user_repo.get_user_by_id(user_id)
        return getattr(user, "plan", None) if user else None

    # ── 대화 경로에서 호출 ──────────────────────
    async def is_blocked(self, bot) -> bool:
        """이 요청을 막아야 하는가. 월 대화 한도 초과 여부."""
        limits = limits_for(await self._plan_of(bot.user_id))
        if limits.monthly_messages is None:
            return False

        used = await self.usage_repo.total_for_user(
            bot.user_id, current_year_month()
        )
        if used < limits.monthly_messages:
            return False

        logger.info(
            "quota exceeded user_id=%s used=%s limit=%s",
            bot.user_id,
            used,
            limits.monthly_messages,
        )
        return True

    async def is_feature_blocked(self, bot, feature: str) -> bool:
        """플랜에 없는 기능인가. `PlanLimits`의 bool 필드명을 그대로 받는다."""
        limits = limits_for(await self._plan_of(bot.user_id))
        return not getattr(limits, feature, True)

    async def ensure_can_send(self, bot) -> None:
        """HTTP 경로용. 막아야 하면 429로 끊는다.

        스트리밍 경로는 예외를 던질 수 없으므로 `is_blocked`를 직접 쓴다.
        """
        if await self.is_blocked(bot):
            fail(QUOTA_MESSAGE, "QUOTA_EXCEEDED", 429)

    async def record_message(self, bot) -> None:
        """방문자 질문 1건을 기록한다. 실패해도 대화를 막지 않는다.

        계측 실패가 서비스 장애로 번지면 안 된다 — 카운터가 조금 틀리는 것보다
        챗봇이 답을 못 하는 게 훨씬 나쁘다.
        """
        try:
            await self.usage_repo.increment(
                bot.user_id, bot.id, current_year_month()
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("usage increment failed bot_id=%s: %s", bot.id, exc)

    # ── 대시보드 조회 ───────────────────────────
    async def get_summary(self, request):
        user = await self.user_repo.get_user_by_id(request.user_id)
        if not user:
            fail("사용자를 찾을 수 없습니다.", "USER_NOT_FOUND", 404)

        year_month = current_year_month()
        plan = resolve_plan(getattr(user, "plan", None))
        limits = limits_for(getattr(user, "plan", None))

        used = await self.usage_repo.total_for_user(user.id, year_month)
        rows = await self.usage_repo.by_bot_for_user(user.id, year_month)
        limit = limits.monthly_messages

        # 플랜에 카카오가 없는데 과거 유입 이력이 있으면 = 쓰다가 끊긴 사람.
        # 플랜에 포함돼 있으면 물어볼 필요가 없어 쿼리를 아낀다.
        kakao_in_use = (
            False
            if limits.kakao_channel
            else await self.usage_repo.kakao_in_use(user.id)
        )

        return success(
            data={
                "plan": plan.value,
                "kakao_in_use": kakao_in_use,
                "year_month": year_month,
                "messages_used": used,
                "messages_limit": limit,
                "unlimited": limit is None,
                "warn": limit is not None and used >= limit * WARN_RATIO,
                "exceeded": limit is not None and used >= limit,
                "bots_limit": limits.bots,
                "per_bot": [
                    {
                        "bot_id": bot_id,
                        "bot_name": bot_name,
                        "message_count": count,
                    }
                    for bot_id, bot_name, count in rows
                ],
            }
        )
