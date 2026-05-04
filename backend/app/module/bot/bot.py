import secrets

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.core.database.base import Base, now_kst


def _generate_slug() -> str:
    """외부 노출용 16자 URL-safe 식별자."""
    return secrets.token_urlsafe(12)[:16]


class Bot(Base):
    __tablename__ = "tb_bots"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    slug = Column(
        String(24),
        unique=True,
        nullable=False,
        index=True,
        default=_generate_slug,
    )
    user_id = Column(
        Integer,
        ForeignKey("tb_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(60), nullable=False)
    logo = Column(Text, nullable=True)             # base64 또는 업로드 URL
    widget_icon = Column(Text, nullable=True)      # 위젯 버블 아이콘
    greeting = Column(String(500), nullable=True)
    system_prompt = Column(Text, nullable=True)
    training_text = Column(Text, nullable=True)
    fallback = Column(String(500), nullable=True)
    model = Column(String(50), nullable=False, default="gpt-4o-mini")

    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_kst, nullable=False)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)
