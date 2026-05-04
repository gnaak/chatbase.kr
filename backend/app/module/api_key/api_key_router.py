from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


@router.get("/")
@with_provider
@with_login()
async def list_keys(p: ServiceProvider):
    return await p.api_key_service.list_keys(p.request)


@router.post("/")
@with_provider
@with_login()
async def upsert_key(p: ServiceProvider):
    """body: {"provider": "openai" | "anthropic" | "google", "key": "..."}"""
    return await p.api_key_service.upsert(p.request)


@router.post("/delete")
@with_provider
@with_login()
async def delete_key(p: ServiceProvider):
    """body: {"provider": "openai" | "anthropic" | "google"}"""
    return await p.api_key_service.delete(p.request)
