"""결제수단 분리 — tb_billing_methods

Revision ID: 886bc71373cd
Revises: e42a9c07b115
Create Date: 2026-08-27 10:02:20.576429

카드 정보를 tb_subscriptions에서 떼어내 tb_billing_methods로 옮긴다.
카드마다 billingKey가 하나씩 발급되므로 사용자당 여러 장이 되고,
구독은 그중 하나를 billing_method_id로 가리키기만 한다.

**두 가지를 손으로 고쳤다(autogenerate 출력 그대로는 실패한다).**

1. `ix_tb_subscriptions_user_id`를 유니크로 바꾸는 순서.
   user_id에는 tb_users를 향한 FK가 걸려 있어 MySQL은 그 FK를 덮는 인덱스가
   하나도 없는 순간을 허용하지 않는다. autogenerate는 uq_subscription_user를
   먼저 지우고 ix를 지우려 해서
   `(1553) Cannot drop index: needed in a foreign key constraint`로 끊긴다.
   임시 유니크 인덱스로 FK를 덮어놓고 교체한 뒤 임시를 지운다.

2. 재실행 안전하게 만들었다.
   MySQL DDL은 트랜잭션이 아니라 위 실패 시점까지의 문장이 그대로 커밋된다.
   각 단계를 현재 스키마를 보고 건너뛰므로, 중간까지 적용된 DB에서도
   처음부터 다시 돌릴 수 있다.

카드 컬럼은 이관 없이 드롭한다 — 토스 테스트 키가 아직 맞지 않아
실제로 발급된 billingKey가 하나도 없는 상태에서 적용되기 때문이다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '886bc71373cd'
down_revision: Union[str, Sequence[str], None] = 'e42a9c07b115'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CARD_COLUMNS = ("encrypted_billing_key", "card_company", "card_number", "card_type")


def _columns(insp, table: str) -> set[str]:
    return {c["name"] for c in insp.get_columns(table)}


def _indexes(insp, table: str) -> dict:
    """MySQL은 유니크 제약도 유니크 인덱스로 반영되므로 둘 다 여기서 잡힌다."""
    return {ix["name"]: ix for ix in insp.get_indexes(table)}


def _fk_columns(insp, table: str) -> set:
    return {
        tuple(fk["constrained_columns"]) for fk in insp.get_foreign_keys(table)
    }


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # ── tb_billing_methods ──────────────────────
    if "tb_billing_methods" not in insp.get_table_names():
        op.create_table(
            'tb_billing_methods',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('encrypted_billing_key', sa.LargeBinary(), nullable=False),
            sa.Column('card_company', sa.String(length=30), nullable=True),
            sa.Column('card_number', sa.String(length=30), nullable=True),
            sa.Column('card_type', sa.String(length=20), nullable=True),
            sa.Column('is_default', sa.Boolean(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['tb_users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            op.f('ix_tb_billing_methods_id'),
            'tb_billing_methods',
            ['id'],
            unique=False,
        )
        op.create_index(
            op.f('ix_tb_billing_methods_user_id'),
            'tb_billing_methods',
            ['user_id'],
            unique=False,
        )
        insp = sa.inspect(bind)

    # ── tb_subscriptions ────────────────────────
    sub_cols = _columns(insp, "tb_subscriptions")
    if "billing_method_id" not in sub_cols:
        op.add_column(
            'tb_subscriptions',
            sa.Column('billing_method_id', sa.Integer(), nullable=True),
        )
        insp = sa.inspect(bind)

    sub_idx = _indexes(insp, "tb_subscriptions")
    if "ix_tb_subscriptions_billing_method_id" not in sub_idx:
        op.create_index(
            op.f('ix_tb_subscriptions_billing_method_id'),
            'tb_subscriptions',
            ['billing_method_id'],
            unique=False,
        )

    if ("billing_method_id",) not in _fk_columns(insp, "tb_subscriptions"):
        op.create_foreign_key(
            'fk_subscriptions_billing_method',
            'tb_subscriptions',
            'tb_billing_methods',
            ['billing_method_id'],
            ['id'],
            ondelete='SET NULL',
        )

    # user_id 인덱스를 유니크로 교체. FK를 덮는 인덱스가 한 순간도 비면 안 된다.
    user_idx = sub_idx.get("ix_tb_subscriptions_user_id")
    if user_idx is not None and not user_idx.get("unique"):
        op.create_index(
            'ix_subscriptions_user_id_tmp',
            'tb_subscriptions',
            ['user_id'],
            unique=True,
        )
        op.drop_index('ix_tb_subscriptions_user_id', table_name='tb_subscriptions')
        op.create_index(
            op.f('ix_tb_subscriptions_user_id'),
            'tb_subscriptions',
            ['user_id'],
            unique=True,
        )
        op.drop_index('ix_subscriptions_user_id_tmp', table_name='tb_subscriptions')
    elif user_idx is None:
        op.create_index(
            op.f('ix_tb_subscriptions_user_id'),
            'tb_subscriptions',
            ['user_id'],
            unique=True,
        )

    # 이제 유니크 ix가 FK를 덮으므로 옛 유니크 제약을 지워도 안전하다.
    if "uq_subscription_user" in sub_idx:
        op.drop_index('uq_subscription_user', table_name='tb_subscriptions')

    if "ix_tb_subscriptions_customer_key" not in sub_idx:
        op.create_index(
            op.f('ix_tb_subscriptions_customer_key'),
            'tb_subscriptions',
            ['customer_key'],
            unique=True,
        )
    if "uq_subscription_customer_key" in sub_idx:
        op.drop_index('uq_subscription_customer_key', table_name='tb_subscriptions')

    for column in _CARD_COLUMNS:
        if column in sub_cols:
            op.drop_column('tb_subscriptions', column)

    # ── tb_payments ─────────────────────────────
    insp = sa.inspect(bind)
    pay_cols = _columns(insp, "tb_payments")
    if "billing_method_id" not in pay_cols:
        op.add_column(
            'tb_payments',
            sa.Column('billing_method_id', sa.Integer(), nullable=True),
        )
        insp = sa.inspect(bind)

    if ("billing_method_id",) not in _fk_columns(insp, "tb_payments"):
        op.create_foreign_key(
            'fk_payments_billing_method',
            'tb_payments',
            'tb_billing_methods',
            ['billing_method_id'],
            ['id'],
            ondelete='SET NULL',
        )

    pay_idx = _indexes(insp, "tb_payments")
    if "ix_tb_payments_order_id" not in pay_idx:
        op.create_index(
            op.f('ix_tb_payments_order_id'),
            'tb_payments',
            ['order_id'],
            unique=True,
        )
    if "uq_payment_order_id" in pay_idx:
        op.drop_index('uq_payment_order_id', table_name='tb_payments')


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # ── tb_payments ─────────────────────────────
    if ("billing_method_id",) in _fk_columns(insp, "tb_payments"):
        op.drop_constraint(
            'fk_payments_billing_method', 'tb_payments', type_='foreignkey'
        )
    pay_idx = _indexes(insp, "tb_payments")
    if "uq_payment_order_id" not in pay_idx:
        op.create_index(
            'uq_payment_order_id', 'tb_payments', ['order_id'], unique=True
        )
    if "ix_tb_payments_order_id" in pay_idx:
        op.drop_index('ix_tb_payments_order_id', table_name='tb_payments')
    if "billing_method_id" in _columns(insp, "tb_payments"):
        op.drop_column('tb_payments', 'billing_method_id')

    # ── tb_subscriptions ────────────────────────
    insp = sa.inspect(bind)
    sub_cols = _columns(insp, "tb_subscriptions")
    if "encrypted_billing_key" not in sub_cols:
        op.add_column(
            'tb_subscriptions',
            sa.Column('encrypted_billing_key', sa.LargeBinary(), nullable=True),
        )
        op.add_column(
            'tb_subscriptions',
            sa.Column('card_company', sa.String(length=30), nullable=True),
        )
        op.add_column(
            'tb_subscriptions',
            sa.Column('card_number', sa.String(length=30), nullable=True),
        )
        op.add_column(
            'tb_subscriptions',
            sa.Column('card_type', sa.String(length=20), nullable=True),
        )

    insp = sa.inspect(bind)
    if ("billing_method_id",) in _fk_columns(insp, "tb_subscriptions"):
        op.drop_constraint(
            'fk_subscriptions_billing_method', 'tb_subscriptions', type_='foreignkey'
        )

    sub_idx = _indexes(insp, "tb_subscriptions")
    if "uq_subscription_customer_key" not in sub_idx:
        op.create_index(
            'uq_subscription_customer_key',
            'tb_subscriptions',
            ['customer_key'],
            unique=True,
        )
    if "ix_tb_subscriptions_customer_key" in sub_idx:
        op.drop_index(
            'ix_tb_subscriptions_customer_key', table_name='tb_subscriptions'
        )

    # 유니크 ix → 비유니크 ix. 여기서도 FK를 덮는 인덱스를 먼저 만들어 둔다.
    if "uq_subscription_user" not in sub_idx:
        op.create_index(
            'uq_subscription_user', 'tb_subscriptions', ['user_id'], unique=True
        )
    user_idx = sub_idx.get("ix_tb_subscriptions_user_id")
    if user_idx is not None and user_idx.get("unique"):
        op.drop_index('ix_tb_subscriptions_user_id', table_name='tb_subscriptions')
        op.create_index(
            'ix_tb_subscriptions_user_id',
            'tb_subscriptions',
            ['user_id'],
            unique=False,
        )

    insp = sa.inspect(bind)
    sub_idx = _indexes(insp, "tb_subscriptions")
    if "ix_tb_subscriptions_billing_method_id" in sub_idx:
        op.drop_index(
            'ix_tb_subscriptions_billing_method_id', table_name='tb_subscriptions'
        )
    if "billing_method_id" in _columns(insp, "tb_subscriptions"):
        op.drop_column('tb_subscriptions', 'billing_method_id')

    # ── tb_billing_methods ──────────────────────
    insp = sa.inspect(bind)
    if "tb_billing_methods" in insp.get_table_names():
        op.drop_index(
            'ix_tb_billing_methods_user_id', table_name='tb_billing_methods'
        )
        op.drop_index('ix_tb_billing_methods_id', table_name='tb_billing_methods')
        op.drop_table('tb_billing_methods')
