"""상품별 유효 플랜 조회.

게이팅의 단일 소스가 `tb_users.plan`에서 `tb_subscriptions.plan`으로 옮겨왔다.
상품이 둘이 되면서 사용자 테이블의 컬럼 하나로는 표현이 안 되기 때문이다 —
`user.plan`은 이름만 plan이지 사실상 "챗봇 플랜"이었다.

**동작은 전과 같다.** `payment_service`가 `sub.plan`과 `user.plan`을 늘 같이
갱신해 왔다(구독 성공 시 둘 다 설정, 만료 시 둘 다 해제). 그래서 읽는 쪽만
`sub.plan`으로 바꿔도 결과가 달라지지 않는다.

상태별 취급도 그대로다:
- ACTIVE / PAST_DUE — `sub.plan`이 살아 있다. 재시도 중에는 권한을 유지한다
- CANCELED — 남은 기간은 그대로 쓴다. `next_billing_at`에 `_expire`가 비운다
- NONE / 구독 없음 — `None` → FREE
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils.plan import PlanLimits, Product, limits_for
from app.module.payment.payment import Subscription


async def plan_of(
    db: AsyncSession,
    user_id: int,
    product: Product = Product.CHATBOT,
) -> str | None:
    """해당 상품의 현재 플랜 문자열. 구독이 없으면 None(= FREE)."""
    result = await db.execute(
        select(Subscription.plan).where(
            Subscription.user_id == user_id,
            Subscription.product == product,
        )
    )
    return result.scalar_one_or_none()


async def limits_of(
    db: AsyncSession,
    user_id: int,
    product: Product = Product.CHATBOT,
) -> PlanLimits:
    """해당 상품의 플랜 한도. 게이팅은 전부 이걸 거친다."""
    return limits_for(await plan_of(db, user_id, product))
