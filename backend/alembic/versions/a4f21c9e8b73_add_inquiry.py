"""add inquiry

Revision ID: a4f21c9e8b73
Revises: c7a2f18b4d60
Create Date: 2026-08-30 00:00:00.000000

1:1 문의. 헤더(tb_inquiries) + 스레드 메시지(tb_inquiry_messages) 2테이블.

user_id는 nullable이다 — 랜딩에서 비로그인으로도 문의할 수 있고, 그 경우
access_token이 스레드를 다시 여는 유일한 열쇠가 된다.

Enum 컬럼 주의: 모델은 `sa.Enum(..., native_enum=False)`라 MySQL에서 VARCHAR로
떨어지고 CHECK 제약은 생기지 않는다(SQLAlchemy 2.0의 create_constraint 기본값이
False). 그리고 SQLAlchemy는 파이썬 Enum의 **name**을 저장하므로 실제 들어가는
값은 'OPEN'/'ANSWERED'처럼 대문자다. 아래 sa.Enum(...)은 길이 산출용으로만 쓰인다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4f21c9e8b73'
down_revision: Union[str, Sequence[str], None] = 'c7a2f18b4d60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'tb_inquiries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column(
            'category',
            sa.Enum(
                'GENERAL', 'BILLING', 'TECHNICAL', 'PARTNERSHIP',
                name='inquiry_category',
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column('subject', sa.String(length=200), nullable=False),
        sa.Column(
            'status',
            sa.Enum(
                'OPEN', 'ANSWERED', 'CLOSED',
                name='inquiry_status',
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column('access_token', sa.String(length=64), nullable=False),
        sa.Column('ip', sa.String(length=45), nullable=True),
        sa.Column('answered_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['tb_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('access_token', name='uq_inquiry_access_token'),
    )
    op.create_index(
        op.f('ix_tb_inquiries_id'), 'tb_inquiries', ['id'], unique=False
    )
    op.create_index(
        op.f('ix_tb_inquiries_user_id'), 'tb_inquiries', ['user_id'], unique=False
    )
    op.create_index(
        op.f('ix_tb_inquiries_email'), 'tb_inquiries', ['email'], unique=False
    )
    # 어드민 목록(상태 필터 + 최신순).
    op.create_index(
        'ix_inquiry_status_updated',
        'tb_inquiries',
        ['status', 'updated_at'],
        unique=False,
    )
    # 공개 문의 폼의 IP 도배 차단 COUNT.
    op.create_index(
        'ix_inquiry_ip_created',
        'tb_inquiries',
        ['ip', 'created_at'],
        unique=False,
    )

    op.create_table(
        'tb_inquiry_messages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('inquiry_id', sa.Integer(), nullable=False),
        sa.Column(
            'sender',
            sa.Enum(
                'USER', 'ADMIN',
                name='inquiry_sender',
                native_enum=False,
                length=10,
            ),
            nullable=False,
        ),
        sa.Column('admin_id', sa.Integer(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['inquiry_id'], ['tb_inquiries.id'], ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['admin_id'], ['tb_admins.id'], ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_tb_inquiry_messages_id'),
        'tb_inquiry_messages',
        ['id'],
        unique=False,
    )
    # 스레드 조회(inquiry_id로 뽑아 id순).
    op.create_index(
        'ix_inquiry_message_inquiry',
        'tb_inquiry_messages',
        ['inquiry_id', 'id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_inquiry_message_inquiry', table_name='tb_inquiry_messages')
    op.drop_index(
        op.f('ix_tb_inquiry_messages_id'), table_name='tb_inquiry_messages'
    )
    op.drop_table('tb_inquiry_messages')

    op.drop_index('ix_inquiry_ip_created', table_name='tb_inquiries')
    op.drop_index('ix_inquiry_status_updated', table_name='tb_inquiries')
    op.drop_index(op.f('ix_tb_inquiries_email'), table_name='tb_inquiries')
    op.drop_index(op.f('ix_tb_inquiries_user_id'), table_name='tb_inquiries')
    op.drop_index(op.f('ix_tb_inquiries_id'), table_name='tb_inquiries')
    op.drop_table('tb_inquiries')
