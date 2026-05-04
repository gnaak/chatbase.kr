"""LiteLLM 공개 가격 JSON에서 provider별 가격 정보를 매칭한다.

provider SDK의 models.list()는 가격을 반환하지 않으므로, 공개 JSON과 매칭해서
가격이 있는 모델만 카탈로그에 노출한다.
"""

import httpx

LITELLM_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json"
)


async def fetch_pricing_data() -> dict:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(LITELLM_URL)
        r.raise_for_status()
        data = r.json()
    if isinstance(data, dict) and "sample_spec" in data:
        data = {k: v for k, v in data.items() if k != "sample_spec"}
    return data


def _candidates(model_id: str, provider_hint: str | None) -> list[str]:
    cands = [model_id]
    if provider_hint:
        cands.append(f"{provider_hint}/{model_id}")
        if provider_hint == "gemini":
            cands.append(f"google/{model_id}")
            cands.append(f"vertex_ai/{model_id}")
    return cands


def lookup(
    pricing_data: dict, model_id: str, provider_hint: str | None = None
) -> dict | None:
    for k in _candidates(model_id, provider_hint):
        if k in pricing_data:
            return pricing_data[k]
    return None


def chat_pricing(entry: dict | None) -> dict | None:
    """USD per 1M tokens로 변환. 둘 중 하나라도 없으면 None."""
    if not entry:
        return None
    inp = entry.get("input_cost_per_token")
    out = entry.get("output_cost_per_token")
    mode = (entry.get("mode") or "").lower()
    if mode and "chat" not in mode and "completion" not in mode:
        return None
    if inp is None or out is None:
        return None
    return {
        "input": round(inp * 1_000_000, 4),
        "output": round(out * 1_000_000, 4),
    }


def image_pricing(entry: dict | None) -> dict | None:
    """USD per image. 없으면 None."""
    if not entry:
        return None
    per = entry.get("output_cost_per_image") or entry.get("input_cost_per_image")
    mode = (entry.get("mode") or "").lower()
    if mode and "image" not in mode:
        return None
    if per is None:
        return None
    return {"per_image": round(per, 4)}
