"""플랜별 한도 정의.

프론트 `chatbase/src/types/plan.ts`의 가격표와 숫자가 일치해야 한다.
한쪽만 고치면 "가격표에 3개라고 써놓고 1개에서 막히는" 상황이 생긴다.
(실제로 한동안 어긋나 있었다 — 프론트는 1/1/3, 백엔드는 1/3/10이었다.)

BYOK라 모델 사용료가 우리 원가에 잡히지 않으므로 **유료 플랜은 대화 건수를
제한하지 않는다**(`monthly_messages=None`). 유료 전환 레버는 Free의 월 대화 한도다.

## 봇 개수를 값의 축으로 쓴다

봇이 여러 개 필요한 사람은 사실상 **제작사·다점포**다. 단일 사업자는 1개면 된다.
그래서 STANDARD에 3개를 주던 것을 1개로 조였다 — 안 쓰는 한도를 주면 가장 값비싼
고객(제작사)이 가장 싼 플랜에 눌러앉는다.

## GLOBAL

QR + 다국어 응대. 호텔·게스트하우스·관광지처럼 **외국인 방문자를 받는 곳**이
산다. 값의 축은 봇 개수가 아니라 `multilingual` 하나다 — 봇 개수는 아래 플랜을
여러 개 사면 우회되지만, 다국어는 그렇게 못 한다.

한때 여기에 PARTNER(제작사 재판매, 고객사 분리 로그인)를 두려다 접었다.
분리 로그인은 만들다가 되돌렸고, **구현이 없는 기능으로 플랜을 만들면 안 된다.**
되살릴 거면 `chatbase/PROGRESS.md` 13단계를 먼저 볼 것.
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
    #: QR + 다국어. 외국인 방문자를 받는 곳(호텔·게스트하우스·관광지)용.
    GLOBAL = "global"


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
    #: 다국어 응대. 켜면 방문자가 쓴 언어로 답한다(`chat_service._build_system_prompt`).
    #: GLOBAL 전용이다. 봇 개수는 하위 플랜을 여러 개 사면 우회되지만 이건 안 되므로
    #: 가격 방어선 역할을 한다.
    multilingual: bool


PLAN_LIMITS: dict[Plan, PlanLimits] = {
    Plan.FREE: PlanLimits(
        bots=1,
        monthly_messages=100,
        file_learning=False,
        kakao_channel=False,
        remove_badge=False,
        history_days=7,
        multilingual=False,
    ),
    Plan.STANDARD: PlanLimits(
        bots=1,
        monthly_messages=None,
        file_learning=True,
        kakao_channel=False,
        remove_badge=True,
        history_days=90,
        multilingual=False,
    ),
    Plan.PREMIUM: PlanLimits(
        bots=3,
        monthly_messages=None,
        file_learning=True,
        kakao_channel=True,
        remove_badge=True,
        history_days=None,
        multilingual=False,
    ),
    Plan.GLOBAL: PlanLimits(
        bots=5,
        monthly_messages=None,
        file_learning=True,
        kakao_channel=True,
        remove_badge=True,
        history_days=None,
        multilingual=True,
    ),
}


#: 플랜별 월 결제 금액(원). `chatbase/src/types/plan.ts`의 가격표와 일치해야 한다.
#: 표기는 "VAT 별도"지만 청구 금액은 이 값 그대로 나간다.
PLAN_PRICES: dict[Plan, int] = {
    Plan.FREE: 0,
    Plan.STANDARD: 19_000,
    Plan.PREMIUM: 49_000,
    Plan.GLOBAL: 99_000,
}

#: 결제로 전환할 수 있는 플랜. FREE는 결제 대상이 아니다.
PAID_PLANS: tuple[Plan, ...] = (Plan.STANDARD, Plan.PREMIUM, Plan.GLOBAL)

#: 낮은 등급 → 높은 등급 순. 상향/하향 판정에 쓴다.
PLAN_ORDER: tuple[Plan, ...] = (Plan.FREE, Plan.STANDARD, Plan.PREMIUM, Plan.GLOBAL)


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
