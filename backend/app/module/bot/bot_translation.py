"""FAQ 번역본.

## 무엇을 미리 번역하나

**LLM을 안 거치고 화면에 그대로 뿌려지는 것**만 미리 만들어 둔다.

- **인사말**: 방문자는 들어오자마자 언어부터 바꾸고, 그때 인사말은 아직 화면
  맨 위에 그대로 있다. 한국어 인사말 밑에 영어 대화가 붙으면 티가 난다.
  (처음엔 "고른 뒤엔 다시 안 보인다"고 봤는데, 실제로 써보니 틀렸다.)
- **FAQ**: 언어를 고른 뒤에도 계속 보이고, 눌렀을 때 **LLM 없이 즉답**으로 나간다.
  런타임 번역을 붙이면 그 즉답 성질이 사라진다.
- **대화 응답**: 여기 없다. LLM이 방문자 언어에 맞춰 실시간으로 답한다
  (`chat_service._build_system_prompt`의 언어 규칙). 저장할 게 없다.
- **fallback**: 여기 없다. 시스템 프롬프트 안에 들어가서 LLM이 그 자리에서 옮긴다.

## source_hash

원문(**인사말 + FAQ**)의 해시를 같이 저장해두고, **안 바뀌었으면 건너뛴다.**
둘 중 하나만 바뀌어도 해시가 달라져 다시 돈다.

번역이 DeepL에서 **봇 주인의 LLM 키(BYOK)**로 옮겨간 뒤 이 해시가 더 중요해졌다.
번역기는 같은 원문에 같은 결과를 주지만 LLM은 그렇지 않다. **다시 부르지 않는
것이 곧 화면 문구가 고정된다는 뜻**이다. 반대로 원문을 고치면 그 봇·그 언어의
번역이 통째로 새로 만들어지므로, FAQ 하나만 고쳐도 다른 FAQ의 번역 문장이
미세하게 달라질 수 있다.
"""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)

from app.core.database.base import Base, now_kst

#: 번역 대상 언어. 원문은 한국어라 여기 없다.
#: 코드 → 프롬프트에 넣을 언어 이름 매핑은 `infra/llm/translate_service.py`가 한다.
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

    #: 번역된 첫 인사말.
    greeting = Column(Text, nullable=True)

    #: 번역된 FAQ. 원문과 같은 모양 `[{q, a}, ...]`.
    faqs = Column(JSON, nullable=True)

    #: 번역을 만들 때 쓴 **원문(인사말 + FAQ)**의 해시.
    #: 원문이 그대로면 다시 번역하지 않는다.
    source_hash = Column(String(64), nullable=True)

    created_at = Column(DateTime, default=now_kst, nullable=False)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)
