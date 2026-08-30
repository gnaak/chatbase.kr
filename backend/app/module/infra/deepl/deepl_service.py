"""DeepL 번역.

FAQ를 미리 번역해두는 데만 쓴다. 대화 응답은 LLM이 실시간으로 맞추므로
여기를 거치지 않는다.

## 왜 LLM이 아니라 DeepL인가

BYOK라 LLM 번역도 원가가 0이긴 하다. 다만 FAQ는 **고객이 화면에서 그대로 읽는
확정 문구**라, 매번 결과가 흔들리는 쪽보다 번역기가 낫다. 같은 원문을 다시
번역했을 때 다른 문장이 나오면 고객사가 "왜 바뀌었냐"고 묻게 된다.

## 한도

무료 키는 **월 50만 자**다. 그래서 호출 전에 `source_hash`로 원문이 바뀌었는지
먼저 보고, 안 바뀌었으면 아예 부르지 않는다(`bot_translation.py` 참고).
한 번에 여러 문장을 배열로 보내 요청 수도 줄인다.

## 키가 없으면

조용히 아무것도 하지 않는다. 번역은 부가 기능이라, 키가 없다고 봇 저장이
실패하면 안 된다. 호출부가 `None`을 받고 넘어간다.
"""

import logging

import httpx

from app.core.config.settings import settings

logger = logging.getLogger(__name__)

_FREE_ENDPOINT = "https://api-free.deepl.com/v2/translate"
_PRO_ENDPOINT = "https://api.deepl.com/v2/translate"

#: 우리 언어 코드 → DeepL target_lang.
#: 영어는 변종을 요구해서 EN 단독으로는 안 된다(EN-US / EN-GB).
#: 중국어는 간체(ZH)로 보낸다 — 번체가 필요해지면 ZH-HANT를 따로 추가한다.
_TARGET_LANG = {
    "en": "EN-US",
    "ja": "JA",
    "zh": "ZH",
}

#: 무료 키는 요청당 문자 수 제한이 있다. FAQ 한 덩어리가 이걸 넘으면 잘라 보낸다.
_MAX_CHARS_PER_REQUEST = 1_400


def _endpoint(key: str) -> str:
    """무료 키는 `:fx`로 끝난다. 엔드포인트가 달라서 여기서 갈라준다."""
    return _FREE_ENDPOINT if key.endswith(":fx") else _PRO_ENDPOINT


def is_configured() -> bool:
    return bool(getattr(settings, "deepl_api_key", None))


async def translate(texts: list[str], lang: str) -> list[str] | None:
    """한국어 문자열 여러 개를 `lang`으로. 실패하면 None.

    입력과 **같은 길이·같은 순서**의 리스트를 돌려준다. FAQ의 q/a를 번갈아
    넣고 그대로 다시 꺼내 쓰기 때문에 순서가 어긋나면 답이 엉뚱한 질문에 붙는다.
    DeepL은 요청 순서를 보존하지만, 개수가 어긋나면 그건 우리가 못 쓰는 응답이라
    None으로 떨어뜨린다.
    """
    key = getattr(settings, "deepl_api_key", None)
    target = _TARGET_LANG.get(lang)
    if not key or not target or not texts:
        return None

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                _endpoint(key),
                headers={"Authorization": f"DeepL-Auth-Key {key}"},
                json={
                    "text": texts,
                    "source_lang": "KO",
                    "target_lang": target,
                    # FAQ 답변에 줄바꿈이 있다. 기본값이면 문장을 다시 나누면서
                    # 줄 구조가 뭉개진다.
                    "split_sentences": "nonewlines",
                },
            )
            resp.raise_for_status()
            out = [t.get("text", "") for t in resp.json().get("translations", [])]
    except httpx.HTTPStatusError as e:
        # 456 = 이번 달 한도 소진. 로그만 남기고 조용히 포기한다 —
        # 번역이 없어도 원문(한국어) FAQ가 그대로 나가므로 서비스는 산다.
        logger.warning(
            "deepl failed lang=%s status=%s", lang, e.response.status_code
        )
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("deepl failed lang=%s: %s", lang, exc)
        return None

    if len(out) != len(texts):
        logger.warning(
            "deepl length mismatch lang=%s sent=%d got=%d", lang, len(texts), len(out)
        )
        return None
    return out


async def translate_faqs(faqs: list[dict], lang: str) -> list[dict] | None:
    """`[{q, a}, ...]` 를 통째로 번역한다.

    q와 a를 한 배열에 번갈아 담아 **요청 한 번**으로 끝낸다. FAQ가 10개면
    20개 문자열이고, 이걸 따로 부르면 20번이 된다.
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
        out: list[str] = []
        chunk: list[str] = []
        size = 0
        for t in flat:
            if chunk and size + len(t) > _MAX_CHARS_PER_REQUEST:
                part = await translate(chunk, lang)
                if part is None:
                    return None
                out.extend(part)
                chunk, size = [], 0
            chunk.append(t)
            size += len(t)
        if chunk:
            part = await translate(chunk, lang)
            if part is None:
                return None
            out.extend(part)
        translated = out
    else:
        translated = await translate(flat, lang)
        if translated is None:
            return None

    return [
        {"q": translated[i * 2], "a": translated[i * 2 + 1]}
        for i in range(len(faqs))
    ]
