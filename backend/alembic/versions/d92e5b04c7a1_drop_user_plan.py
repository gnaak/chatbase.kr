"""drop user plan

Revision ID: d92e5b04c7a1
Revises: c81f4a27b9d3
Create Date: 2026-08-30 00:00:00.000000

`tb_users.plan` 제거.

이 컬럼은 이름만 plan이지 사실상 **챗봇 플랜**이었다. 상품이 둘이 되면서
사용자 테이블의 컬럼 하나로는 표현이 안 된다 — AEO만 구독하는 사람에게
`plan='free'`가 박혀 있는 건 의미 없는 값이다.

게이팅은 `c81f4a27b9d3` 이후 `tb_subscriptions.plan`을 직접 읽는다
(`payment/plan_lookup.py`). 이 리비전은 읽지도 쓰지도 않게 된 컬럼을 걷어낸다.

되돌릴 때는 구독에서 값을 복원한다 — 두 값이 늘 같이 갱신돼 왔으므로
복원 결과가 원래 값과 같다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd92e5b04c7a1'
down_revision: Union[str, Sequence[str], None] = 'c81f4a27b9d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('tb_users', 'plan')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'tb_users',
        sa.Column(
            'plan',
            sa.String(length=10),
            nullable=False,
            server_default='free',
        ),
    )
    # 챗봇 구독의 플랜을 되돌려 넣는다. 구독이 없거나 비어 있으면 free 그대로.
    op.execute(
        """
        UPDATE tb_users u
        JOIN tb_subscriptions s
          ON s.user_id = u.id AND s.product = 'CHATBOT'
        SET u.plan = s.plan
        WHERE s.plan IS NOT NULL
        """
    )
