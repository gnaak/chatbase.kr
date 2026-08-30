"""BYOK LLM 디스패처. provider별 infra service로 위임.

chat_service에서 보는 통합 진입점이며, 모델 prefix로 provider를 골라
infra/openai, infra/anthropic, infra/gemini로 라우팅한다.
"""

import re
from typing import AsyncGenerator

from app.module.api_key.api_key import Provider
from app.module.infra.anthropic.chat_service import AnthropicChatService
from app.module.infra.gemini.chat_service import GeminiChatService
from app.module.infra.openai.chat_service import OpenAIChatService

# ── 출처 마커 제거 ────────────────────────────
# 벡터 스토어(file_search)를 붙이면 OpenAI가 답변 본문에 출처 토큰을 심어 보낸다.
# 걸러내지 않으면 "...포함됩니다 fileciteturn0file1turn0file3" 처럼 그대로 노출된다.
# 구분자가 사설 사용 영역(U+E000~U+F8FF) 문자라 화면에서는 안 보이고 텍스트만 남는다.
_PUA = r"[-]"
_CITATION_PATTERNS = [
    # fileciteturn0file1 및 구분자가 빠진 변형
    re.compile(rf"{_PUA}*(?:file)?cite{_PUA}*(?:turn\d+\w*{_PUA}*)+"),
    # 구형 annotation 표기: 【4:0†source】
    re.compile(r"【\d+(?::\d+)?†[^】]*】"),
    # 위에서 못 걷어낸 잔여 사설 영역 문자
    re.compile(_PUA),
]


def strip_citations(text: str) -> str:
    """LLM 답변에서 출처 마커를 제거한다."""
    if not text:
        return text
    for pattern in _CITATION_PATTERNS:
        text = pattern.sub("", text)
    # 마커가 있던 자리에 생긴 이중 공백 정리. 줄바꿈은 건드리지 않는다.
    text = re.sub(r"[ \t]{2,}", " ", text)
    return re.sub(r"[ \t]+(?=[.,!?]|\n|$)", "", text)


MODEL_PROVIDER_MAP = {
    "gpt-": Provider.OPENAI,
    "claude-": Provider.ANTHROPIC,
    "gemini-": Provider.GOOGLE,
}

# 사용자 노출 alias → 실제 API 모델 ID
# (현재는 alias 사용 안 함. ALLOWED_MODELS의 ID를 그대로 쓰므로
# resolve_api_model의 fallback `model.get(m, m)`이 동일 ID를 반환.)
MODEL_API_ID: dict[str, str] = {}


# ── 오류 분류 ────────────────────────────────
# 세 제공자의 SDK가 예외 타입을 제각각 쓴다. 타입으로 가르려면 세 SDK를 전부
# import해야 하고 버전이 오를 때마다 깨진다. 문자열 판정이 정확하진 않지만
# 여기서 필요한 건 "주인이 무엇을 해야 하는가" 수준의 구분이라 이 정도로 충분하다.
def classify_llm_error(exc: Exception) -> str:
    """LLM 예외를 `auth` / `quota` / `other`로. 값은 `LlmErrorKind`와 맞춘다.

    화면 문구(`_format_llm_error`)와 DB 적재(`LlmErrorRepository.record`)가
    같은 판정을 써야 한다. 두 곳에서 따로 문자열을 훑으면 화면은 "키 오류"라고
    하는데 통계는 "기타"로 잡히는 상태가 된다.
    """
    raw = str(exc)
    low = raw.lower()
    if (
        "api_key" in low
        or "auth_token" in low
        or "x-api-key" in low
        or "authentication" in low
        or "401" in raw
        or "unauthorized" in low
        or "invalid api key" in low
        or "api key not valid" in low
    ):
        return "auth"
    if (
        "quota" in low
        or "insufficient" in low
        or "billing" in low
        or "credit" in low
        or "429" in raw
        or "rate limit" in low
    ):
        return "quota"
    return "other"


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
        # 델타 경계에 마커가 걸릴 수 있으므로 조립이 끝난 뒤에 한 번만 지운다.
        return strip_citations("".join(chunks))
