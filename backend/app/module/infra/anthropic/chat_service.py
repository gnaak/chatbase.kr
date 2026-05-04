import logging
from typing import AsyncIterator

from anthropic import AsyncAnthropic

logger = logging.getLogger("app.infra.anthropic")


class AnthropicChatService:
    """Anthropic Messages API 스트리밍 래퍼. BYOK — 호출자가 api_key를 전달."""

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        api_key: str,
        instructions: str | None = None,
        tools: list[dict] | None = None,
        enable_web_search: bool = False,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        client = AsyncAnthropic(api_key=api_key)
        merged_tools: list[dict] = list(tools or [])
        if enable_web_search:
            merged_tools.append(
                {
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": 3,
                }
            )
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "system": instructions or "",
        }
        if merged_tools:
            kwargs["tools"] = merged_tools

        logger.info(
            "request model=%s messages=%d web_search=%s tools=%d",
            model,
            len(messages),
            enable_web_search,
            len(merged_tools),
        )
        chunks = 0
        try:
            async with client.messages.stream(**kwargs) as stream:
                async for text in stream.text_stream:
                    chunks += 1
                    yield text
            logger.info("response model=%s chunks=%d", model, chunks)
        except Exception:
            logger.exception("error model=%s after_chunks=%d", model, chunks)
            raise
