"""add user plan and monthly usage counter

Revision ID: c3e8a15d9f47
Revises: b7f2c9d41a83
Create Date: 2026-08-26 00:10:00.000000

- tb_users.plan — 현재 유효한 권한(free/standard/premium). 결제가 붙으면
  구독 테이블이 이 값을 갱신하고, 게이팅 코드는 계속 이 컬럼만 본다.
  기존 행은 server_default='free'로 채워진다.
- tb_usage_monthly — 봇 × 월 대화 카운터. 방문자 질문 1건 = 1건.
  ix_usage_user_month가 한도 판정 쿼리(SUM WHERE user_id, year_month)를 커버한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e8a15d9f47'
down_revision: Union[str, Sequence[str], None] = 'b7f2c9d41a83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'tb_users',
        sa.Column(
            'plan',
            sa.String(length=10),
            nullable=False,
            server_default='free',
        ),
    )

    op.create_table(
        'tb_usage_monthly',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('bot_id', sa.Integer(), nullable=False),
        sa.Column('year_month', sa.String(length=7), nullable=False),
        sa.Column('message_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['bot_id'], ['tb_bots.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['tb_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bot_id', 'year_month', name='uq_usage_bot_month'),
    )
    op.create_index(
        op.f('ix_tb_usage_monthly_id'), 'tb_usage_monthly', ['id'], unique=False
    )
    op.create_index(
        op.f('ix_tb_usage_monthly_bot_id'),
        'tb_usage_monthly',
        ['bot_id'],
        unique=False,
    )
    op.create_index(
        'ix_usage_user_month',
        'tb_usage_monthly',
        ['user_id', 'year_month'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_usage_user_month', table_name='tb_usage_monthly')
    op.drop_index(
        op.f('ix_tb_usage_monthly_bot_id'), table_name='tb_usage_monthly'
    )
    op.drop_index(op.f('ix_tb_usage_monthly_id'), table_name='tb_usage_monthly')
    op.drop_table('tb_usage_monthly')
    op.drop_column('tb_users', 'plan')
