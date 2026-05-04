from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login, without_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


# ── 공개 (인증 없음) — 임베드 위젯용 ──────────────
@router.get("/public/{slug}")
@with_provider
@without_login
async def get_public_bot(p: ServiceProvider):
    return await p.bot_service.get_public_bot(p.request)


# ── 대시보드 (로그인 필수) ─────────────────────────
@router.get("/")
@with_provider
@with_login()
async def list_bots(p: ServiceProvider):
    return await p.bot_service.list_bots(p.request)


@router.post("/")
@with_provider
@with_login()
async def create_bot(p: ServiceProvider):
    return await p.bot_service.create_bot(p.request)


@router.get("/{slug}")
@with_provider
@with_login()
async def get_bot(p: ServiceProvider):
    return await p.bot_service.get_bot(p.request)


@router.patch("/{slug}")
@with_provider
@with_login()
async def update_bot(p: ServiceProvider):
    return await p.bot_service.update_bot(p.request)


@router.delete("/{slug}")
@with_provider
@with_login()
async def delete_bot(p: ServiceProvider):
    return await p.bot_service.delete_bot(p.request)
