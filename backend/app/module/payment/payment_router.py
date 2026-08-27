from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


@router.get("/config")
@with_provider
@with_login()
async def get_config(p: ServiceProvider):
    """프론트 SDK 초기화용 클라이언트 키 + 플랜 가격."""
    return await p.payment_service.get_config(p.request)


@router.get("/subscription")
@with_provider
@with_login()
async def get_subscription(p: ServiceProvider):
    """구독 상태. customerKey도 여기서 받아 카드 등록창에 넘긴다."""
    return await p.payment_service.get_subscription(p.request)


# ── 결제수단 (등록만, 결제 없음) ────────────────
@router.get("/methods")
@with_provider
@with_login()
async def list_methods(p: ServiceProvider):
    return await p.payment_service.list_methods(p.request)


@router.post("/methods")
@with_provider
@with_login()
async def register_method(p: ServiceProvider):
    """body: {"authKey": "...", "customerKey": "..."}"""
    return await p.payment_service.register_method(p.request)


@router.post("/methods/default")
@with_provider
@with_login()
async def set_default_method(p: ServiceProvider):
    """body: {"method_id": 1} — 다음 청구부터 이 카드를 쓴다."""
    return await p.payment_service.set_default_method(p.request)


@router.post("/methods/delete")
@with_provider
@with_login()
async def delete_method(p: ServiceProvider):
    """body: {"method_id": 1}"""
    return await p.payment_service.delete_method(p.request)


# ── 구독 ────────────────────────────────────────
@router.post("/subscribe")
@with_provider
@with_login()
async def subscribe(p: ServiceProvider):
    """body: {"plan": "standard", "method_id": 1} — method_id 생략 시 기본 카드."""
    return await p.payment_service.subscribe(p.request)


@router.post("/subscription/schedule")
@with_provider
@with_login()
async def schedule_plan_change(p: ServiceProvider):
    """body: {"plan": "standard"} — 다음 결제일에 적용할 하향 예약. null이면 취소."""
    return await p.payment_service.schedule_plan_change(p.request)


@router.post("/subscription/cancel")
@with_provider
@with_login()
async def cancel_subscription(p: ServiceProvider):
    return await p.payment_service.cancel_subscription(p.request)


@router.get("/payments")
@with_provider
@with_login()
async def list_payments(p: ServiceProvider):
    return await p.payment_service.list_payments(p.request)
