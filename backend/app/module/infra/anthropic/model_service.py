import re

from anthropic import AsyncAnthropic

from app.module.infra.llm import pricing

_CLAUDE_VERSION = re.compile(r"^claude-(?:opus|sonnet|haiku)-(\d+)-(\d+)")
_CLAUDE_MIN = (4, 5)


def _passes_cutoff(mid: str) -> bool:
    m = _CLAUDE_VERSION.match(mid)
    if not m:
        return False
    return (int(m.group(1)), int(m.group(2))) >= _CLAUDE_MIN


class AnthropicModelService:
    """Anthropic models.list() + LiteLLM 가격 매칭. 가격 있는 모델만."""

    async def discover(
        self, api_key: str, pricing_data: dict | None = None
    ) -> dict[str, list[dict]]:
        client = AsyncAnthropic(api_key=api_key)
        result = await client.models.list()

        if pricing_data is None:
            pricing_data = await pricing.fetch_pricing_data()

        chat: dict[str, dict] = {}
        for m in result.data:
            mid = m.id or ""
            if not _passes_cutoff(mid):
                continue
            entry = pricing.lookup(pricing_data, mid, "anthropic")
            chat_p = pricing.chat_pricing(entry)
            if chat_p:
                chat[mid] = {"value": mid, "pricing": chat_p}

        return {
            "chat": sorted(chat.values(), key=lambda x: x["value"], reverse=True),
            "image": [],
        }
