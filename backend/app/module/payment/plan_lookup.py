"""상품별 유효 플랜 조회.

게이팅의 단일 소스가 `tb_users.plan`에서 `tb_subscriptions.plan`으로 옮겨왔다.
상품이 둘이 되면서 사용자 테이블의 컬럼 하나로는 표현이 안 되기 때문이다 —
`user.plan`은 이름만 plan이지 사실상 "챗봇 플랜"이었다.

이관이 안전했던 이유: `payment_service`가 두 값을 늘 같이 갱신해 왔다
(구독 성공 시 둘 다 설정, 만료 시 둘 다 해제). 그래서 읽는 쪽을 `sub.plan`으로
바꿔도 결과가 달라지지 않았고, 그 뒤 `user.plan`을 지웠다.

상태별 취급도 그대로다:
- ACTIVE / PAST_DUE — `sub.plan`이 살아 있다. 재시도 중에는 권한을 유지한다
- CANCELED — 남은 기간은 그대로 쓴다. `next_billing_at`에 `_expire`가 비운다
- NONE / 구독 없음 — `None` → FREE
- GRANTED — 관리자가 준 플랜. `next_billing_at`(종료일)이 지났으면 **읽는 시점에** FREE

GRANTED만 읽는 쪽에서 만료를 판정하는 이유: 정기 청구 크론
(`charge_due_subscriptions`)을 **호출하는 곳이 아직 없다**(chatbase/TODO.md 1번).
크론에만 맡기면 종료일이 지나도 영원히 유료로 읽힌다. 돈이 오가는 상태(ACTIVE 등)는
여기서 손대지 않는다 — 그건 청구 결과로만 바뀌어야 한다.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.base import now_kst
from app.core.utils.plan import PlanLimits, Product, limits_for
from app.module.payment.payment import Subscription, SubscriptionStatus


def effective_plan(
    plan: str | None,
    status: SubscriptionStatus | None,
    until: datetime | None,
    now: datetime | None = None,
) -> str | None:
    """구독 행 값으로 지금 유효한 플랜. 기간이 끝난 관리자 지정은 None(= FREE).

    DB에서 읽은 DATETIME은 naive라 비교 기준도 naive KST로 맞춘다
    (backend/CLAUDE.md "시간 — 이미 두 번 걸렸다").
    """
    if status == SubscriptionStatus.GRANTED and until is not None:
        now = now or now_kst().replace(tzinfo=None)
        if until.replace(tzinfo=None) <= now:
            return None
    return plan


async def plan_of(
    db: AsyncSession,
    user_id: int,
    product: Product = Product.CHATBOT,
) -> str | None:
    """해당 상품의 현재 플랜 문자열. 구독이 없으면 None(= FREE)."""
    row = (
        await db.execute(
            select(
                Subscription.plan, Subscription.status, Subscription.next_billing_at
            ).where(
                Subscription.user_id == user_id,
                Subscription.product == product,
            )
        )
    ).one_or_none()
    return effective_plan(*row) if row else None


async def limits_of(
    db: AsyncSession,
    user_id: int,
    product: Product = Product.CHATBOT,
) -> PlanLimits:
    """해당 상품의 플랜 한도. 게이팅은 전부 이걸 거친다."""
    return limits_for(await plan_of(db, user_id, product))
