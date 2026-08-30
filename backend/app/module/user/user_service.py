# app/module/user/user_service.py
from app.core.utils.response import fail, success
from app.module.user.user_repository import UserRepository

#: 비밀번호 최소 길이. 회원가입에는 아직 정책이 없지만, 변경에서만이라도 막는다.
MIN_PASSWORD_LENGTH = 8


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
    def __init__(self, user_repo: UserRepository, token_util=None,
                 api_key_service=None, vector_store_service=None):
        self.user_repo = user_repo
        #: 탈퇴 직후 쿠키를 지우기 위해 필요하다.
        self.token_util = token_util
        #: 탈퇴 시 OpenAI 벡터 스토어를 정리하려면 둘 다 필요하다.
        #: 없으면 정리를 건너뛴다 — 고객의 OpenAI 계정에 파일이 남을 뿐
        #: 우리 쪽 삭제는 그대로 진행된다.
        self.api_key_service = api_key_service
        self.vector_store_service = vector_store_service

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

    # ── 비밀번호 변경 ───────────────────────────

    async def change_password(self, request):
        """body: { current_password, new_password }"""
        from app.module.auth.auth_service import hash_password, verify_password

        user_id = request.user_id
        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            fail("user not found", "USER_NOT_FOUND", 404)

        # 구글·카카오로만 가입한 계정은 비밀번호 자체가 없다.
        # 여기서 새로 만들어주면 소셜 로그인과 별개의 로그인 경로가 생겨버린다.
        if not user.password:
            fail(
                "소셜 로그인 계정은 비밀번호를 사용하지 않습니다.",
                "PASSWORD_NOT_SET",
                400,
            )

        body = await request.json()
        current = (body.get("current_password") or "").strip()
        new = (body.get("new_password") or "").strip()

        if not current or not new:
            fail("현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.", "INVALID_INPUT", 400)
        if not verify_password(current, user.password):
            fail("현재 비밀번호가 올바르지 않습니다.", "INVALID_PASSWORD", 401)
        if len(new) < MIN_PASSWORD_LENGTH:
            fail(
                f"새 비밀번호는 {MIN_PASSWORD_LENGTH}자 이상이어야 합니다.",
                "PASSWORD_TOO_SHORT",
                400,
            )
        if verify_password(new, user.password):
            fail("현재 비밀번호와 다른 값을 입력해 주세요.", "PASSWORD_UNCHANGED", 400)

        user.password = hash_password(new)
        await self.user_repo.db.commit()
        return success(message="비밀번호가 변경되었습니다.")

    # ── 탈퇴 ────────────────────────────────────

    async def withdraw(self, request):
        """body: { password? } — 비밀번호가 있는 계정만 확인을 요구한다.

        하드 삭제가 아니라 **개인정보 삭제 + 비활성화**다. 이유는
        `UserRepository.purge_user_data` 주석 참고(거래기록 보관 의무).
        """
        from app.module.auth.auth_service import verify_password

        user_id = request.user_id
        user = await self.user_repo.get_user_by_id(user_id)
        if not user:
            fail("user not found", "USER_NOT_FOUND", 404)

        # 청구가 살아 있는 채로 계정을 지우면 결제는 계속 시도되는데
        # 그 사람은 로그인해서 멈출 수단이 없다. 반드시 먼저 막는다.
        blocking = await self.user_repo.active_subscriptions(user_id)
        if blocking:
            fail(
                "이용 중인 구독이 있습니다. 결제 페이지에서 구독을 먼저 해지해 주세요.",
                "SUBSCRIPTION_ACTIVE",
                409,
            )

        if user.password:
            body = await self._body(request)
            password = (body.get("password") or "").strip()
            if not password:
                fail("비밀번호를 입력해 주세요.", "PASSWORD_REQUIRED", 400)
            if not verify_password(password, user.password):
                fail("비밀번호가 올바르지 않습니다.", "INVALID_PASSWORD", 401)

        await self._cleanup_vector_stores(user_id)

        await self.user_repo.purge_user_data(user_id)
        await self.user_repo.anonymize(user)
        await self.user_repo.db.commit()

        response = success(message="계정이 삭제되었습니다.")
        if self.token_util:
            await self.token_util.delete_token(response, "user")
        return response

    async def _cleanup_vector_stores(self, user_id: int) -> None:
        """OpenAI에 올라간 학습 파일을 지운다. 실패해도 탈퇴는 계속한다.

        고객 자신의 OpenAI 계정에 있는 자산이라 우리가 못 지워도 치명적이지
        않다. 반면 여기서 예외가 나 탈퇴가 막히면 그게 더 큰 문제다.
        """
        if not (self.api_key_service and self.vector_store_service):
            return
        try:
            bots = await self.user_repo.list_bots(user_id)
            targets = [b.vector_store_id for b in bots if b.vector_store_id]
            if not targets:
                return
            from app.module.api_key.api_key import Provider

            api_key = await self.api_key_service.get_decrypted_key(
                user_id, Provider.OPENAI
            )
            if not api_key:
                return
            for vs_id in targets:
                await self.vector_store_service.delete_vector_store(api_key, vs_id)
        except Exception:
            pass

    @staticmethod
    async def _body(request) -> dict:
        """본문이 비어 있어도 터지지 않게 한다."""
        try:
            return await request.json() or {}
        except Exception:
            return {}
