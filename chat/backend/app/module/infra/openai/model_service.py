import re

from openai import AsyncOpenAI

from app.module.infra.llm import pricing

_GPT_VERSION = re.compile(r"^gpt-(\d+)[.-](\d+)")
_GPT_MIN = (5, 4)


def _passes_chat_cutoff(mid: str) -> bool:
    m = _GPT_VERSION.match(mid)
    if not m:
        return False
    return (int(m.group(1)), int(m.group(2))) >= _GPT_MIN


class OpenAIModelService:
    """OpenAI models.list() + LiteLLM 가격 매칭. 가격 있는 모델만."""

    async def discover(
        self, api_key: str, pricing_data: dict | None = None
    ) -> dict[str, list[dict]]:
        client = AsyncOpenAI(api_key=api_key)
        page = await client.models.list()
        chat: dict[str, dict] = {}
        image: dict[str, dict] = {}

        if pricing_data is None:
            pricing_data = await pricing.fetch_pricing_data()

        async for m in page:
            mid = m.id
            entry = pricing.lookup(pricing_data, mid, "openai")
            if not entry:
                continue
            chat_p = pricing.chat_pricing(entry)
            if chat_p:
                if not _passes_chat_cutoff(mid):
                    continue
                chat[mid] = {"value": mid, "pricing": chat_p}
                continue
            image_p = pricing.image_pricing(entry)
            if image_p:
                image[mid] = {"value": mid, "pricing": image_p}

        return {
            "chat": sorted(chat.values(), key=lambda x: x["value"], reverse=True),
            "image": sorted(image.values(), key=lambda x: x["value"], reverse=True),
        }
