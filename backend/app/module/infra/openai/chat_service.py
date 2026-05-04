import asyncio
from typing import AsyncIterator

from openai import AsyncOpenAI


class OpenAIChatService:
    """OpenAI Responses API 스트리밍 래퍼. BYOK — 호출자가 api_key를 전달."""

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        api_key: str,
        instructions: str | None = None,
        tools: list[dict] | None = None,
        enable_web_search: bool = False,
    ) -> AsyncIterator[str]:
        client = AsyncOpenAI(api_key=api_key)
        merged_tools: list[dict] = list(tools or [])
        if enable_web_search:
            merged_tools.append({"type": "web_search_preview"})
        response = None
        try:
            response = await client.responses.create(
                model=model,
                input=messages,
                stream=True,
                tools=merged_tools or None,
                instructions=instructions,
            )
            async for event in response:
                if event.type == "response.output_text.delta":
                    yield event.delta
                elif event.type == "response.completed":
                    break
        except asyncio.CancelledError:
            if response:
                await response.close()
            raise
