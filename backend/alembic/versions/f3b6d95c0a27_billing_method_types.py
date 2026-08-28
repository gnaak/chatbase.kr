"""결제수단 종류 지원 — 카드 + 계좌이체

Revision ID: f3b6d95c0a27
Revises: 886bc71373cd
Create Date: 2026-08-27 00:00:00.000000

자동결제로 등록할 수 있는 수단은 카드만이 아니다. 계좌이체(자동이체)도 되고,
간편결제(토스페이·네이버페이)는 카드 빌링의 변형으로 들어온다.
카드 전용이던 컬럼을 수단 공용으로 바꾼다.

  card_company → issuer         (카드사 코드 또는 은행명)
  card_number  → masked_number  (마스킹된 카드번호 또는 계좌번호)
  card_type                     (카드 전용 — 신용/체크/기프트, 계좌면 NULL)

tb_billing_methods는 아직 행이 없어(테스트 키가 맞지 않아 발급된 billingKey가 없다)
데이터 변환 없이 컬럼 이름만 바꾼다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3b6d95c0a27'
down_revision: Union[str, Sequence[str], None] = '886bc71373cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'tb_billing_methods',
        sa.Column(
            'method_type',
            sa.Enum(
                'card', 'transfer',
                name='billing_method_type',
                native_enum=False,
                length=10,
            ),
            nullable=False,
            # NOT NULL 컬럼을 추가하려면 기존 행을 채울 값이 필요하다.
            # 채운 뒤에는 바로 걷어낸다 — 모델에는 server_default가 없어서
            # 남겨두면 `alembic check`가 매번 드리프트로 잡는다.
            server_default='CARD',
        ),
    )
    op.alter_column(
        'tb_billing_methods',
        'method_type',
        existing_type=sa.String(length=10),
        existing_nullable=False,
        server_default=None,
    )
    op.alter_column(
        'tb_billing_methods',
        'card_company',
        new_column_name='issuer',
        existing_type=sa.String(length=30),
        existing_nullable=True,
    )
    op.alter_column(
        'tb_billing_methods',
        'card_number',
        new_column_name='masked_number',
        existing_type=sa.String(length=30),
        existing_nullable=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'tb_billing_methods',
        'masked_number',
        new_column_name='card_number',
        existing_type=sa.String(length=30),
        existing_nullable=True,
    )
    op.alter_column(
        'tb_billing_methods',
        'issuer',
        new_column_name='card_company',
        existing_type=sa.String(length=30),
        existing_nullable=True,
    )
    op.drop_column('tb_billing_methods', 'method_type')
