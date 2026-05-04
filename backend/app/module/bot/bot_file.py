from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.core.database.base import Base, now_kst


class BotFile(Base):
    """챗봇 학습용 업로드 파일.

    Phase 2에서 텍스트 추출(PDF/DOCX/TXT) 후 extracted_text에 저장하여
    시스템 프롬프트에 자동으로 포함됩니다.
    """

    __tablename__ = "tb_bot_files"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    bot_id = Column(
        Integer,
        ForeignKey("tb_bots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size = Column(Integer, nullable=False)             # bytes
    storage_path = Column(String(500), nullable=True)  # /media 경로 또는 외부 URL
    extracted_text = Column(Text, nullable=True)       # 파싱 결과 캐시

    created_at = Column(DateTime, default=now_kst, nullable=False)
