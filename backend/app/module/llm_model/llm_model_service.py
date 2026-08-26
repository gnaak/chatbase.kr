from app.core.utils.response import fail, success
from app.module.llm_model.llm_model import (
    LLMModel,
    ModelProvider,
    ModelType,
)
from app.module.llm_model.llm_model_repository import LLMModelRepository


def _to_dict(m: LLMModel) -> dict:
    return {
        "id": m.id,
        "value": m.value,
        "label": m.label,
        "description": m.description,
        "provider": m.provider.value,
        "type": m.type.value,
        "is_active": m.is_active,
        "sort_order": m.sort_order,
        "pricing_input": m.pricing_input,
        "pricing_output": m.pricing_output,
        "pricing_per_image": m.pricing_per_image,
        "discovered_at": m.discovered_at.isoformat() if m.discovered_at else None,
    }


class LLMModelService:
    def __init__(self, repo: LLMModelRepository):
        self.repo = repo

    # ── 일반 사용자(대시보드) ─────────────────────
    async def list_models(self, request):
        """query: ?type=chat|image (기본 chat). active만."""
        type_param = (request.query_params.get("type") or "chat").lower()
        try:
            type_ = ModelType(type_param)
        except ValueError:
            type_ = ModelType.CHAT
        models = await self.repo.find_active(type_)
        return success(data=[_to_dict(m) for m in models])

    # ── 어드민 ────────────────────────────────────
    async def admin_list(self, request):
        """전체 모델 (active 무관)."""
        models = await self.repo.find_all()
        return success(data=[_to_dict(m) for m in models])

    async def admin_create(self, request):
        body = await request.json()
        value = (body.get("value") or "").strip()
        label = (body.get("label") or "").strip() or value
        type_raw = (body.get("type") or "chat").strip()
        provider_raw = (body.get("provider") or "").strip()

        if not value:
            fail("value(모델 ID)가 필요합니다.", "VALUE_REQUIRED")
        try:
            type_ = ModelType(type_raw)
        except ValueError:
            fail(f"지원하지 않는 type: {type_raw}", "INVALID_TYPE")
        try:
            provider = ModelProvider(provider_raw)
        except ValueError:
            fail(f"지원하지 않는 provider: {provider_raw}", "INVALID_PROVIDER")

        existing = await self.repo.find_by_value(value)
        if existing:
            fail(f"이미 존재하는 모델: {value}", "DUPLICATE_VALUE")

        m = LLMModel(
            type=type_,
            value=value,
            label=label,
            description=(body.get("description") or "").strip() or None,
            provider=provider,
            is_active=bool(body.get("is_active", True)),
            sort_order=int(body.get("sort_order") or 0),
            pricing_input=body.get("pricing_input"),
            pricing_output=body.get("pricing_output"),
            pricing_per_image=body.get("pricing_per_image"),
        )
        await self.repo.add(m)
        await self.repo.db.commit()
        await self.repo.db.refresh(m)
        return success(data=_to_dict(m))

    async def admin_update(self, request):
        model_id = int(request.path_params.get("id"))
        m = await self.repo.find_by_id(model_id)
        if not m:
            fail("모델을 찾을 수 없습니다.", "MODEL_NOT_FOUND", 404)

        body = await request.json()
        if "label" in body:
            m.label = (body["label"] or "").strip() or m.label
        if "description" in body:
            m.description = (body["description"] or "").strip() or None
        if "is_active" in body:
            m.is_active = bool(body["is_active"])
        if "sort_order" in body:
            m.sort_order = int(body["sort_order"] or 0)
        if "pricing_input" in body:
            m.pricing_input = body["pricing_input"]
        if "pricing_output" in body:
            m.pricing_output = body["pricing_output"]
        if "pricing_per_image" in body:
            m.pricing_per_image = body["pricing_per_image"]
        if "provider" in body:
            try:
                m.provider = ModelProvider(body["provider"])
            except ValueError:
                fail(f"지원하지 않는 provider: {body['provider']}", "INVALID_PROVIDER")
        if "type" in body:
            try:
                m.type = ModelType(body["type"])
            except ValueError:
                fail(f"지원하지 않는 type: {body['type']}", "INVALID_TYPE")

        await self.repo.db.commit()
        await self.repo.db.refresh(m)
        return success(data=_to_dict(m))

    async def admin_delete(self, request):
        model_id = int(request.path_params.get("id"))
        m = await self.repo.find_by_id(model_id)
        if not m:
            fail("모델을 찾을 수 없습니다.", "MODEL_NOT_FOUND", 404)
        await self.repo.delete(m)
        await self.repo.db.commit()
        return success(message="deleted")
