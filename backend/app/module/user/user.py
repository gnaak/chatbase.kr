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
    #: 토스 구매자 식별자. 상품이 여러 개여도 사람당 하나다.
    #: billingKey가 이 값에 묶여 있어서 상품별로 나누면 카드를 다시 등록해야 한다.
    #: 카드 등록 시점에 발급되므로 그 전까지는 NULL.
    toss_customer_key = Column(String(64), nullable=True, unique=True, index=True)
    workspace_name = Column(String(50), nullable=True)
    workspace_slug = Column(String(50), unique=True, nullable=True)
    #: 가입자를 데려온 채널. 가입 **시점에만** 알 수 있어 소급이 안 된다.
    #: 직접 방문·검색 유입은 셋 다 NULL이고 그게 정상이다.
    #: 값 규칙은 chatbase/SALES.md §6.
    #: OpenAI 를 **우리 제공 키**로 쓸지 여부. 본인 키가 등록돼 있어도 이게 켜져
    #: 있으면 제공 키를 쓴다 — 키를 넣어봤지만 평소엔 무료로 두고 싶은 경우가 있다.
    #:
    #: 기본값 True: 가입 직후 아무것도 안 해도 첫 대화가 되어야 한다. 그게 이
    #: 전환의 원래 이유다(BYOK 전면일 때는 가입해도 첫 대화가 실패했다).
    #:
    #: 계정 단위인 이유: 고르는 자리가 키 화면이다. 봇마다 다르게 하려면 봇 편집에
    #: 있어야 하는데, 그때는 이 컬럼이 아니라 봇 쪽에 붙는 게 맞다.
    use_service_key = Column(Boolean, default=True, nullable=False)

    utm_source = Column(String(100), nullable=True, index=True)
    utm_medium = Column(String(100), nullable=True)
    utm_campaign = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=now_kst)
    last_login_at = Column(DateTime(timezone=True))
