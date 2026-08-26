import logging

from app.core.config.settings import settings
from app.core.utils.plan import limits_for, resolve_plan
from app.core.utils.response import fail, success
from app.module.usage.usage_repository import UsageRepository, current_year_month

logger = logging.getLogger(__name__)

#: 이 비율을 넘으면 대시보드에서 "곧 소진" 경고를 띄운다.
WARN_RATIO = 0.8

#: 플랜에 없는 기능을 쓰려 할 때의 안내.
PLAN_FEATURE_MESSAGE = (
    "이 기능은 상위 플랜에서 이용할 수 있습니다. "
    "대시보드 > 결제에서 플랜을 확인해 주세요."
)

#: 한도 초과 안내. HTTP(fail)와 SSE(error 이벤트) 양쪽에서 같은 문구를 쓴다.
QUOTA_MESSAGE = (
    "이번 달 대화 한도를 모두 사용했습니다. "
    "플랜을 올리면 제한 없이 이용할 수 있습니다."
)


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
        """이 요청을 막아야 하는가.

        `settings.enforce_plan_limits`가 False면 초과를 로그만 남기고 False를 준다.
        결제(토스페이먼츠)가 붙기 전에 차단을 켜면 Free 사용자가 한도를 쓴 뒤
        업그레이드할 방법 없이 갇히기 때문이다. 계측은 플래그와 무관하게 항상 돈다.
        """
        limits = limits_for(await self._plan_of(bot.user_id))
        if limits.monthly_messages is None:
            return False

        used = await self.usage_repo.total_for_user(
            bot.user_id, current_year_month()
        )
        if used < limits.monthly_messages:
            return False

        if not settings.enforce_plan_limits:
            logger.info(
                "quota exceeded but enforcement off user_id=%s used=%s limit=%s",
                bot.user_id,
                used,
                limits.monthly_messages,
            )
            return False
        return True

    async def is_feature_blocked(self, bot, feature: str) -> bool:
        """플랜에 없는 기능인가. `PlanLimits`의 bool 필드명을 그대로 받는다.

        한도(`is_blocked`)와 같은 규칙 — `enforce_plan_limits`가 꺼져 있으면
        로그만 남기고 통과시킨다.
        """
        limits = limits_for(await self._plan_of(bot.user_id))
        if getattr(limits, feature, True):
            return False
        if not settings.enforce_plan_limits:
            logger.info(
                "feature %s not in plan but enforcement off user_id=%s",
                feature,
                bot.user_id,
            )
            return False
        return True

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

        return success(
            data={
                "plan": plan.value,
                "year_month": year_month,
                "messages_used": used,
                "messages_limit": limit,
                "unlimited": limit is None,
                "warn": limit is not None and used >= limit * WARN_RATIO,
                "exceeded": limit is not None and used >= limit,
                "enforced": settings.enforce_plan_limits,
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
