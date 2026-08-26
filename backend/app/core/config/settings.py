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

    # 플랜 한도 강제 여부. False면 초과를 로그만 남기고 통과시킨다(계측 전용).
    # 결제가 붙기 전에 True로 켜면 Free 사용자가 한도 소진 후 업그레이드 경로 없이 갇힌다.
    enforce_plan_limits: bool = False

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

    @property
    def enforce_plan_limits(self) -> bool:
        return bool(self.raw.enforce_plan_limits)

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


# 전역 인스턴스
settings = Settings()
DATABASE_URL = settings.database_url
