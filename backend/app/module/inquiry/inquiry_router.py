from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login, without_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


# ── 공개 (인증 없음) — 랜딩 문의 폼 ────────────────
@router.post("/")
@with_provider
@without_login
async def create_inquiry(p: ServiceProvider):
    """body: {name, email, subject, content, category?}

    로그인 쿠키가 있으면 서비스가 알아서 회원 문의로 붙인다.
    응답의 access_token으로 `/support/{token}`에서 스레드를 다시 열 수 있다.
    """
    return await p.inquiry_service.create(p.request)


@router.get("/token/{token}")
@with_provider
@without_login
async def get_inquiry_by_token(p: ServiceProvider):
    return await p.inquiry_service.get_by_token(p.request)


@router.post("/token/{token}/messages")
@with_provider
@without_login
async def add_message_by_token(p: ServiceProvider):
    """body: {content}"""
    return await p.inquiry_service.add_message_by_token(p.request)


# ── 대시보드 (로그인 필수) ─────────────────────────
# `/me`가 `/token/...`보다 뒤에 있어도 경로가 겹치지 않는다 —
# 와일드카드 세그먼트를 최상위에 두지 않았기 때문.
@router.get("/me")
@with_provider
@with_login()
async def list_my_inquiries(p: ServiceProvider):
    return await p.inquiry_service.list_mine(p.request)


@router.get("/me/{id}")
@with_provider
@with_login()
async def get_my_inquiry(p: ServiceProvider):
    return await p.inquiry_service.get_mine(p.request)


@router.post("/me/{id}/messages")
@with_provider
@with_login()
async def add_message_to_my_inquiry(p: ServiceProvider):
    """body: {content}"""
    return await p.inquiry_service.add_message_mine(p.request)
