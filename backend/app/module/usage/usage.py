from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)

from app.core.database.base import Base, now_kst


class UsageMonthly(Base):
    """봇 × 월 단위 대화 카운터.

    왜 별도 테이블인가:
    - `tb_chat_messages`를 매번 COUNT하면 messages → sessions → bots 2중 조인이 필요하다.
      대화 요청마다 그 쿼리를 도는 건 비싸다.
    - Redis 카운터는 재시작/eviction에 날아간다. 과금과 붙는 숫자라 durable해야 한다.

    왜 bot_id까지 쪼개는가:
    - 사용자 한도는 `SUM(message_count) WHERE user_id, year_month`로 뽑으면 되고,
      동시에 "봇별 대화량"을 공짜로 얻는다. 대시보드에 그대로 쓸 수 있다.

    카운트 기준: **방문자 질문 1건 = 1건.** 봇 답변은 세지 않는다.
    대시보드 프리뷰(`/preview/stream`, `/quick-stream`)는 세지 않는다 —
    봇 주인이 자기 봇을 테스트하는 것이라 한도를 태우면 안 된다.
    """

    __tablename__ = "tb_usage_monthly"
    __table_args__ = (
        UniqueConstraint("bot_id", "year_month", name="uq_usage_bot_month"),
        # 한도 판정 쿼리(SUM WHERE user_id, year_month)가 이 인덱스만으로 끝난다.
        Index("ix_usage_user_month", "user_id", "year_month"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("tb_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    bot_id = Column(
        Integer,
        ForeignKey("tb_bots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: "YYYY-MM" (KST 기준). 문자열로 두면 월 경계 계산이 앱에 남아 쿼리가 단순해진다.
    year_month = Column(String(7), nullable=False)
    message_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=now_kst, nullable=False)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst, nullable=False)
