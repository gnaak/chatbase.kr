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

    started_at = Column(DateTime, default=now_kst, nullable=False)
    last_message_at = Column(DateTime, default=now_kst, nullable=False)
