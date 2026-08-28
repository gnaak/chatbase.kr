"""add scheduled plan

Revision ID: b91d47ee0c38
Revises: f3b6d95c0a27
Create Date: 2026-08-27 00:00:00.000000

tb_subscriptions.scheduled_plan — 다음 결제일에 적용할 플랜(하향 예약).

하향을 즉시 처리하면 이미 낸 상위 플랜 요금이 그대로 날아간다.
남은 기간은 상위 플랜을 쓰게 두고 다음 청구부터 낮은 금액으로 받기 위해
"예약"을 따로 들고 있어야 한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b91d47ee0c38'
down_revision: Union[str, Sequence[str], None] = 'f3b6d95c0a27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'tb_subscriptions',
        sa.Column('scheduled_plan', sa.String(length=10), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tb_subscriptions', 'scheduled_plan')
