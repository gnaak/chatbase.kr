"""방문자 경로에서 터진 LLM 호출 실패 기록.

봇 주인이 모르는 채로 봇이 죽어 있는 상황을 없애기 위한 테이블이다.
키가 만료되거나 크레딧이 떨어지면 방문자는 "일시적인 오류가 발생했어요"만 받고,
주인은 로그 파일을 열어보지 않는 한 알 방법이 없었다.

**방문자 경로만 남긴다.** 대시보드 미리보기 실패는 주인이 그 자리에서 원문까지
보고 있으므로 기록할 이유가 없고, 남기면 "내가 방금 테스트한 것"이 오류 건수로
잡혀 지표가 못 쓰게 된다.
"""

import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)

from app.core.database.base import Base, now_kst


class LlmErrorKind(str, enum.Enum):
    """주인이 취할 조치가 갈리는 단위로만 나눈다.

    AUTH는 키를 다시 등록해야 하고, QUOTA는 제공자에서 결제·한도를 봐야 하며,
    OTHER는 대개 제공자 장애라 기다리는 것 말고 할 게 없다.
    더 잘게 쪼개도 주인이 할 일이 달라지지 않으면 의미가 없다.
    """

    AUTH = "auth"
    QUOTA = "quota"
    TIMEOUT = "timeout"
    OTHER = "other"


class LlmErrorChannel(str, enum.Enum):
    WIDGET = "widget"
    KAKAO = "kakao"


class LlmError(Base):
    __tablename__ = "tb_llm_errors"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    bot_id = Column(
        Integer,
        ForeignKey("tb_bots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    channel = Column(
        Enum(LlmErrorChannel, name="llm_error_channel", native_enum=False, length=10),
        nullable=False,
    )
    kind = Column(
        Enum(LlmErrorKind, name="llm_error_kind", native_enum=False, length=10),
        nullable=False,
    )

    provider = Column(String(20), nullable=False)
    model = Column(String(50), nullable=False)
    #: SDK 예외 원문 앞부분. 주인에게 보여주는 값이 아니라 우리가 원인을 좁힐 때 쓴다.
    #: 원문에 키가 섞여 나오는 제공자가 있어 화면에는 내리지 않는다.
    message = Column(String(500), nullable=False, default="")

    #: 조회가 항상 "최근 N시간"이라 인덱스가 필요하다.
    created_at = Column(DateTime, default=now_kst, nullable=False, index=True)
