"""translate greeting too

Revision ID: e2f95b41c8d3
Revises: d1a83f52c6e7
Create Date: 2026-08-30 00:00:00.000000

인사말도 번역 대상에 넣는다.

앞 리비전에서는 "인사말은 언어를 고르기 전에 한 번 보이고 고른 뒤에는 다시
렌더되지 않으니 번역할 자리가 없다"고 봤다. **실제로 써보니 틀렸다.**
방문자는 채팅창에 들어오자마자 언어부터 바꾸고, 그 순간 인사말은 아직 화면
맨 위에 그대로 있다. 그래서 한국어 인사말 밑에 영어 대화가 이어진다.

`source_hash` 는 이제 인사말 + FAQ 를 **함께** 해싱한다. 둘 중 하나만 바뀌어도
다시 번역해야 하기 때문이다. 기존 행의 해시는 계산식이 달라져 자동으로
불일치가 되므로, 다음 저장 때 인사말이 채워진다 — 별도 백필이 필요 없다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e2f95b41c8d3"
down_revision: Union[str, None] = "d1a83f52c6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tb_bot_translations", sa.Column("greeting", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("tb_bot_translations", "greeting")
