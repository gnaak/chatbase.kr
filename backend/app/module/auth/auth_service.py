# app/module/auth/auth_service.py

from passlib.context import CryptContext

from app.core.utils.response import fail
from app.module.admin.admin_repository import AdminRepository
from app.module.auth.auth_token import AuthToken
from app.module.user.user_repository import UserRepository

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

class AuthService:
    def __init__(self, user_repo: UserRepository, admin_repo: AdminRepository):
        self.user_repo = user_repo
        self.admin_repo = admin_repo
        self.token_util = AuthToken()

    # -- 회원가입
    async def signup(self, request):
        body = await request.json()
        email = body.get("email")
        password = body.get("password")
        nickname = body.get("nickname")
        
        original = await self.user_repo.get_user_by_email(email)
        if original:
            fail("user already exists", "USER_ALREADY_EXISTS", 409)
        else:
            hashed_password = hash_password(password)
            await self.user_repo.create_user(email, nickname, hashed_password)

    # -- 일반 로그인
    async def login(self, request):
        body = await request.json()
        email = body.get("email")
        password = body.get("password")
        auth_type = body.get("type")

        if auth_type == "user":
            user_obj = await self.user_repo.get_user_by_email(email)
        elif auth_type == "admin":
            user_obj = await self.admin_repo.get_admin_by_email(email)
        else:
            fail("invalid type", "INVALID_TYPE", 400)
        if not user_obj or not verify_password(password, user_obj.password if auth_type == "admin" else user_obj.password):
            fail("user does not exists", "USER_DOES_NOT_EXISTS", 404)

        # 탈퇴한 계정은 active=False로 남는다(거래기록 보관 의무 때문에 행을 지우지
        # 않는다). 여기서 막지 않으면 탈퇴한 사람이 그대로 다시 들어온다.
        # 관리자가 수동으로 비활성화한 계정도 같은 경로로 막힌다.
        # `not active`가 아니라 `is False`인 이유: active 컬럼이 nullable이라
        # DB에 직접 넣은 행은 NULL일 수 있다. NULL을 차단으로 해석하면
        # 멀쩡한 계정이 잠긴다. 명시적으로 False인 것만 막는다.
        if auth_type == "user" and user_obj.active is False:
            fail("비활성화된 계정입니다.", "INACTIVE_ACCOUNT", 403)

        return user_obj, auth_type



    
