from datetime import datetime, timedelta

from sqlalchemy import func, select

from app.core.config.settings import settings
from app.core.database.base import now_kst
from app.core.utils.plan import PLAN_ORDER, Plan, Product, price_for, resolve_plan
from app.core.utils.response import fail, success
from app.module.admin.admin import Admin
from app.module.admin.admin_repository import AdminRepository
from app.module.api_key.api_key import ApiKey
from app.module.bot.bot import Bot
from app.module.chat.chat_session import ChatSession
from app.module.infra.anthropic.model_service import AnthropicModelService
from app.module.infra.gemini.model_service import GeminiModelService
from app.module.infra.llm import pricing as pricing_module
from app.module.infra.openai.model_service import OpenAIModelService
from app.module.llm_model.llm_model import LLMModel, ModelProvider, ModelType
from app.module.payment.payment import (
    BillingMethod,
    Payment,
    PaymentStatus,
    Subscription,
    SubscriptionStatus,
)
from app.module.user.user import User

PROVIDER_LABEL = {
    ModelProvider.OPENAI: "OpenAI",
    ModelProvider.ANTHROPIC: "Anthropic",
    ModelProvider.GEMINI: "Google Gemini",
}

PROVIDER_ORDER = [
    ModelProvider.OPENAI,
    ModelProvider.ANTHROPIC,
    ModelProvider.GEMINI,
]

#: 구독 목록 정렬 우선순위. 조치가 필요한 것(청구 실패)을 맨 위로 올린다.
SUBSCRIPTION_STATUS_ORDER = {
    SubscriptionStatus.PAST_DUE: 0,
    SubscriptionStatus.ACTIVE: 1,
    SubscriptionStatus.CANCELED: 2,
    SubscriptionStatus.NONE: 3,
}

#: 결제 내역 조회 기본/최대 건수. 전체를 통째로 내리면 운영이 커질수록 응답이 무거워진다.
PAYMENT_PAGE_DEFAULT = 200
PAYMENT_PAGE_MAX = 1000


def _enum_value(raw) -> str | None:
    return raw.value if hasattr(raw, "value") else raw


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _method_summary(method: BillingMethod | None) -> dict | None:
    """카드 표시용 정보. 프론트 `describeMethod`가 그대로 쓸 수 있는 형태로 맞춘다.

    billingKey는 절대 내려보내지 않는다 — 관리자 화면에서도 필요 없고,
    응답에 실리는 순간 암호화 저장이 무의미해진다.
    """
    if not method:
        return None
    return {
        "id": method.id,
        "method_type": _enum_value(method.method_type) or "card",
        "issuer": method.issuer,
        "masked_number": method.masked_number,
        "card_type": method.card_type,
        "is_default": bool(method.is_default),
        "created_at": _iso(method.created_at),
    }


def _model_to_dict(m: LLMModel, usage: dict | None = None) -> dict:
    pricing: dict = {}
    if m.type == ModelType.CHAT:
        if m.pricing_input is not None:
            pricing["input"] = m.pricing_input
        if m.pricing_output is not None:
            pricing["output"] = m.pricing_output
    else:
        if m.pricing_per_image is not None:
            pricing["per_image"] = m.pricing_per_image
    usage = usage or {}
    return {
        "id": m.id,
        "value": m.value,
        "label": m.label,
        "description": m.description,
        "pricing": pricing or None,
        "registered": m.is_active,
        "bot_count": usage.get("bot_count", 0),
        "user_count": usage.get("user_count", 0),
        "users": usage.get("users", []),  # [{id, email, name, bot_count}] 최대 5명
    }


