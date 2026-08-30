"""inquiry phone contact

Revision ID: b5c93d18e6f2
Revises: 6a166e7abe36
Create Date: 2026-08-30 00:00:00.000000

비회원이 이메일 대신 전화번호만 남길 수 있게 한다.

- tb_inquiries.phone 추가 — 운영자가 **직접 문자로** 답할 때 쓰는 연락처.
  자동 발송은 하지 않는다(SMS 인프라 없음).
- tb_inquiries.email을 nullable로. 이메일과 전화 중 최소 하나만 있으면 되고,
  그 검증은 서비스가 한다(DB 제약으로 걸면 둘 중 하나 규칙을 바꿀 때마다
  마이그레이션이 필요해진다).

기존 행은 전부 email이 채워져 있어 nullable 완화는 데이터 손실이 없다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5c93d18e6f2'
down_revision: Union[str, Sequence[str], None] = '6a166e7abe36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'tb_inquiries',
        sa.Column('phone', sa.String(length=20), nullable=True),
    )
    op.alter_column(
        'tb_inquiries',
        'email',
        existing_type=sa.String(length=100),
        nullable=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    # email이 비어 있는 행이 있으면 NOT NULL로 되돌릴 수 없다.
    # 전화번호만 남긴 문의는 되돌릴 방법이 없으므로 빈 문자열로 채운다.
    op.execute("UPDATE tb_inquiries SET email = '' WHERE email IS NULL")
    op.alter_column(
        'tb_inquiries',
        'email',
        existing_type=sa.String(length=100),
        nullable=False,
    )
    op.drop_column('tb_inquiries', 'phone')
