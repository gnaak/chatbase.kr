from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.api_key.api_key import ApiKey, Provider


class ApiKeyRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find(self, user_id: int, provider: Provider) -> ApiKey | None:
        result = await self.db.execute(
            select(ApiKey).where(
                ApiKey.user_id == user_id, ApiKey.provider == provider
            )
        )
        return result.scalar_one_or_none()

    async def find_all_by_user(self, user_id: int) -> list[ApiKey]:
        result = await self.db.execute(
            select(ApiKey).where(ApiKey.user_id == user_id)
        )
        return list(result.scalars().all())

    async def upsert(
        self, user_id: int, provider: Provider, encrypted_key: bytes, last4: str
    ) -> ApiKey:
        existing = await self.find(user_id, provider)
        if existing:
            existing.encrypted_key = encrypted_key
            existing.last4 = last4
            await self.db.flush()
            return existing

        new_key = ApiKey(
            user_id=user_id,
            provider=provider,
            encrypted_key=encrypted_key,
            last4=last4,
        )
        self.db.add(new_key)
        await self.db.flush()
        return new_key

    async def delete(self, key: ApiKey) -> None:
        await self.db.delete(key)
