import re

from google import genai as google_genai

from app.module.infra.llm import pricing

_GEMINI_VERSION = re.compile(r"^gemini-(\d+)\.(\d+)")
_GEMINI_MIN = (2, 5)


def _normalize(name: str) -> str:
    return name.replace("models/", "")


def _passes_chat_cutoff(mid: str) -> bool:
    m = _GEMINI_VERSION.match(mid)
    if not m:
        return False
    return (int(m.group(1)), int(m.group(2))) >= _GEMINI_MIN


class GeminiModelService:
    """Gemini models.list() + LiteLLM 가격 매칭. 가격 있는 모델만."""

    async def discover(
        self, api_key: str, pricing_data: dict | None = None
    ) -> dict[str, list[dict]]:
        client = google_genai.Client(api_key=api_key)
        chat: dict[str, dict] = {}
        image: dict[str, dict] = {}

        if pricing_data is None:
            pricing_data = await pricing.fetch_pricing_data()

        page = await client.aio.models.list()
        async for m in page:
            mid = _normalize(m.name or "")
            if not mid:
                continue
            entry = pricing.lookup(pricing_data, mid, "gemini")
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
