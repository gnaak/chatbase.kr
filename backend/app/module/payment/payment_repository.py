from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.payment.payment import (
    BillingMethod,
    Payment,
    Subscription,
    SubscriptionStatus,
)


class PaymentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 구독 ────────────────────────────────────
    async def find_subscription(self, user_id: int) -> Subscription | None:
        result = await self.db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def find_due_subscriptions(self, now) -> list[Subscription]:
        """청구일이 지난 구독. 해지 예정 건도 포함한다 — 그 날 만료시켜야 한다.

        with_for_update: 크론이 겹쳐 실행돼도 같은 구독을 두 번 청구하지 않도록 잠근다.
        """
        result = await self.db.execute(
            select(Subscription)
            .where(
                Subscription.status.in_(
                    [
                        SubscriptionStatus.ACTIVE,
                        SubscriptionStatus.PAST_DUE,
                        SubscriptionStatus.CANCELED,
                    ]
                ),
                Subscription.next_billing_at.isnot(None),
                Subscription.next_billing_at <= now,
            )
            .order_by(Subscription.id)
            .with_for_update(skip_locked=True)
        )
        return list(result.scalars().all())

    async def add_subscription(self, subscription: Subscription) -> Subscription:
        self.db.add(subscription)
        await self.db.flush()
        return subscription

    # ── 결제수단 ────────────────────────────────
    async def find_methods_by_user(self, user_id: int) -> list[BillingMethod]:
        result = await self.db.execute(
            select(BillingMethod)
            .where(BillingMethod.user_id == user_id)
            .order_by(BillingMethod.is_default.desc(), BillingMethod.created_at.desc())
        )
        return list(result.scalars().all())

    async def find_method(self, user_id: int, method_id: int) -> BillingMethod | None:
        """소유자까지 함께 건다 — 남의 카드 id를 넘겨도 잡히지 않게."""
        result = await self.db.execute(
            select(BillingMethod).where(
                BillingMethod.id == method_id, BillingMethod.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def find_default_method(self, user_id: int) -> BillingMethod | None:
        result = await self.db.execute(
            select(BillingMethod).where(
                BillingMethod.user_id == user_id, BillingMethod.is_default.is_(True)
            )
        )
        return result.scalars().first()

    async def add_method(self, method: BillingMethod) -> BillingMethod:
        self.db.add(method)
        await self.db.flush()
        return method

    async def clear_default(self, user_id: int) -> None:
        """기본 카드는 사용자당 하나. 새로 지정하기 전에 전부 내린다."""
        await self.db.execute(
            update(BillingMethod)
            .where(BillingMethod.user_id == user_id)
            .values(is_default=False)
        )

    async def delete_method(self, method: BillingMethod) -> None:
        await self.db.delete(method)

    # ── 결제 ────────────────────────────────────
    async def add_payment(self, payment: Payment) -> Payment:
        self.db.add(payment)
        await self.db.flush()
        return payment

    async def find_payments_by_user(
        self, user_id: int, limit: int = 20
    ) -> list[Payment]:
        result = await self.db.execute(
            select(Payment)
            .where(Payment.user_id == user_id)
            .order_by(Payment.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
