from typing import AsyncIterator

from google import genai as google_genai
from google.genai import types as genai_types


class GeminiChatService:
    """Gemini generate_content_stream 래퍼. BYOK — 호출자가 api_key를 전달."""

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        api_key: str,
        instructions: str | None = None,
        tools: list[dict] | None = None,
        enable_web_search: bool = False,
    ) -> AsyncIterator[str]:
        client = google_genai.Client(api_key=api_key)

        contents = []
        for msg in messages:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        merged_tools: list = list(tools or [])
        if enable_web_search:
            merged_tools.append(
                genai_types.Tool(google_search=genai_types.GoogleSearch())
            )

        config = genai_types.GenerateContentConfig(
            system_instruction=instructions or None,
            tools=merged_tools or None,
        )

        stream = await client.aio.models.generate_content_stream(
            model=model,
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            candidates = getattr(chunk, "candidates", None) or []
            for cand in candidates:
                content = getattr(cand, "content", None)
                if not content:
                    continue
                for part in getattr(content, "parts", None) or []:
                    text = getattr(part, "text", None)
                    if text:
                        yield text
