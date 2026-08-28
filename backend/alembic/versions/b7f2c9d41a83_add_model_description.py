"""add model description

Revision ID: b7f2c9d41a83
Revises: 9515200216bc
Create Date: 2026-08-26 00:00:00.000000

tb_models.description — 사용자 모델 드롭다운에서 라벨 아래 한 줄로 노출하는 설명.
운영자가 어드민에서 직접 작성하며, refresh_catalog(SDK 동기화)은 이 값을 덮지 않는다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7f2c9d41a83'
down_revision: Union[str, Sequence[str], None] = '9515200216bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'tb_models',
        sa.Column('description', sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tb_models', 'description')
