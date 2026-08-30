import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.core.database.base import Base, now_kst


class InquiryCategory(str, enum.Enum):
    GENERAL = "general"
    BILLING = "billing"
    TECHNICAL = "technical"
    PARTNERSHIP = "partnership"


#: 메일 본문에 쓰는 한글 라벨. 화면 라벨은 프론트가 따로 갖는다 —
#: 여기 값은 메일이라는 다른 매체를 위한 것이고, 둘을 억지로 하나로 묶으면
#: API가 표시 문자열을 내려보내는 형태가 된다.
CATEGORY_LABEL = {
    InquiryCategory.GENERAL: "일반 문의",
    InquiryCategory.BILLING: "결제·환불",
    InquiryCategory.TECHNICAL: "기술 지원",
    InquiryCategory.PARTNERSHIP: "제휴·파트너십",
}


class InquiryStatus(str, enum.Enum):
    #: 답변 대기. 신규 문의와 "관리자 답변 뒤 사용자가 다시 물은" 상태가 같은 칸이다 —
    #: 어드민 입장에서 해야 할 일이 똑같기 때문에 굳이 나누지 않는다.
    OPEN = "open"
    ANSWERED = "answered"
    CLOSED = "closed"


class InquirySender(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class Inquiry(Base):
    """1:1 문의 스레드 헤더.

    user_id가 nullable인 이유: 랜딩에서 비로그인으로도 문의할 수 있다.
    그 경우 스레드를 다시 여는 열쇠가 `access_token`이다 — 답변 메일에 담아 보내는
    `/support/{token}` 링크. 메일 **수신** 인프라가 없어서 회신으로는 스레드를
    이어갈 수 없고, 이 링크가 비로그인 사용자에게 유일한 재질문 경로다.

    name/email을 User에서 조인하지 않고 복사해 두는 이유: 비로그인 문의는 조인할
    대상이 없고, 로그인 문의도 나중에 사용자가 이름·메일을 바꾸면 "문의 당시 어디로
    답장했는가"가 흐려진다. 답장 주소는 스냅샷이어야 한다.
    """

    __tablename__ = "tb_inquiries"
    __table_args__ = (
        UniqueConstraint("access_token", name="uq_inquiry_access_token"),
        # 어드민 목록의 기본 쿼리(상태 필터 + 최신순)가 이 인덱스로 끝난다.
        Index("ix_inquiry_status_updated", "status", "updated_at"),
        # 같은 IP 도배 차단용 COUNT 쿼리.
        Index("ix_inquiry_ip_created", "ip", "created_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    #: 회원 탈퇴 시 문의도 함께 지운다(CASCADE). SET NULL로 두면 탈퇴한 회원의
    #: 이름·이메일이 문의 테이블에 계속 남아 개인정보 파기가 반쪽이 된다.
    user_id = Column(
        Integer,
        ForeignKey("tb_users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    name = Column(String(50), nullable=False)
    #: 답변받을 곳. 전화번호만 남기는 경우가 있어 nullable이다.
    #: 이메일과 전화 중 **최소 하나**는 있어야 한다(서비스에서 검증).
    email = Column(String(100), nullable=True, index=True)
    #: 운영자가 직접 문자를 보내려고 받는 연락처. 자동 발송은 하지 않는다 —
    #: SMS 인프라가 없고, 붙일 계획도 아직 없다.
    phone = Column(String(20), nullable=True)

    category = Column(
        Enum(
            InquiryCategory,
            name="inquiry_category",
            native_enum=False,
            length=20,
        ),
        nullable=False,
        default=InquiryCategory.GENERAL,
    )
    subject = Column(String(200), nullable=False)
    status = Column(
        Enum(InquiryStatus, name="inquiry_status", native_enum=False, length=20),
        nullable=False,
        default=InquiryStatus.OPEN,
    )

    #: 비로그인 열람용 난수. 로그인 문의에도 항상 발급한다 — 메일 링크는 로그인
    #: 여부와 무관하게 바로 스레드로 보내야 하기 때문.
    access_token = Column(String(64), nullable=False)
    #: 도배 차단용. X-Forwarded-For 우선, IPv6까지 들어갈 수 있어 45자.
    ip = Column(String(45), nullable=True)

    answered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_kst, nullable=False)
    #: 스레드에 글이 붙을 때마다 서비스가 직접 갱신한다(onupdate는 헤더 컬럼이
    #: 안 바뀌면 안 돈다). 어드민 목록 정렬 기준.
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)


class InquiryMessage(Base):
    """스레드에 쌓이는 개별 메시지. 최초 문의 본문도 여기 첫 행으로 들어간다."""

    __tablename__ = "tb_inquiry_messages"
    __table_args__ = (
        # 스레드 조회(inquiry_id로 뽑아 id순 정렬)가 이 인덱스로 끝난다.
        Index("ix_inquiry_message_inquiry", "inquiry_id", "id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    inquiry_id = Column(
        Integer,
        ForeignKey("tb_inquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender = Column(
        Enum(InquirySender, name="inquiry_sender", native_enum=False, length=10),
        nullable=False,
    )
    #: 누가 답했는지. 관리자 계정이 지워져도 답변 본문은 남아야 하므로 SET NULL.
    admin_id = Column(
        Integer,
        ForeignKey("tb_admins.id", ondelete="SET NULL"),
        nullable=True,
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=now_kst, nullable=False)
