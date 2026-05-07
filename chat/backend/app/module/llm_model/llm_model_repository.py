from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.llm_model.llm_model import LLMModel, ModelType


class LLMModelRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_active(self, type_: ModelType) -> list[LLMModel]:
        result = await self.db.execute(
            select(LLMModel)
            .where(LLMModel.type == type_, LLMModel.is_active.is_(True))
            .order_by(LLMModel.sort_order, LLMModel.id)
        )
        return list(result.scalars().all())

    async def find_all(self) -> list[LLMModel]:
        result = await self.db.execute(
            select(LLMModel).order_by(
                LLMModel.type, LLMModel.provider, LLMModel.sort_order, LLMModel.id
            )
        )
        return list(result.scalars().all())

    async def find_by_id(self, id: int) -> LLMModel | None:
        result = await self.db.execute(select(LLMModel).where(LLMModel.id == id))
        return result.scalar_one_or_none()

    async def find_by_value(self, value: str) -> LLMModel | None:
        result = await self.db.execute(
            select(LLMModel).where(LLMModel.value == value)
        )
        return result.scalar_one_or_none()

    async def add(self, model: LLMModel) -> LLMModel:
        self.db.add(model)
        await self.db.flush()
        return model

    async def delete(self, model: LLMModel) -> None:
        await self.db.delete(model)
