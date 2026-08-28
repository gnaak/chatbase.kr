from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


# ── 모델 관리 (raw CRUD — 기존) ─────────────────
@router.get("/models")
@with_provider
@with_login("admin")
async def list_models(p: ServiceProvider):
    return await p.llm_model_service.admin_list(p.request)


@router.post("/models")
@with_provider
@with_login("admin")
async def create_model(p: ServiceProvider):
    return await p.llm_model_service.admin_create(p.request)


@router.patch("/models/{id}")
@with_provider
@with_login("admin")
async def update_model(p: ServiceProvider):
    return await p.llm_model_service.admin_update(p.request)


@router.delete("/models/{id}")
@with_provider
@with_login("admin")
async def delete_model(p: ServiceProvider):
    return await p.llm_model_service.admin_delete(p.request)


# ── 모델 카탈로그 (provider별 그룹 + SDK refresh) ─
@router.get("/models/catalog")
@with_provider
@with_login("admin")
async def models_catalog(p: ServiceProvider):
    return await p.admin_service.list_catalog(p.request)


@router.post("/models/refresh")
@with_provider
@with_login("admin")
async def models_refresh(p: ServiceProvider):
    return await p.admin_service.refresh_catalog(p.request)


@router.post("/models/set_active")
@with_provider
@with_login("admin")
async def models_set_active(p: ServiceProvider):
    return await p.admin_service.set_model_active(p.request)


# ── 고객 관리 ─────────────────────────────────
@router.get("/users")
@with_provider
@with_login("admin")
async def list_users(p: ServiceProvider):
    return await p.admin_service.list_users(p.request)


# ── 결제 관리 (조회 전용) ──────────────────────
@router.get("/billing/summary")
@with_provider
@with_login("admin")
async def billing_summary(p: ServiceProvider):
    """MRR · 구독 상태별 건수 · 플랜별 사용자 수 · 매출."""
    return await p.admin_service.billing_summary(p.request)


@router.get("/subscriptions")
@with_provider
@with_login("admin")
async def list_subscriptions(p: ServiceProvider):
    return await p.admin_service.list_subscriptions(p.request)


@router.get("/payments")
@with_provider
@with_login("admin")
async def list_payments(p: ServiceProvider):
    """?limit=200 (최대 1000). 실패 건도 함께 내려온다."""
    return await p.admin_service.list_payments(p.request)
