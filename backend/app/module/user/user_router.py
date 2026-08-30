from fastapi import APIRouter

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


@router.get("/me")
@with_provider
@with_login()
async def get_me(p: ServiceProvider):
    return await p.user_service.get_me(p.request)


@router.patch("/me")
@with_provider
@with_login()
async def update_me(p: ServiceProvider):
    return await p.user_service.update_me(p.request)


@router.post("/me/password")
@with_provider
@with_login()
async def change_password(p: ServiceProvider):
    return await p.user_service.change_password(p.request)


@router.post("/me/withdraw")
@with_provider
@with_login()
async def withdraw(p: ServiceProvider):
    """계정 삭제. 개인정보를 지우고 비활성화한다(하드 삭제가 아니다).

    DELETE가 아니라 POST인 이유: 비밀번호 확인 본문을 받아야 하는데
    프론트의 `useDelete` 훅이 본문을 보내지 않는다.
    """
    return await p.user_service.withdraw(p.request)
