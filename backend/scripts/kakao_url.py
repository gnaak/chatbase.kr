"""카카오 i 오픈빌더에 등록할 스킬 URL을 출력한다.

    python scripts/kakao_url.py <bot_slug> [base_url]

bot_slug는 대시보드 주소 /dashboard/bots/<slug> 에서 확인.
base_url을 생략하면 http://localhost:8000 (오픈빌더에 등록은 불가, 로컬 확인용).

오픈빌더는 공인 https URL만 받으므로 실제 등록에는 배포 도메인이나
ngrok 같은 터널 주소가 필요하다.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.module.kakao_skill.kakao_skill_service import issue_secret  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    slug = sys.argv[1].strip()
    base = (sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000").rstrip("/")
    secret = issue_secret(slug)

    print()
    print(f"  bot slug : {slug}")
    print(f"  secret   : {secret}")
    print()
    print("  스킬 URL (오픈빌더 > 스킬 > URL 에 붙여넣기)")
    print(f"  {base}/api/kakao/skill/{slug}?secret={secret}")
    print()
    print("  헤더로 넣고 싶으면 URL에서 ?secret=... 을 빼고")
    print(f"  X-Chatbase-Secret: {secret}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
