"""플랜별 한도 정의.

프론트 `frontend/src/types/plan.ts`의 가격표와 숫자가 일치해야 한다.
한쪽만 고치면 "가격표에 3개라고 써놓고 1개에서 막히는" 상황이 생긴다.

BYOK라 모델 사용료가 우리 원가에 잡히지 않으므로 **유료 플랜은 대화 건수를
제한하지 않는다**(`monthly_messages=None`). 유료 전환 레버는 Free의 월 대화 한도다.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass


class Product(str, enum.Enum):
    """구독 대상 상품.

    상품이 늘어나면 값 하나만 추가한다. 스키마는 그대로다 —
    `tb_subscriptions`가 (user_id, product)로 유니크라 한 사람이 상품마다
    구독을 따로 가질 수 있고, 어느 상품도 다른 상품을 전제하지 않는다.
    """

    CHATBOT = "chatbot"
    #: llm.chatbase.kr — AEO/GEO
    AEO = "aeo"


#: 값이 이상하면 챗봇으로 떨어뜨린다. 기존 데이터가 전부 챗봇이라 그게 안전하다.
def resolve_product(raw: str | None) -> Product:
    try:
        return Product((raw or "").strip().lower())
    except ValueError:
        return Product.CHATBOT


class Plan(str, enum.Enum):
    """**챗봇 상품의** 플랜. AEO는 자기 플랜 표를 따로 갖는다.

    지금 `PLAN_LIMITS`·`PLAN_PRICES`는 전부 챗봇 기준이다. AEO를 붙일 때
    상품별 표로 나눈다 — 지금 미리 나누면 쓰지도 않는 추상이 하나 는다.
    """

    FREE = "free"
    STANDARD = "standard"
    PREMIUM = "premium"


@dataclass(frozen=True)
class PlanLimits:
    """None = 무제한."""

    bots: int | None
    monthly_messages: int | None
    file_learning: bool
    kakao_channel: bool
    #: True면 위젯 하단 "Powered by chatbase.kr" 배지를 숨긴다.
    remove_badge: bool
    #: 대화 기록 보관 일수. None = 무제한
    history_days: int | None


PLAN_LIMITS: dict[Plan, PlanLimits] = {
    Plan.FREE: PlanLimits(
        bots=1,
        monthly_messages=100,
        file_learning=False,
        kakao_channel=False,
        remove_badge=False,
        history_days=7,
    ),
    Plan.STANDARD: PlanLimits(
        bots=1,
        monthly_messages=None,
        file_learning=True,
        kakao_channel=False,
        remove_badge=True,
        history_days=90,
    ),
    Plan.PREMIUM: PlanLimits(
        bots=3,
        monthly_messages=None,
        file_learning=True,
        kakao_channel=True,
        remove_badge=True,
        history_days=None,
    ),
}


#: 플랜별 월 결제 금액(원). `frontend/src/types/plan.ts`의 가격표와 일치해야 한다.
#: 표기는 "VAT 별도"지만 청구 금액은 이 값 그대로 나간다.
PLAN_PRICES: dict[Plan, int] = {
    Plan.FREE: 0,
    Plan.STANDARD: 19_000,
    Plan.PREMIUM: 49_000,
}

#: 결제로 전환할 수 있는 플랜. FREE는 결제 대상이 아니다.
PAID_PLANS: tuple[Plan, ...] = (Plan.STANDARD, Plan.PREMIUM)

#: 낮은 등급 → 높은 등급 순. 상향/하향 판정에 쓴다.
PLAN_ORDER: tuple[Plan, ...] = (Plan.FREE, Plan.STANDARD, Plan.PREMIUM)


def tier_of(plan: Plan) -> int:
    return PLAN_ORDER.index(plan)


def price_for(plan: Plan) -> int:
    return PLAN_PRICES[plan]


def resolve_plan(raw: str | None) -> Plan:
    """DB에 담긴 문자열을 Plan으로. 알 수 없는 값은 FREE로 떨어뜨린다.

    플랜 이름을 바꾸거나 DB에 잘못된 값이 들어가도 서비스가 죽지 않고
    가장 보수적인 권한으로 동작하게 한다.
    """
    try:
        return Plan((raw or "").strip().lower())
    except ValueError:
        return Plan.FREE


def limits_for(raw: str | None) -> PlanLimits:
    return PLAN_LIMITS[resolve_plan(raw)]
