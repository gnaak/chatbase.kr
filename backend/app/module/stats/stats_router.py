from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


@router.get("/")
@with_provider
@with_login()
async def get_summary(p: ServiceProvider):
    """대화 통계 요약. `?bot_id={slug}&days=30` (bot_id 생략 시 전체 봇)."""
    return await p.stats_service.get_summary(p.request)


@router.post("/topics")
@with_provider
@with_login()
async def get_topics(p: ServiceProvider):
    """질문을 주제별로 묶는다. body: {"bot_id"?, "days"?}

    사용자 API 키로 LLM을 호출하므로 버튼 등 명시적 동작에서만 부른다.
    화면 진입마다 호출하면 사용자 토큰이 계속 소모된다.
    """
    return await p.stats_service.get_topics(p.request)
