import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    Integer,
    String,
    UniqueConstraint,
)

from app.core.database.base import Base, now_kst


class ModelType(str, enum.Enum):
    CHAT = "chat"
    IMAGE = "image"


class ModelProvider(str, enum.Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


class LLMModel(Base):
    """LLM 모델 카탈로그. 운영자가 DB로 관리(코드 수정 불필요).

    프론트 드롭다운은 `is_active=True`인 행만 노출. 백엔드 LLM 호출 검증은
    provider prefix만 체크하므로, 카탈로그에 없는 ID도 호출은 가능하지만
    UI에는 안 뜬다.
    """

    __tablename__ = "tb_models"
    __table_args__ = (UniqueConstraint("type", "value", name="uq_model_type_value"),)

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    type = Column(
        Enum(
            ModelType,
            name="model_type",
            native_enum=False,
            length=10,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    value = Column(String(100), nullable=False)
    label = Column(String(120), nullable=False)
    # 사용자 드롭다운에 라벨 아래 한 줄로 노출. refresh_catalog은 이 값을 덮지 않는다.
    description = Column(String(200), nullable=True)
    provider = Column(
        Enum(
            ModelProvider,
            name="model_provider",
            native_enum=False,
            length=20,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    pricing_input = Column(Float, nullable=True)
    pricing_output = Column(Float, nullable=True)
    pricing_per_image = Column(Float, nullable=True)
    discovered_at = Column(DateTime, default=now_kst, nullable=False)
