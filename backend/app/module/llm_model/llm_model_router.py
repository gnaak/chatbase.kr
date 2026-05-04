from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


@router.get("/")
@with_provider
@with_login()
async def list_models(p: ServiceProvider):
    """query: type=chat|image (기본 chat). active=true 모델만 반환."""
    return await p.llm_model_service.list_models(p.request)
