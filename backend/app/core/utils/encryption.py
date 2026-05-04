"""BYOK API 키 암호화 유틸.

Fernet 키는 32바이트 URL-safe base64 형식이 필요한데,
별도 환경변수를 새로 추가하지 않고 `jwt_secret`을 SHA256으로 압축해 derive 합니다.
이렇게 하면 jwt_secret만 강력하게 관리하면 됨.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config.settings import settings


def _fernet() -> Fernet:
    secret = settings.jwt_secret
    if not secret:
        raise RuntimeError("jwt_secret이 설정되지 않았습니다.")
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def encrypt(plaintext: str) -> bytes:
    return _fernet().encrypt(plaintext.encode("utf-8"))


def decrypt(ciphertext: bytes) -> str:
    try:
        return _fernet().decrypt(ciphertext).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("암호화 키가 유효하지 않거나 토큰이 손상되었습니다.") from exc
