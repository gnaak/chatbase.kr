from sqlalchemy import func, select

from app.core.config.settings import settings
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


def _model_to_dict(m: LLMModel) -> dict:
    pricing: dict = {}
    if m.type == ModelType.CHAT:
        if m.pricing_input is not None:
            pricing["input"] = m.pricing_input
        if m.pricing_output is not None:
            pricing["output"] = m.pricing_output
    else:
        if m.pricing_per_image is not None:
            pricing["per_image"] = m.pricing_per_image
    return {
        "id": m.id,
        "value": m.value,
        "label": m.label,
        "pricing": pricing or None,
        "registered": m.is_active,
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

        data = [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "active": u.active,
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

    # ── 모델 카탈로그 ─────────────────────────────
    async def list_catalog(self, request):
        """provider별로 chat/image 그룹핑된 카탈로그 반환."""
        db = self.admin_repo.db
        rows = (
            await db.execute(
                select(LLMModel).order_by(LLMModel.sort_order, LLMModel.id)
            )
        ).scalars().all()

        grouped: dict[ModelProvider, dict[str, list]] = {
            p: {"chat": [], "image": []} for p in PROVIDER_ORDER
        }
        for m in rows:
            kind = "chat" if m.type == ModelType.CHAT else "image"
            grouped[m.provider][kind].append(_model_to_dict(m))

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
            for kind, items in (
                (ModelType.CHAT, discovered.get("chat", [])),
                (ModelType.IMAGE, discovered.get("image", [])),
            ):
                for item in items:
                    mid = item["value"]
                    pricing = item.get("pricing") or {}
                    if mid in existing:
                        m = existing[mid]
                        changed = False
                        if m.provider != provider:
                            m.provider = provider
                            changed = True
                        if m.type != kind:
                            m.type = kind
                            changed = True
                        # 가격은 매번 갱신 (LiteLLM 데이터가 SOT)
                        if kind == ModelType.CHAT:
                            new_in = pricing.get("input")
                            new_out = pricing.get("output")
                            if m.pricing_input != new_in:
                                m.pricing_input = new_in
                                changed = True
                            if m.pricing_output != new_out:
                                m.pricing_output = new_out
                                changed = True
                        else:
                            new_per = pricing.get("per_image")
                            if m.pricing_per_image != new_per:
                                m.pricing_per_image = new_per
                                changed = True
                        if changed:
                            updated += 1
                    else:
                        m = LLMModel(
                            type=kind,
                            value=mid,
                            label=mid,
                            provider=provider,
                            is_active=False,
                            sort_order=999,
                            pricing_input=pricing.get("input")
                            if kind == ModelType.CHAT
                            else None,
                            pricing_output=pricing.get("output")
                            if kind == ModelType.CHAT
                            else None,
                            pricing_per_image=pricing.get("per_image")
                            if kind == ModelType.IMAGE
                            else None,
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
        if not value:
            fail("value가 필요합니다.", "VALUE_REQUIRED")
        m = (
            await self.admin_repo.db.execute(
                select(LLMModel).where(LLMModel.value == value)
            )
        ).scalar_one_or_none()
        if not m:
            fail("모델을 찾을 수 없습니다.", "MODEL_NOT_FOUND", 404)
        m.is_active = active
        await self.admin_repo.db.commit()
        return success(data={"value": value, "active": active})
