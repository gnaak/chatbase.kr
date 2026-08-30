from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.core.database.base import Base, now_kst


class User(Base):
    __tablename__ = "tb_users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=True)
    name = Column(String(20), nullable=False)
    profile_image = Column(String(200), nullable=True)
    active = Column(Boolean, default=True)
    # 현재 유효한 권한의 단일 소스. 결제(tb_subscriptions)가 붙으면 그쪽이 이 값을
    # 갱신하고, 게이팅 코드는 계속 이 컬럼만 본다. 값은 app/core/utils/plan.py 참고.
    plan = Column(String(10), nullable=False, default="free", server_default="free")
    #: 토스 구매자 식별자. 상품이 여러 개여도 사람당 하나다.
    #: billingKey가 이 값에 묶여 있어서 상품별로 나누면 카드를 다시 등록해야 한다.
    #: 카드 등록 시점에 발급되므로 그 전까지는 NULL.
    toss_customer_key = Column(String(64), nullable=True, unique=True, index=True)
    workspace_name = Column(String(50), nullable=True)
    workspace_slug = Column(String(50), unique=True, nullable=True)
    created_at = Column(DateTime, default=now_kst)
    last_login_at = Column(DateTime(timezone=True))
