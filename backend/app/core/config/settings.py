# app/core/config/settings.py
import os
import socket
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class RawEnv(BaseSettings):
    # MySQL 설정
    mysql_port: int = 3306

    # LOCAL
    local_mysql_user: str
    local_mysql_password: str
    local_mysql_host: str
    local_mysql_db: str

    # PROD
    prod_mysql_user: str
    prod_mysql_password: str
    prod_mysql_host: str
    prod_mysql_db: str

    jwt_secret: str
    hash_key: str

    # External API keys (옵션) — admin/카탈로그 새로고침에 그대로 사용
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None

    # admin_* 키는 별도 운영자 키로 분리하고 싶을 때 .env에 설정
    admin_openai_api_key: Optional[str] = None
    admin_anthropic_api_key: Optional[str] = None
    admin_gemini_api_key: Optional[str] = None

    # TOSS PAYMENTS
    # 클라이언트/시크릿은 반드시 같은 상점(MID) 쌍이어야 한다. 짝이 안 맞으면
    # 결제창은 떠도 승인에서 NOT_FOUND_MERCHANT로 깨진다.
    # 시크릿 키는 상점당 하나이며 일반결제(/v1/payments)와 자동결제(/v1/billing)가 같이 쓴다.
    toss_api_client_key: Optional[str] = None
    toss_api_secret_key: Optional[str] = None

    # DEEPL — FAQ 사전 번역용. 없으면 번역을 조용히 건너뛴다(봇 저장은 정상).
    # 무료 키는 ':fx' 로 끝나고 엔드포인트가 다르다. 분기는 deepl_service 가 한다.
    deepl_api_key: Optional[str] = None

    # KAKAO
    kakao_client_id: Optional[str] = None
    kakao_client_secret: Optional[str] = None
    local_kakao_redirect_uri: Optional[str] = None
    prod_kakao_redirect_uri: Optional[str] = None

    # GOOGLE
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    local_google_redirect_uri: Optional[str] = None
    prod_google_redirect_uri: Optional[str] = None

    # APP URL — 메일에 담는 문의 스레드 링크(`/support/{token}`) 생성용.
    local_app_url: str = "http://localhost:3000"
    prod_app_url: str = "https://chatbase.kr"

    # MAIL
    # 발송 인프라(SES/SMTP + SPF·DKIM·DMARC)가 아직 없다. TODO.md 2번이 끝나기
    # 전까지 mail_enabled는 false로 두고, 발송 지점은 로그만 남긴다.
    mail_enabled: bool = False
    mail_from: str = "chatbase.kr <hello@chatbase.kr>"
    #: 신규 문의 알림을 받을 운영자 주소.
    mail_admin_to: str = "hello@chatbase.kr"

    model_config = SettingsConfigDict(
        env_file=os.path.join(
            os.path.dirname(__file__), "..", "..", "..", ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


class Settings:
    def __init__(self):
        self.raw = RawEnv()
        self.env = self._detect_env()
        self.BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
        self.APP_DIR = self.BASE_DIR / "app"
        self.MEDIA_ROOT = self.BASE_DIR / "media"

    def _detect_env(self) -> str:
        hostname = socket.gethostname()
        return "prod" if hostname.startswith("ip-") or hostname.startswith("ec2-") else "local"


    # MySQL 설정
    @property
    def mysql_user(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_user")

    @property
    def mysql_password(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_password")

    @property
    def mysql_host(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_host")

    @property
    def mysql_db(self) -> str:
        return getattr(self.raw, f"{self.env}_mysql_db")

    @property
    def mysql_port(self) -> int:
        return self.raw.mysql_port

    # SQLAlchemy 비동기 DB URL (MySQL + asyncmy)
    @property
    def database_url(self) -> str:
        user = quote_plus(self.mysql_user)
        password = quote_plus(self.mysql_password)
        host = self.mysql_host
        return (
            f"mysql+asyncmy://{user}:{password}"
            f"@{host}:{self.mysql_port}/{self.mysql_db}?charset=utf8mb4"
        )

    @property
    def jwt_secret(self) -> str:
        return self.raw.jwt_secret

    @property
    def deepl_api_key(self):
        return self.raw.deepl_api_key

    @property
    def hash_key(self) -> str:
        return self.raw.hash_key

    # API Keys
    @property
    def openai_api_key(self) -> Optional[str]:
        return self.raw.openai_api_key

    @property
    def admin_openai_api_key(self) -> Optional[str]:
        return self.raw.admin_openai_api_key or self.raw.openai_api_key

    @property
    def admin_anthropic_api_key(self) -> Optional[str]:
        return self.raw.admin_anthropic_api_key or self.raw.anthropic_api_key

    @property
    def admin_gemini_api_key(self) -> Optional[str]:
        return self.raw.admin_gemini_api_key or self.raw.gemini_api_key


    # TOSS PAYMENTS
    @property
    def toss_client_key(self) -> Optional[str]:
        return self.raw.toss_api_client_key

    @property
    def toss_secret_key(self) -> Optional[str]:
        return self.raw.toss_api_secret_key

    @property
    def kakao_client_id(self) -> Optional[str]:
        return self.raw.kakao_client_id

    @property
    def kakao_client_secret(self) -> Optional[str]:
        return self.raw.kakao_client_secret

    @property
    def kakao_redirect_uri(self) -> Optional[str]:
        return getattr(self.raw, f"{self.env}_kakao_redirect_uri")

    @property
    def google_client_id(self) -> Optional[str]:
        return self.raw.google_client_id

    @property
    def google_client_secret(self) -> Optional[str]:
        return self.raw.google_client_secret

    @property
    def google_redirect_uri(self) -> str:
        return getattr(self.raw, f"{self.env}_google_redirect_uri")

    # APP URL / MAIL
    @property
    def app_url(self) -> str:
        return getattr(self.raw, f"{self.env}_app_url").rstrip("/")

    @property
    def mail_enabled(self) -> bool:
        return self.raw.mail_enabled

    @property
    def mail_from(self) -> str:
        return self.raw.mail_from

    @property
    def mail_admin_to(self) -> str:
        return self.raw.mail_admin_to


# 전역 인스턴스
settings = Settings()
DATABASE_URL = settings.database_url
