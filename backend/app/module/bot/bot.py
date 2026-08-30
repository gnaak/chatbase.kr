import secrets

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.dialects.mysql import MEDIUMTEXT

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
    # base64 data URL을 그대로 담는다. TEXT(64KB)로는 작은 PNG도 넘치므로 MEDIUMTEXT.
    # 프론트에서 256px로 줄여 보내지만, 상한은 서비스단(_MAX_IMAGE_DATA_CHARS)에서 막는다.
    logo = Column(MEDIUMTEXT, nullable=True)             # base64 또는 업로드 URL
    widget_icon = Column(MEDIUMTEXT, nullable=True)      # 위젯 버블 아이콘
    greeting = Column(String(500), nullable=True)
    system_prompt = Column(Text, nullable=True)
    training_text = Column(Text, nullable=True)
    training_type = Column(String(8), nullable=False, default="text")  # "text" | "file"
    fallback = Column(String(500), nullable=True)
    model = Column(String(50), nullable=False, default="gpt-5.4-mini")
    vector_store_id = Column(String(64), nullable=True)
    faqs = Column(JSON, nullable=True)  # [{q: str, a: str}]

    #: 다국어 응대. 켜면 시스템 프롬프트에 "방문자가 쓴 언어로 답하라" 규칙이 붙는다.
    #: 응답 번역은 LLM이 하므로 별도 번역 API도, 원가도 들지 않는다.
    #: 기본값 False — 켜져 있는 줄 모르고 한국어 손님에게 영어가 나가면 사고다.
    multilingual = Column(Boolean, default=False, nullable=False)
    #: 언어별 첫 인사말. {"en": "...", "ja": "...", "zh": "..."}
    #:
    #: 인사말만 따로 저장하는 이유: 첫 화면은 **방문자가 아직 아무 말도 하기 전**이라
    #: LLM이 언어를 알 수 없다. 나머지 대화는 사용자가 쓴 언어를 보고 맞추면 되지만
    #: 인사말만은 미리 준비돼 있어야 한다. QR을 찍은 외국인이 처음 보는 화면이라
    #: 여기가 한국어면 데모가 첫 줄에서 깨진다.
    #:
    #: 한국어 인사말은 기존 `greeting`을 그대로 쓴다(마이그레이션 없이 호환).
    #: 없는 언어는 `greeting`으로 떨어진다.
    greetings = Column(JSON, nullable=True)

    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_kst, nullable=False)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)
