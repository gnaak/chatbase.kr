from typing import AsyncIterator

from anthropic import AsyncAnthropic


class AnthropicChatService:
    """Anthropic Messages API 스트리밍 래퍼. BYOK — 호출자가 api_key를 전달."""

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        api_key: str,
        instructions: str | None = None,
        tools: list[dict] | None = None,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        client = AsyncAnthropic(api_key=api_key)
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "system": instructions or "",
        }
        if tools:
            kwargs["tools"] = tools

        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text
