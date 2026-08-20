from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login, without_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


# ── 오픈빌더 스킬 서버 (카카오가 호출. 인증은 URL 시크릿) ──
@router.post("/skill/{bot_slug}")
@with_provider
@without_login
async def kakao_skill(p: ServiceProvider):
    """오픈빌더 스킬 URL로 등록할 엔드포인트.

    요청: 카카오 SkillPayload (userRequest.utterance / userRequest.user.id)
    응답: 항상 200 + SkillResponse(simpleText)
    """
    return await p.kakao_skill_service.handle_skill(p.request)


# ── 대시보드: 연결 정보 조회 (봇 소유자) ──────
@router.get("/connection/{bot_slug}")
@with_provider
@with_login()
async def kakao_connection(p: ServiceProvider):
    """스킬 URL / 시크릿 / 연결 상태를 반환."""
    return await p.kakao_skill_service.get_connection(p.request)
