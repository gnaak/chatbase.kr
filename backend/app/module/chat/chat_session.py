from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)

from app.core.database.base import Base, now_kst


class ChatSession(Base):
    """챗봇 임베드 위젯에서 발생한 대화 세션.

    visitor_id: 익명 방문자 식별자 (브라우저 쿠키/localStorage에서 발급).
    Phase 2에서 IP/User-Agent 기반 추정도 추가 가능.
    """

    __tablename__ = "tb_chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    bot_id = Column(
        Integer,
        ForeignKey("tb_bots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    visitor_id = Column(String(64), nullable=False, index=True)

    #: 방문자가 채팅창에서 고른 언어("ko" | "en" | "ja" | "zh").
    #:
    #: **마지막으로 쓴 값**이다. 대화 중에 pill 로 언어를 바꾸면 덮어쓴다 —
    #: 대화 로그는 세션당 한 줄이라 "이 사람이 무슨 말로 물었나"에 답이 하나여야 한다.
    #: 언어별 통계가 필요해지면 그건 메시지 단위로 따로 쌓을 일이다.
    #:
    #: NULL 인 경우가 둘 있고 **둘을 구분할 방법은 없다**:
    #:   - 이 컬럼이 생기기 전(2026-08-31)에 쌓인 세션
    #:   - 언어 pill 이 없는 봇(= 다국어 OFF)에서 들어온 세션
    #: 그래서 화면은 NULL 을 "한국어"로 단정하지 않고 "-"로 둔다.
    lang = Column(String(5), nullable=True)

    started_at = Column(DateTime, default=now_kst, nullable=False)
    last_message_at = Column(DateTime, default=now_kst, nullable=False)
