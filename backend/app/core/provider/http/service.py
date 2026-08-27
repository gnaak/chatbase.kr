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
        self._kakao_skill_service = None
        self._llm_service = None
        self._vector_store_service = None
        self._payment_repo = None
        self._payment_service = None
        self._toss_service = None
        self._llm_model_repo = None
        self._llm_model_service = None
        self._openai_model_service = None
        self._anthropic_model_service = None
        self._gemini_model_service = None
        self._usage_repo = None
        self._usage_service = None

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
            self._admin_service = AdminService(
                admin_repo=self.admin_repo,
                openai_model_service=self.openai_model_service,
                anthropic_model_service=self.anthropic_model_service,
                gemini_model_service=self.gemini_model_service,
            )
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
                user_repo=self.user_repo,
            )
        return self._bot_service

    @property
    def vector_store_service(self):
        if not self._vector_store_service:
            from app.module.infra.openai.vector_store_service import VectorStoreService
            self._vector_store_service = VectorStoreService()
        return self._vector_store_service

    @property
    def llm_model_repo(self):
        if not self._llm_model_repo:
            from app.module.llm_model.llm_model_repository import LLMModelRepository
            self._llm_model_repo = LLMModelRepository(self.db)
        return self._llm_model_repo

    @property
    def llm_model_service(self):
        if not self._llm_model_service:
            from app.module.llm_model.llm_model_service import LLMModelService
            self._llm_model_service = LLMModelService(self.llm_model_repo)
        return self._llm_model_service

    @property
    def openai_model_service(self):
        if not self._openai_model_service:
            from app.module.infra.openai.model_service import OpenAIModelService
            self._openai_model_service = OpenAIModelService()
        return self._openai_model_service

    @property
    def anthropic_model_service(self):
        if not self._anthropic_model_service:
            from app.module.infra.anthropic.model_service import AnthropicModelService
            self._anthropic_model_service = AnthropicModelService()
        return self._anthropic_model_service

    @property
    def gemini_model_service(self):
        if not self._gemini_model_service:
            from app.module.infra.gemini.model_service import GeminiModelService
            self._gemini_model_service = GeminiModelService()
        return self._gemini_model_service

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
    def usage_repo(self):
        if not self._usage_repo:
            from app.module.usage.usage_repository import UsageRepository
            self._usage_repo = UsageRepository(self.db)
        return self._usage_repo

    @property
    def usage_service(self):
        if not self._usage_service:
            from app.module.usage.usage_service import UsageService
            self._usage_service = UsageService(self.usage_repo, self.user_repo)
        return self._usage_service

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
                usage_service=self.usage_service,
            )
        return self._chat_service

    @property
    def kakao_skill_service(self):
        if not self._kakao_skill_service:
            from app.module.kakao_skill.kakao_skill_service import KakaoSkillService
            self._kakao_skill_service = KakaoSkillService(
                chat_repo=self.chat_repo,
                bot_repo=self.bot_repo,
                api_key_service=self.api_key_service,
                llm_service=self.llm_service,
                usage_service=self.usage_service,
            )
        return self._kakao_skill_service

    @property
    def toss_service(self):
        if not self._toss_service:
            from app.module.infra.toss.toss_service import TossService
            self._toss_service = TossService()
        return self._toss_service

    @property
    def payment_repo(self):
        if not self._payment_repo:
            from app.module.payment.payment_repository import PaymentRepository
            self._payment_repo = PaymentRepository(self.db)
        return self._payment_repo

    @property
    def payment_service(self):
        if not self._payment_service:
            from app.module.payment.payment_service import PaymentService
            self._payment_service = PaymentService(
                payment_repo=self.payment_repo,
                user_repo=self.user_repo,
                toss_service=self.toss_service,
            )
        return self._payment_service

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
