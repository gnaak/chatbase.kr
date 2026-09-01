"""SMTP 설정이 실제로 도는지 한 통 보내서 확인한다.

    python scripts/mail_test.py <받는주소>

`.env`를 그대로 읽고 `MailService`를 그대로 쓴다 — 즉 **여기서 성공하면
1:1 문의 메일도 성공한다.** 문의를 넣었다 지웠다 하지 않고 격리해서 볼 수 있다.

## 왜 필요한가

메일이 안 오는 이유는 크게 셋인데 증상이 똑같아서 구분이 안 된다:

  1. 설정이 안 켜짐        → `MAIL_ENABLED` / `SMTP_HOST`
  2. SMTP 접속·인증 실패    → 호스트·포트·계정
  3. 보내지긴 했는데 안 옴  → DNS(SPF·DKIM) 미비로 스팸함

이 스크립트는 1·2를 즉시 가른다. 여기서 성공(`[mail:sent]`)이 뜨는데 메일이
안 왔다면 **3번이고, 그건 코드가 아니라 DNS 문제다** — 제공자 대시보드의
Logs에서 반송·스팸 판정을 봐야 한다.

## 주의

**진짜로 발송한다.** 받는 주소를 본인 것으로 넣을 것.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config.settings import settings  # noqa: E402
from app.module.infra.mail.mail_service import MailService  # noqa: E402

_SUBJECT = "[chatbase.kr] SMTP 발송 테스트"
_BODY = """이 메일이 보이면 SMTP 설정이 정상입니다.

받은 편지함이 아니라 스팸함에서 찾았다면 DNS(SPF·DKIM·DMARC)가 아직
덜 붙은 것입니다. 제공자 대시보드의 Logs에서 판정을 확인하세요.

— chatbase.kr
"""


def _mask(value: str | None) -> str:
    """비밀번호를 로그에 흘리지 않으면서 '설정은 됐다'만 보여준다."""
    if not value:
        return "(없음)"
    return f"{value[:4]}…({len(value)}자)"


async def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    to = sys.argv[1].strip()

    print("현재 설정")
    print(f"  MAIL_ENABLED  : {settings.mail_enabled}")
    print(f"  MAIL_FROM     : {settings.mail_from}")
    print(f"  SMTP_HOST     : {settings.smtp_host or '(없음)'}")
    print(f"  SMTP_PORT     : {settings.smtp_port}")
    print(f"  SMTP_USER     : {settings.smtp_user or '(없음)'}")
    print(f"  SMTP_PASSWORD : {_mask(settings.smtp_password)}")
    print()

    # 사람이 읽을 수 있는 사전 진단. MailService는 조용히 False를 돌려주도록
    # 만들어져 있어서(호출자를 깨뜨리지 않으려고) 왜 안 갔는지가 안 보인다.
    if not settings.mail_enabled:
        print("✗ MAIL_ENABLED 가 false 다. .env 에 MAIL_ENABLED=true 를 넣어야 나간다.")
        return 1
    if not settings.smtp_host:
        print("✗ SMTP_HOST 가 비어 있다. .env 를 확인할 것.")
        return 1

    print(f"→ {to} 로 보내는 중…")
    sent = await MailService().send(to, _SUBJECT, _BODY)

    if sent:
        print()
        print("✓ SMTP 서버가 받았다.")
        print("  다만 이건 '도착했다'가 아니라 '넘겼다'는 뜻이다.")
        print("  받은 편지함과 스팸함을 둘 다 보고, 제공자 Logs에서 배달 여부를 확인할 것.")
        return 0

    print()
    print("✗ 발송 실패. 원문 예외는 로그에 있다:")
    print("    logs/app.log 또는 logs/error.log 의 [mail:failed]")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
