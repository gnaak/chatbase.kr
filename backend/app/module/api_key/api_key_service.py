from app.core.utils.encryption import decrypt, encrypt
from app.core.utils.response import fail, success
from app.module.api_key.api_key import Provider
from app.module.api_key.api_key_repository import ApiKeyRepository

PROVIDER_PREFIX_HINT = {
    Provider.OPENAI: "sk-",
    Provider.ANTHROPIC: "sk-ant-",
    Provider.GOOGLE: "AIza",
}


class ApiKeyService:
    """BYOK 사용자 API 키 등록/조회/삭제.

    - 평문 키는 절대 DB에 저장하지 않으며, Fernet 암호화 후 LargeBinary로 저장.
    - 마지막 4자리(last4)만 노출용으로 별도 저장.
    """

    def __init__(self, api_key_repo: ApiKeyRepository):
        self.api_key_repo = api_key_repo

    @staticmethod
    def _parse_provider(value: str | None) -> Provider:
        if not value:
            fail("provider가 필요합니다.", "PROVIDER_REQUIRED")
        try:
            return Provider(value)
        except ValueError:
            fail(f"지원하지 않는 provider: {value}", "INVALID_PROVIDER")

    async def list_keys(self, request):
        user_id = request.user_id
        keys = await self.api_key_repo.find_all_by_user(user_id)
        data = [
            {
                "provider": k.provider.value,
                "last4": k.last4,
                "registered_at": k.created_at.isoformat() if k.created_at else None,
                "updated_at": k.updated_at.isoformat() if k.updated_at else None,
            }
            for k in keys
        ]
        return success(data=data)

    async def upsert(self, request):
        user_id = request.user_id
        body = await request.json()
        provider = self._parse_provider(body.get("provider"))
        plain = (body.get("key") or "").strip()

        if not plain:
            fail("key가 비어있습니다.", "KEY_REQUIRED")
        if len(plain) < 16:
            fail("API 키 형식이 올바르지 않습니다.", "INVALID_KEY")

        encrypted = encrypt(plain)
        last4 = plain[-4:]

        record = await self.api_key_repo.upsert(
            user_id=user_id,
            provider=provider,
            encrypted_key=encrypted,
            last4=last4,
        )
        await self.api_key_repo.db.commit()

        return success(
            data={
                "provider": record.provider.value,
                "last4": record.last4,
                "registered_at": (
                    record.created_at.isoformat() if record.created_at else None
                ),
            }
        )

    async def delete(self, request):
        user_id = request.user_id
        body = await request.json()
        provider = self._parse_provider(body.get("provider"))

        record = await self.api_key_repo.find(user_id, provider)
        if not record:
            fail("등록된 키가 없습니다.", "KEY_NOT_FOUND", 404)

        await self.api_key_repo.delete(record)
        await self.api_key_repo.db.commit()
        return success(message="deleted")

    # ── chat 도메인에서 사용 ────────────────────
    async def get_decrypted_key(self, user_id: int, provider: Provider) -> str | None:
        record = await self.api_key_repo.find(user_id, provider)
        if not record:
            return None
        return decrypt(record.encrypted_key)
