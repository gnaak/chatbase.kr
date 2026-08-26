"""플랜별 한도 정의.

프론트 `frontend/src/types/plan.ts`의 가격표와 숫자가 일치해야 한다.
한쪽만 고치면 "가격표에 3개라고 써놓고 1개에서 막히는" 상황이 생긴다.

BYOK라 모델 사용료가 우리 원가에 잡히지 않으므로 **유료 플랜은 대화 건수를
제한하지 않는다**(`monthly_messages=None`). 유료 전환 레버는 Free의 월 대화 한도다.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass


class Plan(str, enum.Enum):
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
        bots=3,
        monthly_messages=None,
        file_learning=True,
        kakao_channel=False,
        remove_badge=True,
        history_days=90,
    ),
    Plan.PREMIUM: PlanLimits(
        bots=10,
        monthly_messages=None,
        file_learning=True,
        kakao_channel=True,
        remove_badge=True,
        history_days=None,
    ),
}


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
