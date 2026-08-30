"""bot FAQ translations (+ drop tb_bots.greetings)

Revision ID: d1a83f52c6e7
Revises: c9e4a1f70b23
Create Date: 2026-08-30 00:00:00.000000

## tb_bot_translations

FAQ 번역본. 다국어 봇에서 미리 번역해둬야 하는 건 FAQ 하나뿐이다 —
FAQ는 언어를 고른 뒤에도 계속 보이고 **LLM을 안 거치고 즉답으로 나가기 때문에**
런타임 번역을 붙이면 그 즉답 성질이 사라진다.

`source_hash`를 같이 둔다. DeepL 무료가 월 50만 자라, 봇을 저장할 때마다 다시
번역하면 금방 태운다. 원문이 그대로면 건너뛴다.

## tb_bots.greetings 제거

바로 앞 리비전(c9e4a1f70b23)에서 언어별 인사말을 넣었다가 **쓸 자리가 없어서**
걷어낸다. 인사말은 언어를 고르기 전에 한 번 보이고, 고른 뒤에는 대화가 시작돼
다시 렌더되지 않는다. 번역본을 만들어도 보여줄 화면이 없다.

`multilingual` 컬럼은 그대로 둔다 — 그건 GLOBAL 플랜 게이팅과 시스템 프롬프트의
언어 규칙에 실제로 쓰인다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1a83f52c6e7"
down_revision: Union[str, None] = "c9e4a1f70b23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tb_bot_translations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bot_id", sa.Integer(), nullable=False),
        sa.Column("lang", sa.String(length=5), nullable=False),
        sa.Column("faqs", sa.JSON(), nullable=True),
        sa.Column("source_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["bot_id"], ["tb_bots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bot_id", "lang", name="uq_bot_translations_bot_lang"),
    )
    op.create_index(op.f("ix_tb_bot_translations_id"), "tb_bot_translations", ["id"])
    op.create_index(
        op.f("ix_tb_bot_translations_bot_id"), "tb_bot_translations", ["bot_id"]
    )

    op.drop_column("tb_bots", "greetings")


def downgrade() -> None:
    op.add_column("tb_bots", sa.Column("greetings", sa.JSON(), nullable=True))
    op.drop_index(op.f("ix_tb_bot_translations_bot_id"), table_name="tb_bot_translations")
    op.drop_index(op.f("ix_tb_bot_translations_id"), table_name="tb_bot_translations")
    op.drop_table("tb_bot_translations")
