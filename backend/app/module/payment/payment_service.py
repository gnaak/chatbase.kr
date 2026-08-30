"""토스페이먼츠 자동결제(빌링) 기반 구독 처리.

**카드 등록과 결제를 분리한다.**

  등록: SDK 카드 등록창 → authKey → `register_method`가 billingKey로 교환해 저장.
        결제는 일어나지 않는다. 여러 장 등록할 수 있고 그중 하나가 기본 카드다.
  결제: `subscribe`가 선택된(또는 기본) 카드의 billingKey로 청구하고 플랜을 올린다.
  변경: `set_default_method`가 구독이 가리키는 카드를 바꾼다. 토스 호출은 없다 —
        다음 청구 때 다른 billingKey를 쓰는 것이 전부다.

플랜 게이팅은 전부 구독을 본다(`payment/plan_lookup.py`). 상품마다 구독이
따로 있으므로 사용자 테이블의 컬럼 하나로는 표현할 수 없다.
결제가 하는 일은 그 값을 바꾸는 것뿐이다.
"""

import calendar
import logging
import secrets
from datetime import datetime, timedelta

from app.core.database.base import now_kst
from app.core.utils.encryption import decrypt, encrypt
from app.core.utils.plan import (
    PAID_PLANS,
    Plan,
    price_for,
    Product,
    resolve_plan,
    tier_of,
)
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

#: 정기 청구 실패를 몇 번까지 재시도할지. 넘기면 구독을 만료시킨다.
MAX_CHARGE_RETRY = 3


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


