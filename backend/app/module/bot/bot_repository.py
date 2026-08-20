from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.bot.bot import Bot
from app.module.bot.bot_file import BotFile


class BotRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_by_id(self, bot_id: int) -> Bot | None:
        result = await self.db.execute(select(Bot).where(Bot.id == bot_id))
        return result.scalar_one_or_none()

    async def find_by_slug(self, slug: str) -> Bot | None:
        result = await self.db.execute(select(Bot).where(Bot.slug == slug))
        return result.scalar_one_or_none()

    async def find_by_user(self, user_id: int) -> list[Bot]:
        result = await self.db.execute(
            select(Bot).where(Bot.user_id == user_id).order_by(Bot.created_at.desc())
        )
        return list(result.scalars().all())

    async def add(self, bot: Bot) -> Bot:
        self.db.add(bot)
        await self.db.flush()
        return bot

    async def delete(self, bot: Bot) -> None:
        await self.db.delete(bot)

    # ── BotFile ─────────────────────────────────
    async def find_files_by_bot(self, bot_id: int) -> list[BotFile]:
        result = await self.db.execute(
            select(BotFile)
            .where(BotFile.bot_id == bot_id)
            .order_by(BotFile.created_at.desc())
        )
        return list(result.scalars().all())

    async def find_file_by_id(self, file_id: int) -> BotFile | None:
        result = await self.db.execute(select(BotFile).where(BotFile.id == file_id))
        return result.scalar_one_or_none()

    async def add_file(self, file: BotFile) -> BotFile:
        self.db.add(file)
        await self.db.flush()
        return file

    async def delete_file(self, file: BotFile) -> None:
        await self.db.delete(file)
