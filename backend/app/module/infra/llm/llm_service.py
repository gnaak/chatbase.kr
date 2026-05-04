"""BYOK LLM 디스패처. provider별 infra service로 위임.

chat_service에서 보는 통합 진입점이며, 모델 prefix로 provider를 골라
infra/openai, infra/anthropic, infra/gemini로 라우팅한다.
"""

from typing import AsyncGenerator

from app.module.api_key.api_key import Provider
from app.module.infra.anthropic.chat_service import AnthropicChatService
from app.module.infra.gemini.chat_service import GeminiChatService
from app.module.infra.openai.chat_service import OpenAIChatService

MODEL_PROVIDER_MAP = {
    "gpt-": Provider.OPENAI,
    "claude-": Provider.ANTHROPIC,
    "gemini-": Provider.GOOGLE,
}

# 사용자 노출 alias → 실제 API 모델 ID
# (현재는 alias 사용 안 함. ALLOWED_MODELS의 ID를 그대로 쓰므로
# resolve_api_model의 fallback `model.get(m, m)`이 동일 ID를 반환.)
MODEL_API_ID: dict[str, str] = {}


def resolve_provider(model: str) -> Provider:
    for prefix, provider in MODEL_PROVIDER_MAP.items():
        if model.startswith(prefix):
            return provider
    raise ValueError(f"지원하지 않는 모델: {model}")


def resolve_api_model(model: str) -> str:
    return MODEL_API_ID.get(model, model)


class LLMService:
    """provider별 infra service를 들고 있는 디스패처. BYOK — api_key는 호출자가 전달."""

    def __init__(self) -> None:
        self._openai = OpenAIChatService()
        self._anthropic = AnthropicChatService()
        self._gemini = GeminiChatService()

    async def chat_stream(
        self,
        model: str,
        system_prompt: str,
        messages: list[dict],
        api_key: str,
        vector_store_id: str | None = None,
        enable_web_search: bool = False,
    ) -> AsyncGenerator[str, None]:
        provider = resolve_provider(model)
        api_model = resolve_api_model(model)
        instructions = system_prompt or None

        if provider == Provider.OPENAI:
            tools: list[dict] | None = None
            if vector_store_id:
                tools = [
                    {
                        "type": "file_search",
                        "vector_store_ids": [vector_store_id],
                    }
                ]
            stream = self._openai.generate_stream(
                messages=messages,
                model=api_model,
                api_key=api_key,
                instructions=instructions,
                tools=tools,
                enable_web_search=enable_web_search,
            )
        elif provider == Provider.ANTHROPIC:
            stream = self._anthropic.generate_stream(
                messages=messages,
                model=api_model,
                api_key=api_key,
                instructions=instructions,
                enable_web_search=enable_web_search,
            )
        elif provider == Provider.GOOGLE:
            stream = self._gemini.generate_stream(
                messages=messages,
                model=api_model,
                api_key=api_key,
                instructions=instructions,
                enable_web_search=enable_web_search,
            )
        else:
            raise ValueError(f"unhandled provider: {provider}")

        async for chunk in stream:
            yield chunk

    async def chat(
        self,
        model: str,
        system_prompt: str,
        messages: list[dict],
        api_key: str,
        vector_store_id: str | None = None,
        enable_web_search: bool = False,
    ) -> str:
        """비스트리밍은 스트림을 모아 반환."""
        chunks: list[str] = []
        async for chunk in self.chat_stream(
            model,
            system_prompt,
            messages,
            api_key,
            vector_store_id,
            enable_web_search,
        ):
            chunks.append(chunk)
        return "".join(chunks)
