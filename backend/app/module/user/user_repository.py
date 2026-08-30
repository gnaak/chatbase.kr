# app/module/user/user_repository.py

import os

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.base import now_kst
from app.core.utils.response import fail
from app.core.utils.utm import utm_columns
from app.module.api_key.api_key import ApiKey
from app.module.bot.bot import Bot
from app.module.inquiry.inquiry import Inquiry
from app.module.payment.payment import BillingMethod, Subscription, SubscriptionStatus
from app.module.user.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_id(self, id: int):
        result = await self.db.execute(select(User).where(User.id == id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str):
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def create_user(self, email, nickname, hashed_password, utm=None):
        user = User(
            email=email,
            name=nickname,
            password=hashed_password,
            last_login_at=now_kst(),
            **utm_columns(utm),
        )

        self.db.add(user)
        await self.db.commit()

    async def get_or_create_user(
        self, email: str, name: str, picture: str, utm=None
    ) -> User | None:
        result = await self.db.execute(select(User).filter(User.email == email))
        user = result.unique().scalar_one_or_none()

        if user:
            # 구글·카카오 두 서비스가 모두 이 함수를 지난다. 각자 검사하게 두면
            # 한쪽만 고쳐지고 갈라지므로, 합류 지점인 여기서 한 번만 막는다.
            # (탈퇴한 계정은 이메일이 치환돼 있어 보통 여기 안 걸리고 새로 가입된다.
            #  걸리는 건 관리자가 수동으로 비활성화한 계정이다.)
            # NULL은 차단하지 않는다 — 이유는 auth_service.login 주석 참고.
            if user.active is False:
                fail("비활성화된 계정입니다.", "INACTIVE_ACCOUNT", 403)
            user.last_login_at=now_kst()
        else:
            # utm은 **새로 만들 때만** 넣는다. 기존 회원이 나중에 카페 링크를
            # 타고 다시 로그인해도 최초 유입 출처를 덮어쓰지 않는다.
            user = User(
                email=email,
                name=name,
                profile_image=picture,
                created_at=now_kst(),
                last_login_at=now_kst(),
                **utm_columns(utm),
            )

            self.db.add(user)
        
        await self.db.commit()
        await self.db.refresh(user)

        return user

    # ── 탈퇴 ────────────────────────────────────

    async def active_subscriptions(self, user_id: int) -> list[Subscription]:
        """탈퇴를 막아야 하는 구독만 고른다.

        ACTIVE는 아직 돈을 내고 쓰는 중이고, PAST_DUE는 미수금이 있다.
        CANCELED는 이미 해지 신청이 끝난 상태라 막지 않는다 —
        남은 기간을 포기하는 것은 본인 선택이다.
        """
        result = await self.db.execute(
            select(Subscription).where(
                Subscription.user_id == user_id,
                Subscription.status.in_(
                    [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]
                ),
            )
        )
        return list(result.scalars().all())

    async def list_bots(self, user_id: int) -> list[Bot]:
        result = await self.db.execute(select(Bot).where(Bot.user_id == user_id))
        return list(result.scalars().all())

    async def purge_user_data(self, user_id: int) -> None:
        """탈퇴 시 지워야 할 하위 데이터를 지운다. 커밋은 호출자가 한다.

        봇을 지우면 FK가 ON DELETE CASCADE라 학습 파일·대화 세션·대화 메시지·
        사용량이 DB 레벨에서 같이 지워진다. ORM 인스턴스를 하나씩 지우지 않고
        DELETE 문을 직접 쓰는 이유가 그것이다.

        **결제 이력(tb_payments)과 구독(tb_subscriptions)은 남긴다.**
        전자상거래법상 대금결제 기록은 5년 보관 의무가 있어서, 탈퇴했다고
        지우면 그 의무를 어긴다. 대신 사용자 행의 개인정보를 지워
        기록만 남고 사람은 식별되지 않게 한다(`anonymize`).

        결제수단(billingKey)은 보관 의무가 없고 그 자체로 청구가 가능하므로
        즉시 지운다.
        """
        await self.db.execute(delete(ApiKey).where(ApiKey.user_id == user_id))
        await self.db.execute(delete(Bot).where(Bot.user_id == user_id))
        await self.db.execute(
            delete(BillingMethod).where(BillingMethod.user_id == user_id)
        )
        # 구독은 남기되 더 이상 청구되지 않도록 참조를 끊고 상태를 정리한다.
        #
        # plan을 반드시 비운다. 게이팅(`plan_lookup.plan_of`)이 status를 안 보고
        # **plan 컬럼 하나만** 읽기 때문이다 — 값이 남아 있으면 탈퇴한 계정이
        # 영원히 PREMIUM으로 읽히고, 어드민 플랜 분포에도 계속 잡힌다.
        # next_billing_at을 비우는 순간 크론이 이 행을 다시 안 집으므로
        # `_expire`가 대신 비워줄 기회도 없다. 여기서 끝내야 한다.
        #
        # 어떤 플랜을 얼마에 썼는지는 tb_payments의 각 행에 남아 있어서
        # 기록 보관에는 영향이 없다.
        await self.db.execute(
            update(Subscription)
            .where(Subscription.user_id == user_id)
            .values(
                status=SubscriptionStatus.CANCELED,
                plan=None,
                billing_method_id=None,
                scheduled_plan=None,
                next_billing_at=None,
                canceled_at=now_kst(),
            )
        )
        # 문의는 상담 이력이라 남기되 연락처는 지운다.
        await self.db.execute(
            update(Inquiry)
            .where(Inquiry.user_id == user_id)
            .values(name="탈퇴한 사용자", email=None, phone=None, ip=None)
        )

    async def anonymize(self, user: User) -> None:
        """개인정보를 지우고 비활성화한다. 커밋은 호출자가 한다.

        행 자체를 지우지 않는 이유는 `purge_user_data` 주석 참고.

        email·workspace_slug·toss_customer_key는 UNIQUE라서 값을 남겨두면
        **같은 이메일로 재가입할 수 없다.** 그래서 반드시 치환하거나 비운다.
        """
        user.email = f"deleted+{user.id}@deleted.chatbase.kr"
        user.name = "탈퇴한 사용자"
        user.password = None
        user.profile_image = None
        user.workspace_name = None
        user.workspace_slug = None
        user.toss_customer_key = None
        user.active = False
