"""BYOK LLM 번역. FAQ·인사말을 미리 번역해두는 데만 쓴다.

대화 응답은 여기를 거치지 않는다 — LLM이 방문자 언어에 맞춰 실시간으로 답한다
(`chat_service._build_system_prompt`의 언어 규칙).

## 왜 DeepL을 걷어냈나

DeepL 키는 **우리 것**이었다. 서비스의 다른 모든 LLM 호출이 사용자 키(BYOK)인데
번역만 우리가 부담하고 있었고, 무료 키의 월 50만 자 한도도 우리 쪽 병목이었다.
봇 주인의 키로 옮기면 원가가 0이고 한도도 주인 몫이다.

## 대신 받아들인 것 — 번역이 흔들릴 수 있다

번역기는 같은 원문에 같은 결과를 주지만 **LLM은 그렇지 않다.** FAQ는 고객이
화면에서 그대로 읽는 확정 문구라 이게 약점이다. 두 겹으로 막는다:

1. **`source_hash`** — 원문이 그대로면 아예 부르지 않는다. 판정은 호출부
   (`bot_service._translate_bot_faqs`)가 하고, 여기까지 오지도 않는다.
2. **프롬프트에서 의역·설명·따옴표 추가를 금지하고 JSON 배열만 받는다.**

그래도 남는 것: **원문을 고치면 그 봇·그 언어의 번역이 통째로 다시 만들어진다.**
FAQ 5번만 고쳤는데 1번의 번역 문장이 미세하게 달라질 수 있다. 해시가 인사말+FAQ
전체를 한 덩어리로 잡기 때문이다. 알고 받은 트레이드오프이고, 원문을 건드리지
않는 한 화면 문구는 고정이다.

`temperature`를 0으로 낮추면 더 줄겠지만, 세 provider의 `generate_stream`이
그 인자를 받지 않아 3사 래퍼를 모두 고쳐야 한다. 번역 하나 때문에 공용 호출
경로를 넓히는 건 이득보다 위험이 커서 하지 않았다.

## 실패하면

`None`을 돌려준다. 호출부가 그 언어를 건너뛰고 다음 저장 때 재시도한다.
번역이 없으면 원문(한국어)이 그대로 나가므로 서비스는 산다.
"""

import json
import logging
import re

logger = logging.getLogger(__name__)

#: 우리 언어 코드 → 프롬프트에 넣을 언어 이름.
#: 중국어는 간체다. 번체가 필요해지면 코드를 따로 늘린다(zh-hant).
_LANG_NAME = {
    "en": "English",
    "ja": "Japanese",
    "zh": "Simplified Chinese",
}

#: 한 요청에 담을 원문 총 문자 수. DeepL 때는 1,400자였지만 그건 무료 키의
#: 요청당 제한 때문이었고, LLM은 훨씬 큰 입력을 받는다. 요청 수를 줄이는 쪽이
#: 낫다 — 요청이 갈릴수록 앞뒤 문맥이 끊겨 용어가 달라질 여지가 커진다.
_MAX_CHARS_PER_REQUEST = 6_000

#: 모델이 JSON을 코드펜스로 감싸 보내는 경우가 흔하다. 벗겨낸다.
_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def _instructions(lang: str) -> str:
    """번역 전용 시스템 프롬프트.

    봇의 시스템 프롬프트는 **쓰지 않는다.** 봇 페르소나가 끼면 "친절하게
    풀어서" 같은 지시가 번역에 섞여 원문 구조가 무너진다.
    """
    name = _LANG_NAME[lang]
    return (
        f"You are a translation engine. Translate each string of the input "
        f"JSON array from Korean into {name}.\n\n"
        "Rules:\n"
        "- Output ONLY a JSON array of strings. No prose, no markdown fences.\n"
        "- The output array MUST have exactly as many elements as the input, "
        "in the same order. Never merge, split, drop, or reorder elements.\n"
        "- Translate faithfully. Do not paraphrase, summarize, expand, "
        "annotate, or add quotation marks that are not in the source.\n"
        "- Preserve line breaks, whitespace structure, numbers, URLs, email "
        "addresses, phone numbers and emoji exactly as they appear.\n"
        "- Leave Latin-script brand, product and proper names unchanged.\n"
        "- If an element is an empty string, return an empty string for it.\n"
        "- Use consistent terminology across all elements of one request."
    )


