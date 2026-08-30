"""FAQ 번역본.

## 왜 FAQ만 번역하나

다국어 봇에서 미리 번역해둬야 하는 건 **FAQ 버튼 하나뿐**이다.

- **인사말**: 언어를 고르기 *전에* 한 번 보이고, 고른 뒤엔 대화가 시작돼서 다시
  볼 일이 없다. 번역해도 보여줄 자리가 없다. 한국어 하나로 둔다.
- **대화 응답**: LLM이 방문자가 쓴 언어에 맞춰 실시간으로 답한다
  (`chat_service._build_system_prompt`의 언어 규칙). 저장할 게 없다.
- **FAQ**: 언어를 고른 뒤에도 계속 보이고, **LLM을 안 거치고 즉답으로 나간다.**
  런타임에 번역하면 그 즉답 성질이 사라지고 지연·비용이 붙는다. 그래서 여기만
  미리 만들어 둔다.

## source_hash

DeepL 무료는 월 50만 자다. 봇을 저장할 때마다 다시 번역하면 금방 태운다.
원문 FAQ의 해시를 같이 저장해두고, **안 바뀌었으면 건너뛴다.**
원문이 바뀌면 해시가 달라지고 그때만 다시 돈다.
"""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)

from app.core.database.base import Base, now_kst

#: 번역 대상 언어. 원문은 한국어라 여기 없다.
#: DeepL target_lang 으로 그대로 못 쓰는 값이 있어(zh → ZH) 매핑은 서비스가 한다.
TRANSLATION_LANGS = ("en", "ja", "zh")


class BotTranslation(Base):
    __tablename__ = "tb_bot_translations"
    __table_args__ = (
        UniqueConstraint("bot_id", "lang", name="uq_bot_translations_bot_lang"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    bot_id = Column(
        Integer,
        ForeignKey("tb_bots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: "en" | "ja" | "zh"
    lang = Column(String(5), nullable=False)

    #: 번역된 FAQ. 원문과 같은 모양 `[{q, a}, ...]`.
    faqs = Column(JSON, nullable=True)

    #: 번역을 만들 때 쓴 **원문 FAQ**의 해시. 원문이 그대로면 다시 번역하지 않는다.
    source_hash = Column(String(64), nullable=True)

    created_at = Column(DateTime, default=now_kst, nullable=False)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)
