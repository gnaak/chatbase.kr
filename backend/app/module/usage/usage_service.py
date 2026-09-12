import logging
from types import SimpleNamespace

from app.core.utils.plan import resolve_plan
from app.module.payment.plan_lookup import limits_of, plan_of
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
#:
#: "플랜을 올리면 제한 없이"라고 쓰지 않는다 — 이제 유료 플랜에도 한도가 있다.
#: 실제로 한도가 풀리는 길은 내 키 등록이고, 그게 우리 원가도 같이 없앤다.
QUOTA_MESSAGE = (
    "이번 달 대화 한도를 모두 사용했습니다. "
    "API 키 화면에서 내 OpenAI 키를 등록하면 건수 제한 없이 이어서 쓸 수 있고, "
    "플랜을 올리면 한도가 커집니다."
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

    async def _limits_of(self, user_id: int):
        """챗봇 상품의 플랜 한도."""
        return await limits_of(self.usage_repo.db, user_id)

    # ── 대화 경로에서 호출 ──────────────────────
    async def is_blocked(self, bot) -> bool:
        """이 요청을 막아야 하는가. 월 대화 한도 초과 여부.

        한도는 **우리가 키를 내주는 대화에만** 건다. 내 키로 도는 대화는 우리
        원가가 0이라 조일 이유가 없다 — `plan.py` 머리말 참고.

        FREE 도 예외가 아니다. FREE 사용자가 내 키를 등록하면 100건 제한이
        풀린다. 그래도 괜찮다 — FREE 로 묶어두려는 건 우리 지출이지 사용량
        자체가 아니고, 키를 등록할 사람은 어차피 원가를 스스로 감당한다.
        """
        limits = await self._limits_of(bot.user_id)
        if limits.monthly_messages is None:
            return False

        if not await self._bills_us(bot):
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

    async def _bills_us(self, bot) -> bool:
        """이 봇의 대화 사용료가 우리한테 오는가. 실패하면 **True**.

        못 읽었다고 한도를 풀어버리면 우리 키로 무제한이 열린다. 반대로 잘못
        막으면 대화 한 번이 안 되는 것이라, 여기서는 막는 쪽이 덜 비싸다.
        """
        from app.module.api_key.api_key_repository import ApiKeyRepository
        from app.module.api_key.api_key_service import ApiKeyService, bills_us

        db = self.usage_repo.db
        try:
            return await bills_us(
                db, ApiKeyService(ApiKeyRepository(db)), bot.user_id, bot.model
            )
        except Exception:  # noqa: BLE001
            logger.warning(
                "과금 주체 판정 실패 bot_id=%s — 우리 키로 간주", bot.id
            )
            return True

    async def _quota_applies(self, user_id: int) -> bool:
        """이 계정에 월 대화 한도가 걸리는가. 대시보드 표시용.

        `_bills_us` 는 봇 하나(=모델 하나)를 보지만 여기는 계정 단위라 대표값이
        필요하다. 제공 키의 기본 모델로 물어보면 곧 "지금 무료 키를 쓰는 계정인가"
        와 같은 뜻이 된다 — 화면에 필요한 것이 정확히 그것이다.
        """
        from app.module.api_key.api_key_service import SERVICE_MODEL

        return await self._bills_us(SimpleNamespace(user_id=user_id, model=SERVICE_MODEL, id=None))

    async def is_feature_blocked(self, bot, feature: str) -> bool:
        """플랜에 없는 기능인가. `PlanLimits`의 bool 필드명을 그대로 받는다."""
        limits = await self._limits_of(bot.user_id)
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
        raw_plan = await plan_of(self.usage_repo.db, user.id)
        plan = resolve_plan(raw_plan)
        limits = await self._limits_of(user.id)

        used = await self.usage_repo.total_for_user(user.id, year_month)
        rows = await self.usage_repo.by_bot_for_user(user.id, year_month)

        # 내 키로 도는 계정은 한도를 안 받는다(`is_blocked` 와 같은 판정).
        # 이걸 안 보면 내 키를 쓰는 사람에게 "8,000/10,000 곧 소진" 경고가
        # 뜨는데, 실제로는 아무리 써도 안 막힌다. 없는 벽을 보여주는 셈이다.
        limit = limits.monthly_messages if await self._quota_applies(user.id) else None

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
                # 게이팅 판정은 서버가 한다. 프론트가 플랜 이름을 비교하면
                # 카카오를 포함하는 플랜이 늘어날 때 조용히 어긋난다.
                "kakao_channel": limits.kakao_channel,
                # 같은 이유로 다국어도 값으로 내려보낸다.
                # 지금은 GLOBAL만 true지만, 프론트에 `plan === "global"`을
                # 심어두면 플랜이 늘어날 때 화면이 조용히 틀어진다.
                "multilingual": limits.multilingual,
                # 파일 학습과 보관 기간도 같은 이유로 값으로 내려보낸다.
                # 프론트가 이걸 안 보면 FREE 사용자에게 파일 탭을 띄워놓고
                # 업로드 순간 403 을 던지게 된다.
                "file_learning": limits.file_learning,
                "history_days": limits.history_days,
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
