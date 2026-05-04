from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
)
import enum

from app.core.database.base import Base, now_kst


class MessageRole(str, enum.Enum):
    USER = "user"
    BOT = "bot"


class ChatMessage(Base):
    __tablename__ = "tb_chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("tb_chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role = Column(
        Enum(MessageRole, name="chat_message_role", native_enum=False, length=10),
        nullable=False,
    )
    content = Column(Text, nullable=False)

    created_at = Column(DateTime, default=now_kst, nullable=False)
