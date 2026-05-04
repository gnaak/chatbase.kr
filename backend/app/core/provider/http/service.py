from fastapi import Depends, Request

from app.core.database.base import get_session


class ServiceProvider:
    def __init__(self, request: Request, db):
        self.request = request
        self.db = db

        # 기존 도메인
        self._user_repo = None
        self._admin_repo = None
        self._user_service = None
        self._auth_service = None
        self._admin_service = None
        self._kakao_service = None
        self._google_service = None

        # 챗봇 SaaS 도메인
        self._bot_repo = None
        self._bot_service = None
        self._api_key_repo = None
        self._api_key_service = None
        self._chat_repo = None
        self._chat_service = None
        self._llm_service = None
        self._vector_store_service = None

    # ── 기존 도메인 ─────────────────────────
    @property
    def user_repo(self):
        if not self._user_repo:
            from app.module.user.user_repository import UserRepository
            self._user_repo = UserRepository(self.db)
        return self._user_repo

    @property
    def admin_repo(self):
        if not self._admin_repo:
            from app.module.admin.admin_repository import AdminRepository
            self._admin_repo = AdminRepository(self.db)
        return self._admin_repo

    @property
    def user_service(self):
        if not self._user_service:
            from app.module.user.user_service import UserService
            self._user_service = UserService(self.user_repo)
        return self._user_service

    @property
    def admin_service(self):
        if not self._admin_service:
            from app.module.admin.admin_service import AdminService
            self._admin_service = AdminService(self.admin_repo)
        return self._admin_service

    @property
    def auth_service(self):
        if not self._auth_service:
            from app.module.auth.auth_service import AuthService
            self._auth_service = AuthService(self.user_repo, self.admin_repo)
        return self._auth_service

    @property
    def google_service(self):
        if not self._google_service:
            from app.module.infra.google.google_service import GoogleService
            self._google_service = GoogleService(self.user_repo)
        return self._google_service

    @property
    def kakao_service(self):
        if not self._kakao_service:
            from app.module.infra.kakao.kakao_service import KakaoService
            self._kakao_service = KakaoService(self.user_repo)
        return self._kakao_service

    # ── 챗봇 SaaS 도메인 ────────────────────
    @property
    def bot_repo(self):
        if not self._bot_repo:
            from app.module.bot.bot_repository import BotRepository
            self._bot_repo = BotRepository(self.db)
        return self._bot_repo

    @property
    def bot_service(self):
        if not self._bot_service:
            from app.module.bot.bot_service import BotService
            self._bot_service = BotService(
                bot_repo=self.bot_repo,
                api_key_service=self.api_key_service,
                vector_store_service=self.vector_store_service,
            )
        return self._bot_service

    @property
    def vector_store_service(self):
        if not self._vector_store_service:
            from app.module.infra.openai.vector_store_service import VectorStoreService
            self._vector_store_service = VectorStoreService()
        return self._vector_store_service

    @property
    def api_key_repo(self):
        if not self._api_key_repo:
            from app.module.api_key.api_key_repository import ApiKeyRepository
            self._api_key_repo = ApiKeyRepository(self.db)
        return self._api_key_repo

    @property
    def api_key_service(self):
        if not self._api_key_service:
            from app.module.api_key.api_key_service import ApiKeyService
            self._api_key_service = ApiKeyService(self.api_key_repo)
        return self._api_key_service

    @property
    def chat_repo(self):
        if not self._chat_repo:
            from app.module.chat.chat_repository import ChatRepository
            self._chat_repo = ChatRepository(self.db)
        return self._chat_repo

    @property
    def chat_service(self):
        if not self._chat_service:
            from app.module.chat.chat_service import ChatService
            self._chat_service = ChatService(
                chat_repo=self.chat_repo,
                bot_repo=self.bot_repo,
                api_key_service=self.api_key_service,
                llm_service=self.llm_service,
            )
        return self._chat_service

    @property
    def llm_service(self):
        if not self._llm_service:
            from app.module.infra.llm.llm_service import LLMService
            self._llm_service = LLMService()
        return self._llm_service


async def get_provider(
    request: Request,
    db=Depends(get_session),
):
    return ServiceProvider(request, db)
