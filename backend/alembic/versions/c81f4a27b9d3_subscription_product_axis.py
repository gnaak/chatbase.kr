"""subscription product axis

Revision ID: c81f4a27b9d3
Revises: b5c93d18e6f2
Create Date: 2026-08-30 00:00:00.000000

구독을 "사용자당 하나"에서 "사용자 x 상품당 하나"로 바꾼다.

챗봇을 안 써도 AEO만 구독할 수 있어야 한다. 두 상품은 서로를 전제하지 않는다.

같이 옮기는 것: `customer_key`가 `tb_subscriptions` -> `tb_users`.
토스 billingKey가 customerKey에 묶여 있어서, 상품별로 구독 행이 늘어나는데
customerKey도 같이 늘어나면 **같은 카드를 상품 수만큼 다시 등록**해야 한다.
구매자 식별자는 사람당 하나가 맞다.

**인덱스 삭제 순서 주의(886bc71373cd에서 겪은 것과 같은 함정).**
`user_id`에는 tb_users를 향한 FK가 있어서, MySQL은 그 FK를 덮는 인덱스가
하나도 없는 순간을 허용하지 않는다. 그래서
  (1) 새 복합 유니크를 먼저 만들고  ← user_id가 맨 왼쪽이라 FK를 덮는다
  (2) 그 다음 옛 유니크 인덱스를 지운다
순서를 지켜야 `(1553) Cannot drop index: needed in a foreign key constraint`를 피한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c81f4a27b9d3'
down_revision: Union[str, Sequence[str], None] = 'b5c93d18e6f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ── 1. customer_key를 사람 쪽으로 옮긴다 ──────────────────
    op.add_column(
        'tb_users',
        sa.Column('toss_customer_key', sa.String(length=64), nullable=True),
    )
    # 기존 구독의 값을 그대로 옮긴다. 사용자당 구독이 하나였으므로 충돌이 없다.
    op.execute(
        """
        UPDATE tb_users u
        JOIN tb_subscriptions s ON s.user_id = u.id
        SET u.toss_customer_key = s.customer_key
        """
    )
    op.create_index(
        op.f('ix_tb_users_toss_customer_key'),
        'tb_users',
        ['toss_customer_key'],
        unique=True,
    )

    # ── 2. 상품 축 추가 ─────────────────────────────────────
    # 기존 행은 전부 챗봇 구독이다. server_default로 채운 뒤 걷어낸다 —
    # 모델에는 server_default가 없어서 남겨두면 드리프트가 된다.
    op.add_column(
        'tb_subscriptions',
        sa.Column(
            'product',
            sa.Enum(
                'CHATBOT', 'AEO',
                name='subscription_product',
                native_enum=False,
                length=20,
            ),
            nullable=False,
            server_default='CHATBOT',
        ),
    )
    op.alter_column(
        'tb_subscriptions',
        'product',
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default=None,
    )

    op.add_column(
        'tb_payments',
        sa.Column(
            'product',
            sa.Enum(
                'CHATBOT', 'AEO',
                name='payment_product',
                native_enum=False,
                length=20,
            ),
            nullable=False,
            server_default='CHATBOT',
        ),
    )
    op.alter_column(
        'tb_payments',
        'product',
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default=None,
    )

    # ── 3. 유니크 교체 (순서 중요 — 파일 상단 주석 참고) ──────
    op.create_index(
        'uq_subscription_user_product',
        'tb_subscriptions',
        ['user_id', 'product'],
        unique=True,
    )
    # 이제 복합 유니크가 FK를 덮으므로 옛 인덱스를 지워도 안전하다.
    op.drop_index('ix_tb_subscriptions_user_id', table_name='tb_subscriptions')
    # 모델에는 index=True(비유니크)가 남아 있다. 복합 인덱스가 user_id를 맨 왼쪽에
    # 두고 있어 조회는 그걸로 끝나지만, 모델과 맞추기 위해 다시 만든다.
    op.create_index(
        op.f('ix_tb_subscriptions_user_id'),
        'tb_subscriptions',
        ['user_id'],
        unique=False,
    )

    # ── 4. 옮긴 컬럼 제거 ───────────────────────────────────
    op.drop_index(
        'ix_tb_subscriptions_customer_key', table_name='tb_subscriptions'
    )
    op.drop_column('tb_subscriptions', 'customer_key')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'tb_subscriptions',
        sa.Column('customer_key', sa.String(length=64), nullable=True),
    )
    op.execute(
        """
        UPDATE tb_subscriptions s
        JOIN tb_users u ON s.user_id = u.id
        SET s.customer_key = u.toss_customer_key
        """
    )
    # AEO 구독이 있으면 사용자당 한 행 제약으로 되돌릴 수 없다. 챗봇만 남긴다.
    op.execute("DELETE FROM tb_subscriptions WHERE product <> 'CHATBOT'")
    op.execute("DELETE FROM tb_payments WHERE product <> 'CHATBOT'")

    op.create_index(
        'ix_tb_subscriptions_customer_key',
        'tb_subscriptions',
        ['customer_key'],
        unique=True,
    )
    op.drop_index('ix_tb_subscriptions_user_id', table_name='tb_subscriptions')
    op.create_index(
        'ix_tb_subscriptions_user_id',
        'tb_subscriptions',
        ['user_id'],
        unique=True,
    )
    op.drop_index('uq_subscription_user_product', table_name='tb_subscriptions')

    op.drop_column('tb_payments', 'product')
    op.drop_column('tb_subscriptions', 'product')
    op.drop_index(op.f('ix_tb_users_toss_customer_key'), table_name='tb_users')
    op.drop_column('tb_users', 'toss_customer_key')
