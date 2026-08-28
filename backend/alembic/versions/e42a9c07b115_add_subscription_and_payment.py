"""add subscription and payment

Revision ID: e42a9c07b115
Revises: d18c40b6e2f5
Create Date: 2026-08-27 00:00:00.000000

토스페이먼츠 자동결제(빌링) 연동 1차 스키마.

이 시점에는 카드 정보가 tb_subscriptions에 직접 붙어 있었다(카드 1장 전제).
카드를 여러 장 등록하고 고르는 구조로 바꾼 것은 다음 리비전(886bc71373cd)이다.
**이미 적용된 리비전이라 내용을 수정하지 않는다** — 스키마 변경은 다음 리비전에서 한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e42a9c07b115'
down_revision: Union[str, Sequence[str], None] = 'd18c40b6e2f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'tb_subscriptions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('customer_key', sa.String(length=64), nullable=False),
        sa.Column('plan', sa.String(length=10), nullable=True),
        sa.Column(
            'status',
            sa.Enum(
                'none', 'active', 'canceled', 'past_due',
                name='subscription_status',
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column('encrypted_billing_key', sa.LargeBinary(), nullable=True),
        sa.Column('card_company', sa.String(length=30), nullable=True),
        sa.Column('card_number', sa.String(length=30), nullable=True),
        sa.Column('card_type', sa.String(length=20), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('next_billing_at', sa.DateTime(), nullable=True),
        sa.Column('canceled_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['tb_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_subscription_user'),
        sa.UniqueConstraint('customer_key', name='uq_subscription_customer_key'),
    )
    op.create_index(
        op.f('ix_tb_subscriptions_id'), 'tb_subscriptions', ['id'], unique=False
    )
    op.create_index(
        op.f('ix_tb_subscriptions_user_id'),
        'tb_subscriptions',
        ['user_id'],
        unique=False,
    )

    op.create_table(
        'tb_payments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.String(length=64), nullable=False),
        sa.Column('payment_key', sa.String(length=200), nullable=True),
        sa.Column('plan', sa.String(length=10), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            sa.Enum(
                'done', 'failed', 'canceled',
                name='payment_status',
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column('method', sa.String(length=30), nullable=True),
        sa.Column('receipt_url', sa.String(length=500), nullable=True),
        sa.Column('failure_code', sa.String(length=50), nullable=True),
        sa.Column('failure_message', sa.String(length=255), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['tb_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id', name='uq_payment_order_id'),
    )
    op.create_index(op.f('ix_tb_payments_id'), 'tb_payments', ['id'], unique=False)
    op.create_index(
        op.f('ix_tb_payments_user_id'), 'tb_payments', ['user_id'], unique=False
    )
    op.create_index(
        op.f('ix_tb_payments_payment_key'),
        'tb_payments',
        ['payment_key'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_tb_payments_payment_key'), table_name='tb_payments')
    op.drop_index(op.f('ix_tb_payments_user_id'), table_name='tb_payments')
    op.drop_index(op.f('ix_tb_payments_id'), table_name='tb_payments')
    op.drop_table('tb_payments')

    op.drop_index(op.f('ix_tb_subscriptions_user_id'), table_name='tb_subscriptions')
    op.drop_index(op.f('ix_tb_subscriptions_id'), table_name='tb_subscriptions')
    op.drop_table('tb_subscriptions')
