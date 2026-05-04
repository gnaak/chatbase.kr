from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
)
import enum

from app.core.database.base import Base, now_kst


class Provider(str, enum.Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"


class ApiKey(Base):
    """BYOK 사용자 API 키. provider별로 한 사용자가 하나씩만 보유.

    encrypted_key: cryptography(Fernet)로 암호화된 키. 평문은 절대 저장하지 않음.
    last4: UI 마스킹 표시용 마지막 4자리.
    """

    __tablename__ = "tb_api_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_api_key_user_provider"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("tb_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider = Column(
        Enum(Provider, name="api_key_provider", native_enum=False, length=20),
        nullable=False,
    )

    encrypted_key = Column(LargeBinary, nullable=False)
    last4 = Column(String(8), nullable=False)

    created_at = Column(DateTime, default=now_kst, nullable=False)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)