def _parse(raw: str, expected: int) -> list[str] | None:
    """모델 응답에서 문자열 배열을 꺼낸다. 모양이 어긋나면 None."""
    text = _FENCE.sub("", (raw or "").strip())
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        logger.warning("translate parse failed: %.200s", text)
        return None

    if not isinstance(parsed, list):
        logger.warning("translate not a list: %.200s", text)
        return None
    if len(parsed) != expected:
        # DeepL 때와 같은 판정이다. 개수가 어긋난 응답은 q/a 짝이 밀려
        # 엉뚱한 질문에 엉뚱한 답이 붙으므로 쓰지 않는다.
        logger.warning(
            "translate length mismatch sent=%d got=%d", expected, len(parsed)
        )
        return None
    if not all(isinstance(x, str) for x in parsed):
        logger.warning("translate non-string element: %.200s", text)
        return None
    return parsed


async def translate(
    texts: list[str],
    lang: str,
    *,
    model: str,
    api_key: str,
    llm_service,
) -> list[str] | None:
    """한국어 문자열 여러 개를 `lang`으로. 실패하면 None.

    입력과 **같은 길이·같은 순서**의 리스트를 돌려준다. FAQ의 q/a를 번갈아
    넣고 인덱스로 되꺼내 쓰기 때문에, 순서가 어긋나면 답이 엉뚱한 질문에 붙는다.
    """
    if not texts or lang not in _LANG_NAME:
        return None

    try:
        raw = await llm_service.chat(
            model=model,
            system_prompt=_instructions(lang),
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(texts, ensure_ascii=False),
                }
            ],
            api_key=api_key,
        )
    except Exception as exc:  # noqa: BLE001
        # 키 오류·한도 소진·모델 미지원이 모두 여기로 온다. 호출부가 사유별로
        # 분류해 로그를 남기므로(classify_llm_error) 여기서는 그대로 올린다.
        logger.warning("translate failed lang=%s model=%s: %s", lang, model, exc)
        raise

    return _parse(raw, len(texts))


async def translate_faqs(
    faqs: list[dict],
    lang: str,
    *,
    model: str,
    api_key: str,
    llm_service,
) -> list[dict] | None:
    """`[{q, a}, ...]` 를 통째로 번역한다.

    q와 a를 한 배열에 번갈아 담아 **요청 한 번**으로 끝낸다. FAQ가 10개면
    20개 문자열이고, 따로 부르면 20번이 된다.
    """
    if not faqs:
        return []

    flat: list[str] = []
    for f in faqs:
        flat.append((f.get("q") or "").strip())
        flat.append((f.get("a") or "").strip())

    total = sum(len(t) for t in flat)
    if total > _MAX_CHARS_PER_REQUEST:
        # 길면 나눠 보낸다. 순서는 그대로 이어 붙인다.
        #
        # ⚠️ q/a 짝이 서로 다른 요청으로 갈려도 결과는 맞다 — flat 인덱스로
        # 되꺼내기 때문이다. 다만 짝을 붙여 보내는 편이 문맥상 유리해서
        # 두 칸 단위로 끊는다.
        out: list[str] = []
        chunk: list[str] = []
        size = 0
        for i in range(0, len(flat), 2):
            pair = flat[i : i + 2]
            pair_size = sum(len(t) for t in pair)
            if chunk and size + pair_size > _MAX_CHARS_PER_REQUEST:
                part = await translate(
                    chunk, lang, model=model, api_key=api_key, llm_service=llm_service
                )
                if part is None:
                    return None
                out.extend(part)
                chunk, size = [], 0
            chunk.extend(pair)
            size += pair_size
        if chunk:
            part = await translate(
                chunk, lang, model=model, api_key=api_key, llm_service=llm_service
            )
            if part is None:
                return None
            out.extend(part)
        translated = out
    else:
        translated = await translate(
            flat, lang, model=model, api_key=api_key, llm_service=llm_service
        )
        if translated is None:
            return None

    return [
        {"q": translated[i * 2], "a": translated[i * 2 + 1]}
        for i in range(len(faqs))
    ]
