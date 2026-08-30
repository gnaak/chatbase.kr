from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

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

    async def count_active_by_user(self, user_id: int) -> int:
        """켜져 있는 봇 수. 플랜 개수 제한은 비활성 봇을 세지 않는다.

        비활성은 자리를 차지하지 않으므로, 안 쓰는 봇을 끄고 새로 만들 수 있다.
        대신 "끄고 만든 뒤 다시 켜기"로 상한을 넘길 수 있어 활성화 시점에도 막는다
        (`bot_service.update_bot`).
        """
        result = await self.db.execute(
            select(func.count())
            .select_from(Bot)
            .where(Bot.user_id == user_id, Bot.active.is_(True))
        )
        return int(result.scalar() or 0)

    async def find_by_user(self, user_id: int) -> list[Bot]:
        result = await self.db.execute(
            select(Bot).where(Bot.user_id == user_id).order_by(Bot.created_at.desc())
        )
        return list(result.scalars().all())

    async def find_by_user_summary(self, user_id: int) -> list[Bot]:
        """목록 화면용. 무거운 컬럼을 빼고 읽는다.

        logo·widget_icon은 base64 데이터 URL이 통째로 들어가는 MEDIUMTEXT이고,
        training_text는 학습 자료 전문이다. 목록 화면 어디서도 안 쓰는데 봇마다
        수백 KB씩 실려 나가서, 봇이 몇 개만 돼도 응답이 메가바이트가 된다.
        실측: GET /api/bot/ 3208ms — 같은 순간의 GET /api/api-key/ 는 13ms였고,
        나란히 뜬 GET /api/usage/ 까지 3227ms로 같이 끌려갔다.

        ⚠️ load_only에서 뺀 컬럼은 나중에 접근하면 지연 로딩이 걸리는데,
        async 세션에서는 그게 MissingGreenlet 예외로 터진다. 이 메서드가 돌려준
        객체는 반드시 `_bot_to_summary()`로만 직렬화할 것. 필드를 늘릴 때도
        여기 load_only와 그쪽 dict를 **같이** 고쳐야 한다.

        전체가 필요한 곳(chat_service 등)은 위 find_by_user를 그대로 쓴다.
        """
        result = await self.db.execute(
            select(Bot)
            .where(Bot.user_id == user_id)
            .options(
                load_only(
                    Bot.slug,
                    Bot.name,
                    Bot.model,
                    Bot.system_prompt,
                    Bot.greeting,
                    Bot.active,
                    Bot.created_at,
                    Bot.updated_at,
                )
            )
            .order_by(Bot.created_at.desc())
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
