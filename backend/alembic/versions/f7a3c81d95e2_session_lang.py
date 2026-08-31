"""chat session lang

Revision ID: f7a3c81d95e2
Revises: e2f95b41c8d3
Create Date: 2026-08-31 00:00:00.000000

방문자가 어떤 언어로 대화했는지 남긴다.

지금까지 `lang` 은 요청 본문에서 시스템 프롬프트까지만 갔다가 버려졌다.
GLOBAL 을 파는데 "외국인 손님이 실제로 왔는지"를 볼 방법이 없었다 —
대화 로그에도, 통계에도 안 나온다. 봇 주인이 99,000원을 계속 낼 이유를
확인할 수 있는 유일한 숫자라 세션에 남긴다.

**nullable 이다.** 이미 쌓인 세션은 값을 만들 수 없다(요청 본문에만 있었고
어디에도 안 남았다). 소급 백필이 불가능하므로 NULL 을 그대로 두고,
화면이 "—"로 표시한다. `server_default` 를 주면 기존 행이 전부 'ko' 로
채워지는데, 그건 **모르는 것을 안다고 적는 것**이라 하지 않는다.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f7a3c81d95e2"
down_revision: Union[str, Sequence[str], None] = "e2f95b41c8d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tb_chat_sessions",
        sa.Column("lang", sa.String(length=5), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tb_chat_sessions", "lang")
