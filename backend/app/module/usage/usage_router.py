from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


@router.get("/")
@with_provider
@with_login()
async def get_usage(p: ServiceProvider):
    """이번 달 사용량 + 플랜 한도. 대시보드 사용량 표시에 쓴다."""
    return await p.usage_service.get_summary(p.request)
