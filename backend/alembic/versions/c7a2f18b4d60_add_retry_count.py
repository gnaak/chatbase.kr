"""add retry count

Revision ID: c7a2f18b4d60
Revises: b91d47ee0c38
Create Date: 2026-08-27 00:00:00.000000

tb_subscriptions.retry_count — 정기 청구 실패 횟수.

실패한 구독을 매일 무한히 재시도하면 카드사에 같은 거절이 계속 쌓인다.
횟수를 세어 일정 횟수를 넘기면 구독을 만료시킨다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a2f18b4d60'
down_revision: Union[str, Sequence[str], None] = 'b91d47ee0c38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'tb_subscriptions',
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
    )
    # 모델에는 server_default가 없다. 기존 행을 채운 뒤 걷어내야 드리프트가 남지 않는다.
    op.alter_column(
        'tb_subscriptions',
        'retry_count',
        existing_type=sa.Integer(),
        existing_nullable=False,
        server_default=None,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tb_subscriptions', 'retry_count')
