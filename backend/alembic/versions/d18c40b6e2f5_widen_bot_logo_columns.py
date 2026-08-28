"""widen bot logo columns

Revision ID: d18c40b6e2f5
Revises: a7355470ac8a
Create Date: 2026-08-26 00:00:00.000000

tb_bots.logo / widget_icon 을 TEXT → MEDIUMTEXT 로 확장.
로고를 base64 data URL로 그대로 저장하는 구조라 TEXT(65,535 bytes)에서는
작은 PNG도 `DataError (1406) Data too long for column 'logo'`로 터졌다.
서비스단에서 300,000자로 막고 있어 MEDIUMTEXT(16MB)면 충분하다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'd18c40b6e2f5'
down_revision: Union[str, Sequence[str], None] = 'a7355470ac8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    for column in ('logo', 'widget_icon'):
        op.alter_column(
            'tb_bots',
            column,
            existing_type=sa.Text(),
            type_=mysql.MEDIUMTEXT(),
            existing_nullable=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    for column in ('logo', 'widget_icon'):
        op.alter_column(
            'tb_bots',
            column,
            existing_type=mysql.MEDIUMTEXT(),
            type_=sa.Text(),
            existing_nullable=True,
        )