def _sub_to_dict(sub: Subscription, customer_key: str | None = None) -> dict:
    """customer_key는 사람 단위(tb_users)라 구독 행에 없다. 호출부가 넘긴다."""
    return {
        "product": sub.product.value if sub.product else Product.CHATBOT.value,
        "customer_key": customer_key,
        "status": sub.status.value if sub.status else SubscriptionStatus.NONE.value,
        "plan": sub.plan,
        "scheduled_plan": sub.scheduled_plan,
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
    async def _ensure_subscription(
        self, user_id: int, product: Product = Product.CHATBOT
    ) -> Subscription:
        """해당 상품의 구독 행을 보장한다. 없으면 status=NONE으로 만든다."""
        sub = await self.payment_repo.find_subscription(user_id, product)
        if sub:
            return sub
        sub = Subscription(
            user_id=user_id,
            product=product,
            status=SubscriptionStatus.NONE,
        )
        return await self.payment_repo.add_subscription(sub)

    async def _customer_key_of(self, user_id: int) -> str | None:
        """응답의 customer_key 자리를 채운다.

        프론트가 구독 응답에서 이 값을 읽어 토스 카드 등록창을 연다
        (`billing.tsx`의 canRegisterCard). 어떤 구독 응답에서는 비고 어떤
        응답에서는 차 있으면, 캐시가 덮이는 순간 카드 등록 버튼이 죽는다.
        그래서 구독을 돌려주는 모든 곳에서 같이 채운다.
        """
        user = await self.user_repo.get_user_by_id(user_id)
        return user.toss_customer_key if user else None

    async def _ensure_customer_key(self, user) -> str:
        """토스 구매자 식별자를 보장한다. 사람당 하나이므로 tb_users에 둔다.

        상품별로 나누면 billingKey가 customerKey에 묶여 있어서 같은 카드를
        상품 수만큼 다시 등록해야 한다. user.id를 그대로 쓰지 않는 이유는
        내부 식별자를 외부(토스)에 노출하지 않기 위해서다.
        """
        if not user.toss_customer_key:
            user.toss_customer_key = f"cus_{secrets.token_urlsafe(16)}"
            await self.payment_repo.db.flush()
        return user.toss_customer_key

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
        user = await self.user_repo.get_user_by_id(request.user_id)
        sub = await self._ensure_subscription(request.user_id)
        customer_key = await self._ensure_customer_key(user)
        await self.payment_repo.db.commit()
        return success(data=_sub_to_dict(sub, customer_key))

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

        # 카드는 사람에게 붙는다(상품별이 아니다). 그래서 구독 행이 없어도 등록된다.
        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            fail("사용자를 찾을 수 없습니다.", "USER_NOT_FOUND", 404)
        # 남의 customerKey로 카드를 붙이지 못하게 한다.
        if customer_key != await self._ensure_customer_key(user):
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
                customer_key=user.toss_customer_key,
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
        # 상향 결제는 즉시 반영이므로, 걸려 있던 하향 예약은 의미가 없어진다.
        sub.scheduled_plan = None
        sub.status = SubscriptionStatus.ACTIVE
        sub.billing_method_id = method.id
        sub.started_at = sub.started_at or now
        sub.next_billing_at = _add_month(now)
        sub.canceled_at = None

        await self.payment_repo.db.commit()
        logger.info("subscription activated user_id=%s plan=%s", user_id, plan.value)

        return success(
            data={
                "subscription": _sub_to_dict(sub, user.toss_customer_key),
                "plan": plan.value,
            },
            message="결제가 완료되었습니다.",
        )

    # ── 플랜 하향 예약 ──────────────────────────
    async def schedule_plan_change(self, request):
        """body: {"plan": "standard"} — 다음 결제일에 적용할 하향 예약.

        하향은 즉시 결제하지 않는다. 지금 청구하면 이미 낸 상위 플랜 요금이
        그대로 날아가기 때문이다. 남은 기간은 상위 플랜을 쓰고,
        다음 청구부터 낮은 금액으로 받는다.

        같은 플랜을 다시 보내면 예약을 취소한다.
        """
        user_id = request.user_id
        body = await request.json()

        sub = await self.payment_repo.find_subscription(user_id)
        if not sub or sub.status != SubscriptionStatus.ACTIVE:
            fail("이용 중인 구독이 없습니다.", "SUBSCRIPTION_NOT_FOUND", 404)

        customer_key = await self._customer_key_of(user_id)

        # plan을 비워 보내면 예약 취소.
        raw_plan = body.get("plan")
        if not raw_plan:
            sub.scheduled_plan = None
            await self.payment_repo.db.commit()
            return success(
                data=_sub_to_dict(sub, customer_key),
                message="플랜 변경 예약을 취소했습니다.",
            )

        target = self._parse_paid_plan(raw_plan)
        current = resolve_plan(sub.plan)

        if target == current:
            sub.scheduled_plan = None
            await self.payment_repo.db.commit()
            return success(
                data=_sub_to_dict(sub, customer_key),
                message="플랜 변경 예약을 취소했습니다.",
            )

        if tier_of(target) > tier_of(current):
            # 상향은 지금 결제하고 바로 올려주는 게 맞다 — 기다릴 이유가 없다.
            fail(
                "상위 플랜으로는 바로 변경할 수 있습니다.",
                "USE_SUBSCRIBE_FOR_UPGRADE",
            )

        sub.scheduled_plan = target.value
        await self.payment_repo.db.commit()

        return success(
            data=_sub_to_dict(sub, customer_key),
            message="다음 결제일부터 변경된 플랜으로 청구됩니다.",
        )

    # ── 해지 ────────────────────────────────────
    async def cancel_subscription(self, request):
        """다음 청구를 중단한다. 이미 결제한 기간은 그대로 쓴다.

        **PAST_DUE도 받는다.** 예전에는 ACTIVE만 받았는데, 그러면 결제가 실패해
        PAST_DUE가 된 사람이 갇힌다 — 해지는 "해지할 구독이 없습니다"로 막히고,
        탈퇴는 `UserService.withdraw`가 PAST_DUE를 차단해서 "결제 페이지에서 먼저
        해지하세요"로 되돌린다. 그 사이에도 크론은 하루마다 재청구를 시도한다.
        그만두겠다는 사람의 카드를 계속 긁는 셈이라 반드시 열려 있어야 한다.

        다만 처리가 다르다. PAST_DUE는 **이번 주기 값을 못 받은 상태**라
        "남은 기간"이 없다. 그래서 CANCELED로 두지 않고 즉시 만료시켜 FREE로
        내린다. CANCELED로 두면 안 낸 기간을 계속 쓰게 된다.
        """
        user_id = request.user_id
        sub = await self.payment_repo.find_subscription(user_id)

        cancelable = (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE)
        if not sub or sub.status not in cancelable:
            fail("해지할 구독이 없습니다.", "SUBSCRIPTION_NOT_FOUND", 404)

        if sub.status == SubscriptionStatus.PAST_DUE:
            await self._expire(sub, "canceled_while_past_due")
            sub.canceled_at = now_kst()
            message = "구독이 해지되었습니다. 미납 상태라 이용은 즉시 종료됩니다."
        else:
            sub.status = SubscriptionStatus.CANCELED
            sub.canceled_at = now_kst()
            message = "구독이 해지되었습니다. 남은 기간은 그대로 이용하실 수 있습니다."

        await self.payment_repo.db.commit()

        return success(
            data=_sub_to_dict(sub, await self._customer_key_of(user_id)),
            message=message,
        )

    # ── 정기 청구 (cron에서 호출) ───────────────
    def billing_key_of(self, method: BillingMethod) -> str:
        return decrypt(method.encrypted_billing_key)

    @staticmethod
    def plan_to_charge(sub: Subscription) -> Plan:
        """이번 청구에 적용할 플랜. 하향 예약이 있으면 그 플랜으로 청구한다."""
        return resolve_plan(sub.scheduled_plan or sub.plan)

    async def _expire(self, sub: Subscription, reason: str) -> None:
        """구독을 끝낸다. plan을 비우면 게이팅이 곧바로 FREE로 읽는다."""
        sub.status = SubscriptionStatus.NONE
        sub.plan = None
        sub.scheduled_plan = None
        sub.next_billing_at = None
        sub.retry_count = 0
        logger.info("subscription expired user_id=%s reason=%s", sub.user_id, reason)

    async def _charge_one(self, sub: Subscription, now: datetime) -> str:
        """구독 한 건을 처리하고 결과 라벨을 돌려준다.

        해지 예정 건은 청구하지 않고 만료시킨다 — 이미 낸 기간이 끝난 시점이다.
        """
        if sub.status == SubscriptionStatus.CANCELED:
            await self._expire(sub, "canceled")
            return "expired"

        plan = self.plan_to_charge(sub)
        if plan not in PAID_PLANS:
            await self._expire(sub, "no_paid_plan")
            return "expired"

        method = None
        if sub.billing_method_id:
            method = await self.payment_repo.find_method(
                sub.user_id, sub.billing_method_id
            )
        method = method or await self.payment_repo.find_default_method(sub.user_id)

        if not method:
            # 카드가 없으면 재시도해도 소용없다. 바로 끝낸다.
            await self._expire(sub, "no_billing_method")
            return "expired"

        user = await self.user_repo.get_user_by_id(sub.user_id)
        amount = price_for(plan)
        order_id = self._new_order_id(plan, sub.user_id)

        try:
            charged = await self.toss.charge(
                billing_key=decrypt(method.encrypted_billing_key),
                customer_key=user.toss_customer_key,
                amount=amount,
                order_id=order_id,
                order_name=f"chatbase.kr {plan.value.upper()} 1개월",
                customer_email=getattr(user, "email", None),
            )
        except TossError as exc:
            await self.payment_repo.add_payment(
                Payment(
                    user_id=sub.user_id,
                    order_id=order_id,
                    plan=plan.value,
                    amount=amount,
                    status=PaymentStatus.FAILED,
                    billing_method_id=method.id,
                    failure_code=exc.code,
                    failure_message=exc.message[:255],
                )
            )
            sub.retry_count = (sub.retry_count or 0) + 1
            logger.warning(
                "recurring charge failed user_id=%s attempt=%s code=%s",
                sub.user_id,
                sub.retry_count,
                exc.code,
            )

            if sub.retry_count >= MAX_CHARGE_RETRY:
                await self._expire(sub, "retry_exhausted")
                return "expired"

            # 하루 뒤 다시 시도한다. 카드 한도·일시 오류는 하루면 풀리는 경우가 많다.
            sub.status = SubscriptionStatus.PAST_DUE
            sub.next_billing_at = now + timedelta(days=1)
            return "retry"

        await self.payment_repo.add_payment(
            Payment(
                user_id=sub.user_id,
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

        # 하향 예약이 있었다면 이번 청구부터 그 플랜이 실제 플랜이 된다.
        sub.plan = plan.value
        sub.scheduled_plan = None
        sub.status = SubscriptionStatus.ACTIVE
        sub.billing_method_id = method.id
        sub.retry_count = 0
        sub.next_billing_at = _add_month(now)

        logger.info(
            "recurring charge done user_id=%s plan=%s amount=%s",
            sub.user_id,
            plan.value,
            amount,
        )
        return "charged"

    async def charge_due_subscriptions(self) -> dict[str, int]:
        """청구일이 된 구독을 모두 처리한다. cron이 매일 호출한다.

        한 건이 실패해도 나머지는 계속 처리한다 — 카드 하나 때문에
        그날 청구 전체가 멈추면 안 된다. 건마다 커밋해 부분 성공을 보존한다.
        """
        now = now_kst()
        subs = await self.payment_repo.find_due_subscriptions(now)
        summary = {"charged": 0, "retry": 0, "expired": 0, "error": 0}

        for sub in subs:
            try:
                result = await self._charge_one(sub, now)
                await self.payment_repo.db.commit()
                summary[result] += 1
            except Exception as exc:  # noqa: BLE001
                await self.payment_repo.db.rollback()
                summary["error"] += 1
                logger.exception(
                    "recurring charge crashed user_id=%s: %s", sub.user_id, exc
                )

        logger.info("billing cycle done %s", summary)
        return summary
