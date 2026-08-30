"""bot multilingual + per-language greetings

Revision ID: c9e4a1f70b23
Revises: a7f2c941e83b
Create Date: 2026-08-30 00:00:00.000000

QR을 찍은 외국인 방문자에게 그 사람 언어로 응대하기 위한 두 컬럼.

## multilingual

켜면 시스템 프롬프트에 "사용자가 쓴 언어로 답하라" 규칙이 붙는다. 번역 API도
언어 감지도 쓰지 않는다 — LLM이 사용자 메시지를 보고 맞춘다. 그래서 원가가 0이고,
BYOK면 우리 원가도 0이다.

**기본값 False다.** 켜져 있는 줄 모르고 한국 손님에게 영어가 나가면 사고라서,
기존 봇은 전부 지금 그대로 동작해야 한다.

## greetings

첫 인사말만 언어별로 미리 저장한다. 이유: 첫 화면은 **방문자가 아직 아무 말도
하기 전**이라 LLM이 언어를 알 방법이 없다. 나머지 대화는 사용자가 쓴 언어를 보고
맞추면 되지만 인사말만은 준비돼 있어야 한다. QR을 찍은 외국인이 처음 보는 화면이
여기라, 한국어가 뜨면 데모가 첫 줄에서 깨진다.

한국어 인사말은 기존 `greeting` 컬럼을 그대로 쓴다. 없는 언어도 `greeting`으로
떨어지므로 이 컬럼이 비어 있어도 동작이 깨지지 않는다.

JSON 컬럼인 이유: `{"en": "...", "ja": "...", "zh": "..."}` 형태이고 이걸로
집계하거나 필터링하는 화면이 없다. 언어가 늘어도 마이그레이션이 필요 없다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9e4a1f70b23"
down_revision: Union[str, None] = "a7f2c941e83b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default="0" 을 준다. 기존 행이 NULL 이 되면 NOT NULL 제약에 걸리고,
    # 앱의 default=False 는 파이썬 레벨이라 이미 있는 행에는 적용되지 않는다.
    op.add_column(
        "tb_bots",
        sa.Column(
            "multilingual",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column("tb_bots", sa.Column("greetings", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("tb_bots", "greetings")
    op.drop_column("tb_bots", "multilingual")