class AdminService:
    def __init__(
        self,
        admin_repo: AdminRepository,
        openai_model_service: OpenAIModelService,
        anthropic_model_service: AnthropicModelService,
        gemini_model_service: GeminiModelService,
    ):
        self.admin_repo = admin_repo
        self.openai_model_service = openai_model_service
        self.anthropic_model_service = anthropic_model_service
        self.gemini_model_service = gemini_model_service

    async def get_admin_by_id(self, id: int) -> Admin:
        return await self.admin_repo.get_admin_by_id(id)

    # ── 고객 관리 ─────────────────────────────────
    async def list_users(self, request):
        db = self.admin_repo.db
        users = (
            await db.execute(select(User).order_by(User.id.desc()))
        ).scalars().all()

        bot_counts = dict(
            (
                await db.execute(
                    select(Bot.user_id, func.count(Bot.id)).group_by(Bot.user_id)
                )
            ).all()
        )

        key_rows = (await db.execute(select(ApiKey.user_id, ApiKey.provider))).all()
        keys_by_user: dict[int, list[str]] = {}
        for uid, prov in key_rows:
            keys_by_user.setdefault(uid, []).append(
                prov.value if hasattr(prov, "value") else str(prov)
            )

        session_rows = (
            await db.execute(
                select(Bot.user_id, func.count(ChatSession.id))
                .join(ChatSession, ChatSession.bot_id == Bot.id)
                .group_by(Bot.user_id)
            )
        ).all()
        session_counts = dict(session_rows)

        # 게이팅이 구독을 보므로 표시도 구독을 봐야 한다. 구독 행이 없는 사람은 FREE.
        plan_rows = (
            await db.execute(
                select(Subscription.user_id, Subscription.plan).where(
                    Subscription.product == Product.CHATBOT
                )
            )
        ).all()
        plan_by_user = dict(plan_rows)

        data = [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "active": u.active,
                # 챗봇 상품의 플랜. 구독이 없으면 free.
                "plan": resolve_plan(plan_by_user.get(u.id)).value,
                "workspace_name": u.workspace_name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": (
                    u.last_login_at.isoformat() if u.last_login_at else None
                ),
                "bot_count": bot_counts.get(u.id, 0),
                "key_providers": keys_by_user.get(u.id, []),
                "session_count": session_counts.get(u.id, 0),
            }
            for u in users
        ]
        return success(data=data)

    # ── 유입 출처 ─────────────────────────────────
    async def acquisition(self, request):
        """유입 출처별 가입 → 키 등록 → 유료 전환.

        **이 화면이 있는 이유**: GA4는 "cafe_apsa에서 34명 방문"까지만 안다.
        그 뒤 퍼널(가입·키 등록·결제)은 우리 DB에만 있어서, 둘을 잇는 값이
        `tb_users.utm_*` 이다. "어느 카페가 돈이 됐나"에 답하는 유일한 곳이다.

        UTM이 없는 가입은 `(직접)`으로 묶는다. **그 줄이 크다는 것 자체가 신호다**
        — 측정 안 되는 유입이 그만큼 많다는 뜻이라, 링크에 꼬리표를 안 달고
        홍보했거나 검색·직접 유입이 많다는 얘기가 된다.

        집계를 SQL 조인으로 짜지 않고 파이썬에서 묶는다. 세 축(가입·키·결제)이
        서로 다른 테이블이라 조인하면 중복 행이 생기고, 지금 규모에서는
        전부 읽어도 몇 백 행이다. 커지면 그때 바꾼다.
        """
        db = self.admin_repo.db

        users = (
            await db.execute(
                select(
                    User.id,
                    User.utm_source,
                    User.utm_medium,
                    User.utm_campaign,
                    User.active,
                )
            )
        ).all()

        # 키를 하나라도 등록한 사람 / 유료 구독이 살아 있는 사람.
        keyed = set(
            (await db.execute(select(ApiKey.user_id).distinct())).scalars().all()
        )
        paid = set(
            (
                await db.execute(
                    select(Subscription.user_id)
                    .where(Subscription.status == SubscriptionStatus.ACTIVE)
                    .distinct()
                )
            )
            .scalars()
            .all()
        )

        # 탈퇴자를 빼지 않고 따로 센다. 유입 성과는 "몇 명을 데려왔나"라서
        # 탈퇴자도 그 채널의 실적이다. 다만 탈퇴하면 키·구독이 정리되어
        # keyed·paid 에서는 자동으로 빠지므로, 세지 않으면
        # "가입 12인데 키 등록 5"가 이탈 때문인지 마찰 때문인지 구분이 안 된다.
        buckets: dict[tuple, dict] = {}
        for user_id, source, medium, campaign, active in users:
            key = (source or "", medium or "", campaign or "")
            row = buckets.setdefault(
                key,
                {
                    "source": source or "(직접)",
                    "medium": medium or "",
                    "campaign": campaign or "",
                    "signups": 0,
                    "withdrawn": 0,
                    "keyed": 0,
                    "paid": 0,
                },
            )
            row["signups"] += 1
            # active가 nullable이라 NULL은 탈퇴로 보지 않는다
            # (DB에 직접 넣은 행이 NULL일 수 있다 — auth_service.login 주석과 같은 이유).
            if active is False:
                row["withdrawn"] += 1
            if user_id in keyed:
                row["keyed"] += 1
            if user_id in paid:
                row["paid"] += 1

        # 결제 → 키 등록 → 가입 순. 돈이 된 채널이 위로 온다.
        rows = sorted(
            buckets.values(),
            key=lambda r: (r["paid"], r["keyed"], r["signups"]),
            reverse=True,
        )

        return success(
            data={
                "rows": rows,
                "total_signups": len(users),
                "untracked_signups": sum(
                    1 for u in users if not u[1]
                ),
            }
        )

    # ── 결제 관리 (조회 전용) ──────────────────────
    async def _paid_totals_by_user(self) -> dict[int, dict]:
        """사용자별 누적 성공 결제액·건수."""
        rows = (
            await self.admin_repo.db.execute(
                select(
                    Payment.user_id,
                    func.coalesce(func.sum(Payment.amount), 0),
                    func.count(Payment.id),
                )
                .where(Payment.status == PaymentStatus.DONE)
                .group_by(Payment.user_id)
            )
        ).all()
        return {
            uid: {"paid_total": int(total or 0), "paid_count": int(count or 0)}
            for uid, total, count in rows
        }

    async def billing_summary(self, request):
        """결제 지표. 화면 상단 카드용.

        MRR은 ACTIVE 구독만 센다 — 해지 예정(CANCELED)은 다음 달에 청구되지 않으므로
        여기에 넣으면 이미 빠져나간 매출을 계속 잡고 있게 된다.
        """
        db = self.admin_repo.db
        # DATETIME 컬럼은 naive로 돌아오므로 비교 기준도 naive KST로 맞춘다.
        now = now_kst().replace(tzinfo=None)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        subs = (await db.execute(select(Subscription))).scalars().all()

        status_counts = {s.value: 0 for s in SubscriptionStatus}
        mrr = 0
        for sub in subs:
            status = sub.status or SubscriptionStatus.NONE
            key = _enum_value(status)
            status_counts[key] = status_counts.get(key, 0) + 1
            if status == SubscriptionStatus.ACTIVE:
                # 하향 예약이 걸려 있으면 다음 청구부터 그 금액이라, 그게 실제 MRR이다.
                mrr += price_for(resolve_plan(sub.scheduled_plan or sub.plan))

        # 유료 플랜은 구독에서 세고, FREE는 "나머지 전부"로 잡는다.
        # 구독 행이 아예 없는 사람도 FREE라 구독만 group by 하면 빠진다.
        paid_rows = (
            await db.execute(
                select(Subscription.plan, func.count(Subscription.id))
                .where(Subscription.product == Product.CHATBOT)
                .group_by(Subscription.plan)
            )
        ).all()
        plan_counts = {p.value: 0 for p in PLAN_ORDER}
        for raw, count in paid_rows:
            plan = resolve_plan(raw)
            if plan == Plan.FREE:
                continue  # plan이 비어 있는 구독(NONE/만료)은 아래에서 FREE로 잡힌다
            plan_counts[plan.value] = plan_counts.get(plan.value, 0) + int(count or 0)
        total_users = int(
            (await db.execute(select(func.count(User.id)))).scalar() or 0
        )
        plan_counts[Plan.FREE.value] = max(
            0, total_users - sum(v for k, v in plan_counts.items() if k != Plan.FREE.value)
        )

        async def _revenue(*conditions) -> int:
            value = (
                await db.execute(
                    select(func.coalesce(func.sum(Payment.amount), 0)).where(
                        Payment.status == PaymentStatus.DONE, *conditions
                    )
                )
            ).scalar()
            return int(value or 0)

        failed_30d = (
            await db.execute(
                select(func.count(Payment.id)).where(
                    Payment.status == PaymentStatus.FAILED,
                    Payment.created_at >= now - timedelta(days=30),
                )
            )
        ).scalar()

        return success(
            data={
                "mrr": mrr,
                "active_count": status_counts.get(SubscriptionStatus.ACTIVE.value, 0),
                "canceled_count": status_counts.get(
                    SubscriptionStatus.CANCELED.value, 0
                ),
                "past_due_count": status_counts.get(
                    SubscriptionStatus.PAST_DUE.value, 0
                ),
                "none_count": status_counts.get(SubscriptionStatus.NONE.value, 0),
                "plan_counts": plan_counts,
                "revenue_this_month": await _revenue(
                    Payment.approved_at >= month_start
                ),
                "revenue_total": await _revenue(),
                "failed_30d": int(failed_30d or 0),
            }
        )

    async def list_subscriptions(self, request):
        """구독 목록. 결제 프로필만 만들어진(NONE) 행도 함께 내린다 —
        카드까지 등록하고 결제를 멈춘 사용자가 이탈 지점이라 걸러내면 안 보인다."""
        db = self.admin_repo.db

        rows = (
            await db.execute(
                select(Subscription, User).join(User, User.id == Subscription.user_id)
            )
        ).all()

        methods = (await db.execute(select(BillingMethod))).scalars().all()
        method_by_id = {m.id: m for m in methods}
        method_counts: dict[int, int] = {}
        for m in methods:
            method_counts[m.user_id] = method_counts.get(m.user_id, 0) + 1

        totals = await self._paid_totals_by_user()

        def _sort_key(pair):
            sub = pair[0]
            status = sub.status or SubscriptionStatus.NONE
            return (
                SUBSCRIPTION_STATUS_ORDER.get(status, 9),
                sub.next_billing_at or datetime.max,
                -sub.id,
            )

        data = []
        for sub, user in sorted(rows, key=_sort_key):
            status = sub.status or SubscriptionStatus.NONE
            paid = totals.get(user.id, {})

            # `plan_mismatch`가 있던 자리. 게이팅이 이제 이 구독 행을 직접 읽으므로
            # "받은 돈과 열어준 기능이 어긋나는" 상태 자체가 생길 수 없다.
            data.append(
                {
                    "user_id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "product": _enum_value(sub.product) or Product.CHATBOT.value,
                    "status": _enum_value(status),
                    "plan": sub.plan,
                    "scheduled_plan": sub.scheduled_plan,
                    "method": _method_summary(method_by_id.get(sub.billing_method_id)),
                    "method_count": method_counts.get(user.id, 0),
                    "retry_count": sub.retry_count or 0,
                    "paid_total": paid.get("paid_total", 0),
                    "paid_count": paid.get("paid_count", 0),
                    "started_at": _iso(sub.started_at),
                    "next_billing_at": _iso(sub.next_billing_at),
                    "canceled_at": _iso(sub.canceled_at),
                    "created_at": _iso(sub.created_at),
                }
            )

        return success(data=data)

    async def list_payments(self, request):
        """전체 결제 내역. 실패 건도 포함한다 — 실패 사유가 CS의 시작점이다."""
        db = self.admin_repo.db

        raw_limit = request.query_params.get("limit")
        try:
            limit = int(raw_limit) if raw_limit else PAYMENT_PAGE_DEFAULT
        except ValueError:
            limit = PAYMENT_PAGE_DEFAULT
        limit = max(1, min(limit, PAYMENT_PAGE_MAX))

        total = (await db.execute(select(func.count(Payment.id)))).scalar()

        rows = (
            await db.execute(
                select(Payment, User)
                .join(User, User.id == Payment.user_id)
                .order_by(Payment.created_at.desc(), Payment.id.desc())
                .limit(limit)
            )
        ).all()

        items = [
            {
                "id": p.id,
                "user_id": user.id,
                "email": user.email,
                "name": user.name,
                "order_id": p.order_id,
                # 토스 콘솔에서 같은 건을 찾을 때 쓰는 키.
                "payment_key": p.payment_key,
                "plan": p.plan,
                "amount": p.amount,
                "status": _enum_value(p.status),
                "method": p.method,
                "receipt_url": p.receipt_url,
                "failure_code": p.failure_code,
                "failure_message": p.failure_message,
                "approved_at": _iso(p.approved_at),
                "created_at": _iso(p.created_at),
            }
            for p, user in rows
        ]

        return success(
            data={"items": items, "total": int(total or 0), "limit": limit}
        )

    # ── 모델 카탈로그 ─────────────────────────────
    async def list_catalog(self, request):
        """provider별 카탈로그 반환. 모델별 사용 중인 봇/유저 수 포함.

        챗 모델만 내린다 — 이미지 모델은 제품에서 쓰는 곳이 없어서
        목록에 섞이면 관리자가 훑을 줄만 늘어난다.
        """
        db = self.admin_repo.db
        rows = (
            await db.execute(
                select(LLMModel)
                .where(LLMModel.type == ModelType.CHAT)
                .order_by(LLMModel.sort_order, LLMModel.id)
            )
        ).scalars().all()

        # 모델별 사용 중인 봇 수 + 유저 수 집계
        usage_rows = (
            await db.execute(
                select(
                    Bot.model,
                    Bot.user_id,
                    User.email,
                    User.name,
                )
                .join(User, User.id == Bot.user_id)
                .where(Bot.active.is_(True))
            )
        ).all()

        usage_map: dict[str, dict] = {}
        for model_value, user_id, email, name in usage_rows:
            entry = usage_map.setdefault(
                model_value,
                {"bot_count": 0, "users": {}},
            )
            entry["bot_count"] += 1
            user_entry = entry["users"].setdefault(
                user_id,
                {"id": user_id, "email": email, "name": name, "bot_count": 0},
            )
            user_entry["bot_count"] += 1

        usage_for_model: dict[str, dict] = {}
        for value, info in usage_map.items():
            users = sorted(
                info["users"].values(),
                key=lambda u: u["bot_count"],
                reverse=True,
            )
            usage_for_model[value] = {
                "bot_count": info["bot_count"],
                "user_count": len(users),
                "users": users[:5],
            }

        # image 키는 빈 배열로 유지한다 — 프론트가 그대로 읽고 있어서
        # 키를 지우면 화면이 깨진다. 챗만 채워진다.
        grouped: dict[ModelProvider, dict[str, list]] = {
            p: {"chat": [], "image": []} for p in PROVIDER_ORDER
        }
        for m in rows:
            grouped[m.provider]["chat"].append(
                _model_to_dict(m, usage_for_model.get(m.value))
            )

        data = [
            {
                "provider": p.value,
                "label": PROVIDER_LABEL[p],
                "chat": grouped[p]["chat"],
                "image": grouped[p]["image"],
            }
            for p in PROVIDER_ORDER
        ]
        return success(data=data)

    async def refresh_catalog(self, request):
        """3사 SDK models.list() → DB upsert. 운영자 키(.env)로 호출."""
        db = self.admin_repo.db

        existing_rows = (await db.execute(select(LLMModel))).scalars().all()
        existing: dict[str, LLMModel] = {m.value: m for m in existing_rows}

        added = 0
        updated = 0
        errors: list[str] = []

        try:
            pricing_data = await pricing_module.fetch_pricing_data()
        except Exception as exc:
            errors.append(f"가격 데이터 조회 실패: {exc}")
            pricing_data = {}

        async def _process(provider: ModelProvider, key: str | None, svc):
            nonlocal added, updated
            if not key:
                errors.append(f"{provider.value}: 운영자 키 미설정")
                return
            try:
                discovered = await svc.discover(key, pricing_data)
            except Exception as exc:
                errors.append(f"{provider.value}: {exc}")
                return
            # 챗 모델만 등록한다. 이미지 모델은 쓰는 기능이 없어서 받아두면
            # 카탈로그만 불어나고 가격 갱신 대상으로 계속 따라다닌다.
            for item in discovered.get("chat", []):
                mid = item["value"]
                pricing = item.get("pricing") or {}
                if mid in existing:
                    m = existing[mid]
                    changed = False
                    if m.provider != provider:
                        m.provider = provider
                        changed = True
                    if m.type != ModelType.CHAT:
                        m.type = ModelType.CHAT
                        changed = True
                    # 가격은 매번 갱신 (LiteLLM 데이터가 SOT)
                    new_in = pricing.get("input")
                    new_out = pricing.get("output")
                    if m.pricing_input != new_in:
                        m.pricing_input = new_in
                        changed = True
                    if m.pricing_output != new_out:
                        m.pricing_output = new_out
                        changed = True
                    if changed:
                        updated += 1
                else:
                    m = LLMModel(
                        type=ModelType.CHAT,
                        value=mid,
                        label=mid,
                        provider=provider,
                        is_active=False,
                        sort_order=999,
                        pricing_input=pricing.get("input"),
                        pricing_output=pricing.get("output"),
                    )
                    db.add(m)
                    existing[mid] = m
                    added += 1

        await _process(
            ModelProvider.OPENAI,
            settings.admin_openai_api_key,
            self.openai_model_service,
        )
        await _process(
            ModelProvider.ANTHROPIC,
            settings.admin_anthropic_api_key,
            self.anthropic_model_service,
        )
        await _process(
            ModelProvider.GEMINI,
            settings.admin_gemini_api_key,
            self.gemini_model_service,
        )

        await db.commit()
        return success(data={"added": added, "updated": updated, "errors": errors})

    async def set_model_active(self, request):
        body = await request.json()
        value = (body.get("value") or "").strip()
        active = bool(body.get("active"))
        force = bool(body.get("force"))
        if not value:
            fail("value가 필요합니다.", "VALUE_REQUIRED")
        m = (
            await self.admin_repo.db.execute(
                select(LLMModel).where(LLMModel.value == value)
            )
        ).scalar_one_or_none()
        if not m:
            fail("모델을 찾을 수 없습니다.", "MODEL_NOT_FOUND", 404)

        # 사용 해제 시도 시: 활성 봇이 있으면 force 없으면 거부
        if not active and not force:
            in_use = (
                await self.admin_repo.db.execute(
                    select(func.count(Bot.id)).where(
                        Bot.model == value, Bot.active.is_(True)
                    )
                )
            ).scalar()
            if in_use and in_use > 0:
                fail(
                    f"이 모델을 사용 중인 활성 봇이 {in_use}개 있습니다. "
                    f"강제 해제는 force=true로 다시 요청하세요.",
                    "MODEL_IN_USE",
                    409,
                )

        m.is_active = active
        await self.admin_repo.db.commit()
        return success(data={"value": value, "active": active})
