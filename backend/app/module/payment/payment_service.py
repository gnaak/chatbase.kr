"""토스페이먼츠 자동결제(빌링) 기반 구독 처리.

**카드 등록과 결제를 분리한다.**

  등록: SDK 카드 등록창 → authKey → `register_method`가 billingKey로 교환해 저장.
        결제는 일어나지 않는다. 여러 장 등록할 수 있고 그중 하나가 기본 카드다.
  결제: `subscribe`가 선택된(또는 기본) 카드의 billingKey로 청구하고 플랜을 올린다.
  변경: `set_default_method`가 구독이 가리키는 카드를 바꾼다. 토스 호출은 없다 —
        다음 청구 때 다른 billingKey를 쓰는 것이 전부다.

플랜 게이팅은 전부 `user.plan` 한 컬럼만 본다(`core/utils/plan.py`).
결제가 하는 일은 그 값을 바꾸는 것뿐이다.
"""

import calendar
import logging
import secrets
from datetime import datetime

from app.core.database.base import now_kst
from app.core.utils.encryption import decrypt, encrypt
from app.core.utils.plan import PAID_PLANS, Plan, price_for, resolve_plan
from app.core.utils.response import fail, success
from app.module.infra.toss.toss_service import TossError, TossService
from app.module.payment.payment import (
    BillingMethod,
    BillingMethodType,
    Payment,
    PaymentStatus,
    Subscription,
    SubscriptionStatus,
)
from app.module.payment.payment_repository import PaymentRepository

logger = logging.getLogger(__name__)


