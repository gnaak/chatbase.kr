"""정기 청구 배치.

cron이 매일 한 번 호출한다. 하는 일:
  - 청구일이 된 구독을 billingKey로 청구하고 다음 청구일을 한 달 뒤로 민다
  - 하향 예약(`scheduled_plan`)이 있으면 이번 청구부터 그 플랜을 적용한다
  - 해지 예정 구독은 청구하지 않고 그 날 만료시킨다(플랜 Free로)
  - 실패하면 하루 뒤 재시도, MAX_CHARGE_RETRY회를 넘기면 만료

왜 앱 안의 스케줄러가 아니라 cron인가:
  돈이 걸린 작업이라 앱과 생명주기를 분리한다. 서버가 재시작 중이어도 돌고,
  실패하면 로그를 보고 같은 명령으로 다시 돌릴 수 있어야 한다.

중복 실행은 안전하다:
  - 성공하면 next_billing_at이 한 달 뒤로 밀려 다시 잡히지 않는다
  - 조회에 SELECT ... FOR UPDATE SKIP LOCKED를 걸어 동시 실행에도 겹치지 않는다

실행:
  cd backend && uv run python -m app.cli.charge_subscriptions
  (미리보기) uv run python -m app.cli.charge_subscriptions --dry-run
"""

import asyncio
import sys

from app.core.database.base import SessionLocal
from app.core.logging import get_logger, setup_logging

logger = get_logger(__name__)


async def run(dry_run: bool = False) -> dict:
    from app.module.infra.toss.toss_service import TossService
    from app.module.payment.payment_repository import PaymentRepository
    from app.module.payment.payment_service import PaymentService
    from app.module.user.user_repository import UserRepository

    async with SessionLocal() as db:
        repo = PaymentRepository(db)

        if dry_run:
            from app.core.database.base import now_kst

            subs = await repo.find_due_subscriptions(now_kst())
            for sub in subs:
                logger.info(
                    "[dry-run] user_id=%s status=%s plan=%s scheduled=%s due=%s",
                    sub.user_id,
                    sub.status.value if sub.status else None,
                    sub.plan,
                    sub.scheduled_plan,
                    sub.next_billing_at,
                )
            logger.info("[dry-run] 대상 %s건", len(subs))
            return {"due": len(subs)}

        service = PaymentService(
            payment_repo=repo,
            user_repo=UserRepository(db),
            toss_service=TossService(),
        )
        return await service.charge_due_subscriptions()


def main() -> None:
    setup_logging()
    dry_run = "--dry-run" in sys.argv
    summary = asyncio.run(run(dry_run))
    logger.info("charge_subscriptions summary=%s", summary)


if __name__ == "__main__":
    main()
