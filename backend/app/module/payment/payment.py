import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
)

from app.core.database.base import Base, now_kst
from app.core.utils.plan import Product


class SubscriptionStatus(str, enum.Enum):
    #: 결제 프로필만 있고 구독하지 않은 상태.
    NONE = "none"
    ACTIVE = "active"
    #: 해지 신청됨. `next_billing_at`까지는 플랜을 그대로 쓰고 그 날 만료된다.
    CANCELED = "canceled"
    #: 정기 청구가 실패해 재시도 대기 중.
    PAST_DUE = "past_due"


class BillingMethodType(str, enum.Enum):
    """등록된 결제수단의 종류.

    **토스 자동결제는 국내 발급 카드만 지원한다**(해외카드·계좌이체 불가).
    TRANSFER는 빌링키 발급 API 응답 스펙(`transfers[]`)에만 존재하는 값이라
    실제로는 오지 않지만, 토스가 지원 범위를 넓히면 그대로 받도록 남겨둔다.
    """

    CARD = "card"
    TRANSFER = "transfer"


class PaymentStatus(str, enum.Enum):
    DONE = "done"
    FAILED = "failed"
    CANCELED = "canceled"


class BillingMethod(Base):
    """등록된 결제수단 하나(카드 또는 계좌).

    수단마다 billingKey가 하나씩 발급되므로 사용자당 여러 행이 될 수 있다.
    구독은 이 중 하나를 `Subscription.billing_method_id`로 가리키고,
    **결제수단 변경은 그 참조만 바꾸면 된다** — 토스에 따로 알릴 필요가 없다.

    billing_key는 이 값만 있으면 카드 재입력 없이 청구가 가능하므로
    BYOK API 키와 같은 Fernet 암호화로 저장한다(평문 저장 금지).
    """

    __tablename__ = "tb_billing_methods"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("tb_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    encrypted_billing_key = Column(LargeBinary, nullable=False)
    method_type = Column(
        Enum(BillingMethodType, name="billing_method_type", native_enum=False, length=10),
        nullable=False,
        default=BillingMethodType.CARD,
    )
    #: 카드사 코드 또는 은행명. 토스가 카드는 코드(41), 계좌는 이름(국민은행)으로 준다.
    issuer = Column(String(30), nullable=True)
    #: 마스킹된 카드번호 또는 계좌번호. 토스가 준 값 그대로.
    masked_number = Column(String(30), nullable=True)
    #: 카드 전용 — 신용 / 체크 / 기프트.
    card_type = Column(String(20), nullable=True)

    #: 새 구독을 시작할 때 기본으로 선택되는 카드. 사용자당 하나만 True.
    is_default = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=now_kst, nullable=False)


class Subscription(Base):
    """사용자 x 상품 구독 상태. 상품마다 한 행.

    챗봇을 안 써도 AEO만 구독할 수 있다 - 두 상품은 서로를 전제하지 않는다.
    상품이 늘어나도 행이 하나 더 생길 뿐 스키마는 그대로다.

    구매자 식별자(`toss_customer_key`)는 여기 없다. 그건 사람당 하나라
    `tb_users`에 있다 - billingKey가 거기 묶여 있어서 상품별로 나누면
    같은 카드를 상품 수만큼 다시 등록해야 한다.
    """

    __tablename__ = "tb_subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", "product", name="uq_subscription_user_product"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("tb_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product = Column(
        Enum(Product, name="subscription_product", native_enum=False, length=20),
        nullable=False,
        default=Product.CHATBOT,
    )

    plan = Column(String(10), nullable=True)  # 구독 중인 유료 플랜
    #: 다음 결제일에 적용할 플랜(하향 예약).
    #: 하향은 즉시 반영하지 않는다 — 이미 낸 기간만큼은 상위 플랜을 그대로 쓰게 두고,
    #: 다음 청구부터 낮은 금액으로 받는다. 환불이 없어도 사용자가 손해를 보지 않는다.
    scheduled_plan = Column(String(10), nullable=True)
    status = Column(
        Enum(SubscriptionStatus, name="subscription_status", native_enum=False, length=20),
        nullable=False,
        default=SubscriptionStatus.NONE,
    )

    #: 다음 청구에 쓸 결제수단. 카드를 지워도 구독 기록은 남아야 하므로 SET NULL.
    billing_method_id = Column(
        Integer,
        ForeignKey("tb_billing_methods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    #: 이번 주기 청구 실패 횟수. 성공하면 0으로 되돌린다.
    #: 일정 횟수를 넘기면 구독을 만료시켜 무한 재시도를 막는다.
    retry_count = Column(Integer, nullable=False, default=0)

    started_at = Column(DateTime, nullable=True)
    #: 다음 청구 예정일. 해지 상태에서는 "이용 종료일"로 읽는다.
    next_billing_at = Column(DateTime, nullable=True)
    canceled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now_kst, nullable=False)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)


class Payment(Base):
    """개별 결제 시도 기록. 실패도 남긴다 — 실패 이유를 사용자에게 보여줘야 한다."""

    __tablename__ = "tb_payments"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("tb_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    #: 우리가 만드는 주문번호. 토스 멱등키로도 쓰므로 유니크해야 한다.
    order_id = Column(String(64), nullable=False, unique=True, index=True)
    payment_key = Column(String(200), nullable=True, index=True)

    #: 어느 상품의 결제인가. 매출을 상품별로 갈라 보려면 결제에도 있어야 한다.
    product = Column(
        Enum(Product, name="payment_product", native_enum=False, length=20),
        nullable=False,
        default=Product.CHATBOT,
    )
    plan = Column(String(10), nullable=False)
    amount = Column(Integer, nullable=False)
    status = Column(
        Enum(PaymentStatus, name="payment_status", native_enum=False, length=20),
        nullable=False,
    )

    #: 어떤 카드로 결제했는지. 카드가 삭제돼도 내역은 남아야 하므로 SET NULL.
    billing_method_id = Column(
        Integer,
        ForeignKey("tb_billing_methods.id", ondelete="SET NULL"),
        nullable=True,
    )

    method = Column(String(30), nullable=True)
    receipt_url = Column(String(500), nullable=True)
    failure_code = Column(String(50), nullable=True)
    failure_message = Column(String(255), nullable=True)

    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_kst, nullable=False)