def _add_month(base: datetime) -> datetime:
    """한 달 뒤. 말일은 다음 달 마지막 날로 당긴다(1/31 → 2/28)."""
    year = base.year + (base.month // 12)
    month = base.month % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return base.replace(year=year, month=month, day=min(base.day, last_day))


def _method_to_dict(method: BillingMethod) -> dict:
    return {
        "id": method.id,
        "method_type": (
            method.method_type.value
            if method.method_type
            else BillingMethodType.CARD.value
        ),
        "issuer": method.issuer,
        "masked_number": method.masked_number,
        "card_type": method.card_type,
        "is_default": bool(method.is_default),
        "created_at": method.created_at.isoformat() if method.created_at else None,
    }


def _parse_issued(issued: dict) -> dict:
    """빌링키 발급 응답에서 화면에 보여줄 정보를 뽑는다.

    자동결제는 카드만 지원하므로 사실상 `card`만 온다. `transfers[]` 분기는
    응답 스펙에 있는 계좌이체용으로, 토스가 지원하면 코드 수정 없이 받아진다.
    """
    card = issued.get("card") or {}
    transfers = issued.get("transfers") or []

    if card:
        return {
            "method_type": BillingMethodType.CARD,
            # v2는 카드사를 코드(41)로 준다. 이름을 주는 응답도 있어 있으면 그걸 쓴다.
            "issuer": card.get("company") or card.get("issuerCode"),
            "masked_number": card.get("number"),
            "card_type": card.get("cardType"),
        }

    if transfers:
        transfer = transfers[0]
        return {
            "method_type": BillingMethodType.TRANSFER,
            "issuer": transfer.get("bankName") or transfer.get("bankCode"),
            "masked_number": transfer.get("bankAccountNumber"),
            "card_type": None,
        }

    # 수단 정보를 못 받아도 billingKey만 있으면 청구는 된다. 표시만 비워둔다.
    return {
        "method_type": BillingMethodType.CARD,
        "issuer": None,
        "masked_number": None,
        "card_type": None,
    }


def _sub_to_dict(sub: Subscription) -> dict:
    return {
        "customer_key": sub.customer_key,
        "status": sub.status.value if sub.status else SubscriptionStatus.NONE.value,
        "plan": sub.plan,
        "billing_method_id": sub.billing_method_id,
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
        "next_billing_at": (
            sub.next_billing_at.isoformat() if sub.next_billing_at else None
        ),
        "canceled_at": sub.canceled_at.isoformat() if sub.canceled_at else None,
    }


def _payment_to_dict(payment: Payment) -> dict:
    return {
        "order_id": payment.order_id,
        "plan": payment.plan,
        "amount": payment.amount,
        "status": payment.status.value if payment.status else None,
        "method": payment.method,
        "receipt_url": payment.receipt_url,
        "failure_message": payment.failure_message,
        "approved_at": payment.approved_at.isoformat() if payment.approved_at else None,
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
    }


class PaymentService:
    def __init__(
        self,
        payment_repo: PaymentRepository,
        user_repo,
        toss_service: TossService,
    ):
        self.payment_repo = payment_repo
        self.user_repo = user_repo
        self.toss = toss_service

    # ── 내부 헬퍼 ───────────────────────────────
    async def _ensure_subscription(self, user_id: int) -> Subscription:
        """구독 행을 보장한다. 카드 등록 전에도 customer_key가 필요하다."""
        sub = await self.payment_repo.find_subscription(user_id)
        if sub:
            return sub
        sub = Subscription(
            user_id=user_id,
            customer_key=f"cus_{secrets.token_urlsafe(16)}",
            status=SubscriptionStatus.NONE,
        )
        return await self.payment_repo.add_subscription(sub)

    @staticmethod
    def _parse_paid_plan(raw: str | None) -> Plan:
        plan = resolve_plan(raw)
        if plan not in PAID_PLANS:
            fail("결제할 수 있는 플랜이 아닙니다.", "INVALID_PLAN")
        return plan

    @staticmethod
    def _new_order_id(plan: Plan, user_id: int) -> str:
        return f"cb_{plan.value}_{user_id}_{secrets.token_hex(6)}"

    # ── 조회 ────────────────────────────────────
    async def get_config(self, request):
        """프론트 SDK 초기화용. 클라이언트 키는 공개 키라 그대로 내려도 된다."""
        return success(
            data={
                "client_key": self.toss.client_key,
                "prices": {plan.value: price_for(plan) for plan in PAID_PLANS},
            }
        )

    async def get_subscription(self, request):
        sub = await self._ensure_subscription(request.user_id)
        await self.payment_repo.db.commit()
        return success(data=_sub_to_dict(sub))

    async def list_methods(self, request):
        methods = await self.payment_repo.find_methods_by_user(request.user_id)
        return success(data=[_method_to_dict(m) for m in methods])

    async def list_payments(self, request):
        payments = await self.payment_repo.find_payments_by_user(request.user_id)
        return success(data=[_payment_to_dict(p) for p in payments])

    # ── 결제수단 등록 (결제 없음) ───────────────
    async def register_method(self, request):
        """body: {"authKey": "...", "customerKey": "..."}

        카드 등록창을 통과하면 받는 authKey를 billingKey로 교환해 저장만 한다.
        여기서는 청구하지 않는다 — 결제는 `subscribe`가 따로 한다.
        """
        user_id = request.user_id
        body = await request.json()

        auth_key = (body.get("authKey") or "").strip()
        customer_key = (body.get("customerKey") or "").strip()
        if not auth_key or not customer_key:
            fail("카드 등록 정보가 올바르지 않습니다.", "INVALID_BILLING_AUTH")

        sub = await self._ensure_subscription(user_id)
        # 남의 customerKey로 카드를 붙이지 못하게 한다.
        if customer_key != sub.customer_key:
            fail("카드 등록 정보가 올바르지 않습니다.", "CUSTOMER_KEY_MISMATCH", 403)

        try:
            issued = await self.toss.issue_billing_key(auth_key, customer_key)
        except TossError as exc:
            await self.payment_repo.db.rollback()
            fail(exc.message, exc.code, 400 if exc.status_code < 500 else 502)

        billing_key = issued.get("billingKey")
        if not billing_key:
            fail("카드 등록에 실패했습니다.", "BILLING_KEY_MISSING", 502)

        existing = await self.payment_repo.find_methods_by_user(user_id)
        is_first = not existing

        if is_first:
            await self.payment_repo.clear_default(user_id)

        method = await self.payment_repo.add_method(
            BillingMethod(
                user_id=user_id,
                encrypted_billing_key=encrypt(billing_key),
                # 첫 수단은 자동으로 기본이 된다. 두 번째부터는 사용자가 고른다.
                is_default=is_first,
                **_parse_issued(issued),
            )
        )

        # 아직 결제수단이 없던 구독이라면 이 카드를 바로 물려준다.
        if sub.billing_method_id is None:
            sub.billing_method_id = method.id

        await self.payment_repo.db.commit()
        return success(
            data=_method_to_dict(method), message="결제수단이 등록되었습니다."
        )

    async def set_default_method(self, request):
        """body: {"method_id": 1}

        기본 카드를 바꾸고, 구독이 있으면 그 구독의 결제수단도 함께 바꾼다.
        이미 이번 달 결제가 끝난 구독은 재청구하지 않는다 — 다음 청구부터 적용된다.
        """
        user_id = request.user_id
        body = await request.json()
        method_id = body.get("method_id")

        method = await self.payment_repo.find_method(user_id, method_id)
        if not method:
            fail("등록된 결제수단이 아닙니다.", "METHOD_NOT_FOUND", 404)

        await self.payment_repo.clear_default(user_id)
        method.is_default = True

        sub = await self.payment_repo.find_subscription(user_id)
        if sub:
            sub.billing_method_id = method.id

        await self.payment_repo.db.commit()
        return success(
            data=_method_to_dict(method),
            message="다음 결제부터 이 카드로 청구됩니다.",
        )

    async def delete_method(self, request):
        """body: {"method_id": 1}"""
        user_id = request.user_id
        body = await request.json()
        method_id = body.get("method_id")

        method = await self.payment_repo.find_method(user_id, method_id)
        if not method:
            fail("등록된 결제수단이 아닙니다.", "METHOD_NOT_FOUND", 404)

        sub = await self.payment_repo.find_subscription(user_id)
        others = [
            m
            for m in await self.payment_repo.find_methods_by_user(user_id)
            if m.id != method.id
        ]

        # 구독 중인데 카드가 0장이 되면 다음 달 청구가 불가능해진다.
        if sub and sub.status == SubscriptionStatus.ACTIVE and not others:
            fail(
                "구독 중에는 마지막 결제수단을 삭제할 수 없습니다. "
                "다른 수단을 먼저 등록하거나 구독을 해지해 주세요.",
                "LAST_METHOD_IN_USE",
            )

        was_default = bool(method.is_default)
        await self.payment_repo.delete_method(method)

        # 기본 수단을 지웠다면 남은 것 중 하나를 승계시킨다.
        if was_default and others:
            others[0].is_default = True
            if sub:
                sub.billing_method_id = others[0].id
        elif sub and sub.billing_method_id == method_id:
            sub.billing_method_id = others[0].id if others else None

        await self.payment_repo.db.commit()
        return success(message="결제수단이 삭제되었습니다.")

    # ── 구독 결제 ───────────────────────────────
    async def subscribe(self, request):
        """body: {"plan": "standard", "method_id": 1}

        method_id를 생략하면 기본 카드로 청구한다.
        """
        user_id = request.user_id
        body = await request.json()
        plan = self._parse_paid_plan(body.get("plan"))

        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            fail("사용자를 찾을 수 없습니다.", "USER_NOT_FOUND", 404)

        sub = await self._ensure_subscription(user_id)

        method_id = body.get("method_id")
        method = (
            await self.payment_repo.find_method(user_id, method_id)
            if method_id
            else await self.payment_repo.find_default_method(user_id)
        )
        if not method:
            fail("결제수단을 먼저 등록해 주세요.", "METHOD_REQUIRED", 428)

        amount = price_for(plan)
        order_id = self._new_order_id(plan, user_id)
        order_name = f"chatbase.kr {plan.value.upper()} 1개월"

        try:
            charged = await self.toss.charge(
                billing_key=decrypt(method.encrypted_billing_key),
                customer_key=sub.customer_key,
                amount=amount,
                order_id=order_id,
                order_name=order_name,
                customer_email=getattr(user, "email", None),
            )
        except TossError as exc:
            # 실패도 내역에 남긴다 — 사용자에게 실패 사유를 보여줘야 한다.
            await self.payment_repo.add_payment(
                Payment(
                    user_id=user_id,
                    order_id=order_id,
                    plan=plan.value,
                    amount=amount,
                    status=PaymentStatus.FAILED,
                    billing_method_id=method.id,
                    failure_code=exc.code,
                    failure_message=exc.message[:255],
                )
            )
            await self.payment_repo.db.commit()
            fail(exc.message, exc.code, 402)

        now = now_kst()
        await self.payment_repo.add_payment(
            Payment(
                user_id=user_id,
                order_id=order_id,
                payment_key=charged.get("paymentKey"),
                plan=plan.value,
                amount=amount,
                status=PaymentStatus.DONE,
                billing_method_id=method.id,
                method=charged.get("method"),
                receipt_url=(charged.get("receipt") or {}).get("url"),
                approved_at=now,
            )
        )

        sub.plan = plan.value
        sub.status = SubscriptionStatus.ACTIVE
        sub.billing_method_id = method.id
        sub.started_at = sub.started_at or now
        sub.next_billing_at = _add_month(now)
        sub.canceled_at = None

        user.plan = plan.value

        await self.payment_repo.db.commit()
        logger.info("subscription activated user_id=%s plan=%s", user_id, plan.value)

        return success(
            data={"subscription": _sub_to_dict(sub), "plan": plan.value},
            message="결제가 완료되었습니다.",
        )

    # ── 해지 ────────────────────────────────────
    async def cancel_subscription(self, request):
        """다음 청구를 중단한다. 이미 결제한 기간은 그대로 쓴다."""
        user_id = request.user_id
        sub = await self.payment_repo.find_subscription(user_id)

        if not sub or sub.status != SubscriptionStatus.ACTIVE:
            fail("해지할 구독이 없습니다.", "SUBSCRIPTION_NOT_FOUND", 404)

        sub.status = SubscriptionStatus.CANCELED
        sub.canceled_at = now_kst()
        await self.payment_repo.db.commit()

        return success(
            data=_sub_to_dict(sub),
            message="구독이 해지되었습니다. 남은 기간은 그대로 이용하실 수 있습니다.",
        )

    # ── 정기 청구(다음 단계 크론에서 사용) ──────
    def billing_key_of(self, method: BillingMethod) -> str:
        return decrypt(method.encrypted_billing_key)
