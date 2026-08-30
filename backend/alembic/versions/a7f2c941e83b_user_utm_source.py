"""user acquisition source (utm)

Revision ID: a7f2c941e83b
Revises: d92e5b04c7a1
Create Date: 2026-08-30 00:00:00.000000

가입자가 **어느 채널에서 왔는지**를 가입 시점에 박아둔다.

GA4는 "cafe_apsa에서 34명 방문"까지만 안다. 그중 누가 결제까지 갔는지는 우리
DB에만 있고, 둘을 잇는 값이 지금 어디에도 없다. 그래서 어느 카페가 돈이 됐는지를
알 방법이 없다.

**소급이 안 되는 데이터다.** "이 사람이 어디서 왔나"는 가입하는 순간에만 알 수
있어서, 붙이기 전에 가입한 사람의 출처는 영영 모른다. 유료 고객 0명인 지금이
가장 싸다.

컬럼을 셋으로 나눈 이유: 어드민 집계가 `GROUP BY utm_source`로 끝난다. JSON 한
칸에 넣으면 집계할 때마다 파싱해야 하고 인덱스도 못 건다.

`utm_source`에만 인덱스를 건다 — medium·campaign 단독으로 거르는 화면은 없다.
이름은 SQLAlchemy 기본 규칙(`ix_<table>_<column>`)을 따른다. 모델의 index=True가
만드는 이름과 다르면 나중에 autogenerate가 매번 drop/create 를 만들어낸다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7f2c941e83b'
down_revision: Union[str, Sequence[str], None] = 'd92e5b04c7a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 셋 다 nullable — 직접 방문·검색 유입은 UTM이 없다. 그게 정상이고,
    # 어드민에서는 '(직접)'으로 묶어 보여준다.
    op.add_column(
        'tb_users',
        sa.Column('utm_source', sa.String(length=100), nullable=True),
    )
    op.add_column(
        'tb_users',
        sa.Column('utm_medium', sa.String(length=100), nullable=True),
    )
    op.add_column(
        'tb_users',
        sa.Column('utm_campaign', sa.String(length=100), nullable=True),
    )
    op.create_index(
        'ix_tb_users_utm_source', 'tb_users', ['utm_source'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_tb_users_utm_source', table_name='tb_users')
    op.drop_column('tb_users', 'utm_campaign')
    op.drop_column('tb_users', 'utm_medium')
    op.drop_column('tb_users', 'utm_source')
