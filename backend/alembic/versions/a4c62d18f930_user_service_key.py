"""user.use_service_key — 제공 키 사용 여부

Revision ID: a4c62d18f930
Revises: f7a3c81d95e2
Create Date: 2026-09-11 00:00:00.000000

OpenAI 를 **우리가 제공하는 키**로 쓸지, 본인이 등록한 키로 쓸지.

BYOK 전면이던 때는 가입해도 키를 넣기 전까지 첫 대화가 실패했다. 타겟이
숙소·관광·외식 사장님인데 "OpenAI 계정 만들고 카드 등록하고 키 발급받아 오세요"는
사실상 불가능한 요구였다. 그래서 제공 키를 기본 경로로 돌리면서 생긴 컬럼이다.

**기본값 True.** 가입 직후 아무것도 안 해도 동작해야 한다. 기존 사용자도 True 로
들어가는데, 그들은 이미 본인 키가 있어서 이 값을 끄면 예전 동작으로 돌아간다 —
화면에서 한 번 누르면 된다.

계정 단위인 이유: 고르는 자리가 키 화면이라서다. 봇마다 다르게 하고 싶어지면
그건 이 컬럼이 아니라 `tb_bots` 쪽에 붙어야 한다.

`server_default="1"` 을 주는 이유: 앱의 `default=True` 는 파이썬 레벨이라
**이미 있는 행에는 적용되지 않는다.** NOT NULL 제약에 걸린다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4c62d18f930"
down_revision: Union[str, None] = "f7a3c81d95e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tb_users",
        sa.Column(
            "use_service_key",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tb_users", "use_service_key")
