# app/module/user/user_service.py
from app.core.utils.response import fail, success
from app.module.user.user_repository import UserRepository


def _user_to_dict(user) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "profile_image": user.profile_image,
        "active": user.active,
        "has_password": bool(user.password),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": (
            user.last_login_at.isoformat() if user.last_login_at else None
        ),
    }


class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def get_user_by_id(self, user_id: int):
        return await self.user_repo.get_user_by_id(user_id)

    async def get_me(self, request):
        user_id = request.user_id
        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            fail("user not found", "USER_NOT_FOUND", 404)
        return success(data=_user_to_dict(user))

    async def update_me(self, request):
        """body: { name?, workspace_name?, workspace_slug?, profile_image? }"""
        user_id = request.user_id
        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            fail("user not found", "USER_NOT_FOUND", 404)

        body = await request.json()
        if "name" in body:
            user.name = (body["name"] or "").strip() or user.name
        if "profile_image" in body:
            user.profile_image = body["profile_image"]

        await self.user_repo.db.commit()
        await self.user_repo.db.refresh(user)
        return success(data=_user_to_dict(user))
