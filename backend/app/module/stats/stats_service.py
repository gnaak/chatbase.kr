"""대화 통계.

봇 주인에게 "이 챗봇이 쓸모 있는가"를 알려주는 화면의 데이터를 만든다.

핵심은 **답변하지 못한 질문**이다. 질문이 평문이라 "자주 묻는 질문 TOP 5"를 세려면
의미로 묶어야 하는데("영업시간 알려주세요" / "몇 시까지 하나요?"는 같은 질문),
fallback은 문자열 비교만으로 잡히고 목록이 짧아 그대로 읽을 수 있다.
그리고 무엇을 학습 자료에 추가해야 하는지 바로 알려준다.

주제 묶기(topics)는 LLM에게 맡긴다. 사용자 키를 쓰므로 화면 진입이 아니라
버튼으로만 실행한다.
"""

import json
import re
from collections import Counter
from datetime import datetime, timedelta

from app.core.database.base import now_kst
from app.core.logging import get_logger
from app.core.utils.response import fail, success
from app.module.chat.chat_message import MessageRole
from app.module.infra.llm.llm_service import resolve_provider

logger = get_logger(__name__)

#: 카카오 유입 세션의 visitor_id 접두사.
KAKAO_PREFIX = "kakao:"
#: 대시보드 미리보기 세션. 방문자 대화가 아니므로 통계에서 뺀다.
PREVIEW_PREFIX = "preview-"

#: 화면에 내려줄 "답변 못 한 질문" 최대 개수. 읽을 수 있는 양으로 자른다.
MAX_UNANSWERED = 50
#: 주제 묶기에 넣을 질문 최대 개수. 프롬프트가 너무 길어지면 비용도 지연도 커진다.
MAX_TOPIC_QUESTIONS = 300

_WS = re.compile(r"\s+")

#: 집계 단위. 기간이 길어지면 일별 막대가 너무 많아져 못 읽는다.
BUCKET_UNITS = ("day", "week", "month")


def _bucket_key(dt: datetime, unit: str) -> str:
    """집계 단위별 버킷 키. 주간은 그 주 월요일 날짜로 묶는다."""
    if unit == "month":
        return dt.strftime("%Y-%m")
    if unit == "week":
        return (dt - timedelta(days=dt.weekday())).strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d")


def _bucket_range(since: datetime, until: datetime, unit: str) -> list[str]:
    """기간 전체의 버킷 키를 순서대로. **활동이 없는 구간도 포함한다.**

    Counter에 있는 키만 쓰면 대화가 없던 날이 x축에서 빠져서, 시간축이 아니라
    "활동한 날 목록"이 된다. 공백이 보여야 추세를 읽을 수 있다.
    """
    keys: list[str] = []
    seen = set()
    cursor = since
    while cursor <= until:
        key = _bucket_key(cursor, unit)
        if key not in seen:
            seen.add(key)
            keys.append(key)
        cursor += timedelta(days=1)
    return keys


def _norm(text: str) -> str:
    """fallback 비교용 정규화.

    LLM에 "정확히 그대로 답하라"고 지시하지만 공백이나 끝 문장부호를 살짝 바꿔
    쓰는 경우가 있다. 완벽하진 않고, 그건 감수한다.
    """
    return _WS.sub(" ", (text or "").strip()).rstrip(".!?…").strip()


class StatsService:
    def __init__(self, stats_repo, api_key_service=None, llm_service=None):
        self.stats_repo = stats_repo
        self.api_key_service = api_key_service
        self.llm_service = llm_service

    # ── 기간 내 원자료 수집 ─────────────────────
    async def _collect(self, user_id: int, bot_slug: str | None, days: int):
        bots = await self.stats_repo.find_bots(user_id)
        if bot_slug:
            bots = [b for b in bots if b.slug == bot_slug]
            if not bots:
                fail("봇을 찾을 수 없습니다.", "BOT_NOT_FOUND", 404)

        # MySQL DATETIME은 tz 없이(naive) 돌아온다. 저장할 때 now_kst()의 KST
        # 벽시계 값을 넣었으므로, 비교 기준도 같은 벽시계의 naive여야 한다.
        # tz-aware로 두면 파이썬 비교에서 TypeError가 난다.
        since = (now_kst() - timedelta(days=days)).replace(tzinfo=None)
        rows = await self.stats_repo.sessions_in_period([b.id for b in bots], since)

        # 미리보기 세션은 방문자 대화가 아니다.
        sessions = [
            (sid, bid, vid, started)
            for sid, bid, vid, started in rows
            if not vid.startswith(PREVIEW_PREFIX)
        ]
        session_ids = [s[0] for s in sessions]

        messages = await self.stats_repo.messages_in_sessions(session_ids, since)
        total = await self.stats_repo.message_count(session_ids, since)
        return bots, sessions, messages, total, since

    # ── Phase 1: NLP 없이 되는 지표 ─────────────
    async def get_summary(self, request):
        user_id = request.user_id
        bot_slug = (request.query_params.get("bot_id") or "").strip() or None
        try:
            days = max(1, min(400, int(request.query_params.get("days") or 30)))
        except ValueError:
            days = 30
        unit = (request.query_params.get("unit") or "day").strip()
        if unit not in BUCKET_UNITS:
            unit = "day"

        bots, sessions, messages, total_messages, since = await self._collect(
            user_id, bot_slug, days
        )
        bot_by_id = {b.id: b for b in bots}
        session_bot = {sid: bid for sid, bid, _vid, _started in sessions}
        # 기간 내 새로 시작된 세션 — 이탈률은 이쪽만 봐야 한다.
        new_session_ids = {
            sid for sid, _bid, _vid, started in sessions if started >= since
        }

        # fallback 문구를 봇별로 미리 정규화해둔다.
        fallback_by_bot = {
            b.id: _norm(b.fallback) for b in bots if (b.fallback or "").strip()
        }
        # FAQ 질문도 봇별로. 버튼을 누르면 이 문장이 그대로 발화로 온다.
        faq_by_bot: dict[int, set[str]] = {}
        for b in bots:
            faq_by_bot[b.id] = {
                _norm(f.get("q") or "") for f in (b.faqs or []) if (f.get("q") or "").strip()
            }

        daily = Counter()
        channel = Counter()
        per_session_user_count = Counter()
        unanswered: list[dict] = []
        faq_clicks = Counter()
        user_questions = 0

        # 세션별로 순서대로 걷는다. fallback 답변을 만나면 직전 사용자 질문을 짚는다.
        prev_user: dict[int, str] = {}
        for session_id, _mid, role, content, created_at in messages:
            bot_id = session_bot.get(session_id)
            if bot_id is None:
                continue

            if role == MessageRole.USER:
                user_questions += 1
                daily[_bucket_key(created_at, unit)] += 1
                per_session_user_count[session_id] += 1
                prev_user[session_id] = content
                if _norm(content) in faq_by_bot.get(bot_id, set()):
                    faq_clicks[content.strip()] += 1
            else:
                expected = fallback_by_bot.get(bot_id)
                if expected and _norm(content) == expected:
                    question = prev_user.get(session_id)
                    if question:
                        unanswered.append(
                            {
                                "question": question,
                                "bot_id": bot_by_id[bot_id].slug,
                                "bot_name": bot_by_id[bot_id].name,
                                "at": created_at.isoformat(),
                            }
                        )

        for _sid, _bid, visitor_id, _started in sessions:
            channel["kakao" if visitor_id.startswith(KAKAO_PREFIX) else "widget"] += 1

        # 첫 질문만 하고 떠난 세션 — 첫 답이 나빴다는 신호.
        # 기간 내 시작된 세션만 센다. 예전 세션이 이번 기간에 질문 1건을 받은 것은
        # 이탈이 아니라 재방문이다.
        one_shot = sum(
            1
            for sid, c in per_session_user_count.items()
            if c == 1 and sid in new_session_ids
        )

        fallback_count = len(unanswered)
        # fallback이 비어 있는 봇은 웹 검색으로 답하므로 "모른다"고 하지 않는다.
        # 그러면 이 지표가 0으로 나오는데, 잘한 게 아니라 측정이 안 되는 것이다.
        measurable = [b for b in bots if (b.fallback or "").strip()]

        return success(
            data={
                "days": days,
                "unit": unit,
                "sessions": len(sessions),
                "questions": user_questions,
                "one_shot_sessions": one_shot,
                # 활동 없는 구간도 0으로 채워 보낸다. 없는 날을 건너뛰면
                # 꺾은선이 빈 구간을 이어버려 거짓 추세가 된다.
                "series": [
                    {"bucket": key, "count": daily.get(key, 0)}
                    for key in _bucket_range(
                        since, now_kst().replace(tzinfo=None), unit
                    )
                ],
                "channels": [
                    {"channel": k, "sessions": v} for k, v in channel.items()
                ],
                "unanswered_count": fallback_count,
                "unanswered_rate": (
                    round(fallback_count / user_questions * 100, 1)
                    if user_questions
                    else 0.0
                ),
                "unanswered": unanswered[-MAX_UNANSWERED:][::-1],
                "faq_clicks": [
                    {"question": q, "count": c} for q, c in faq_clicks.most_common(10)
                ],
                # 측정 가능 여부를 같이 내려보낸다. 화면에서 "fallback을 설정하면
                # 이 지표를 볼 수 있습니다"를 안내해야 한다.
                "fallback_measurable_bots": len(measurable),
                "total_bots": len(bots),
                # 상한에 걸렸으면 수치가 일부만 반영된 것이다. 숨기면 안 된다.
                "truncated": total_messages > len(messages),
            }
        )

    # ── Phase 2: 질문 주제 묶기 (LLM, 온디맨드) ──
    async def get_topics(self, request):
        """사용자 키로 LLM을 불러 질문을 주제별로 묶는다.

        화면 진입이 아니라 버튼으로만 호출해야 한다 — 사용자 API 토큰을 쓴다.
        """
        user_id = request.user_id
        body = await request.json() if request.method == "POST" else {}
        bot_slug = (body.get("bot_id") or "").strip() or None
        days = max(1, min(365, int(body.get("days") or 30)))

        bots, _sessions, messages, _total, _since = await self._collect(
            user_id, bot_slug, days
        )
        if not bots:
            fail("분석할 챗봇이 없습니다.", "NO_BOT")

        questions = [
            content.strip()
            for _sid, _mid, role, content, _at in messages
            if role == MessageRole.USER and content.strip()
        ]
        if len(questions) < 5:
            return success(
                data={"topics": [], "analyzed": len(questions)},
                message="질문이 5건 이상 모이면 주제별로 묶어 보여드립니다.",
            )

        sample = questions[-MAX_TOPIC_QUESTIONS:]

        # 모델·키는 대상 봇 기준. 봇을 안 고르면 첫 봇 설정을 쓴다.
        target = bots[0]
        provider = resolve_provider(target.model)
        api_key = await self.api_key_service.get_decrypted_key(user_id, provider)
        if not api_key:
            fail(
                f"{provider.value} API 키를 먼저 등록해 주세요.",
                "API_KEY_REQUIRED",
            )

        numbered = "\n".join(f"- {q}" for q in sample)
        prompt = (
            "아래는 챗봇에 들어온 방문자 질문 목록입니다. "
            "의미가 비슷한 질문을 주제별로 묶어 주세요.\n\n"
            "규칙:\n"
            "- 묶음은 3~8개로 만드세요.\n"
            "- 각 묶음에 짧은 한국어 이름을 붙이세요 (예: 영업시간 문의).\n"
            "- 각 묶음의 질문 개수를 세고, 대표 질문 2개를 골라주세요.\n"
            "- 건수가 많은 묶음부터 정렬하세요.\n"
            '- 반드시 아래 JSON 형식만 출력하세요. 설명·코드블록 없이 JSON만:\n'
            '{"topics":[{"name":"이름","count":12,"examples":["질문1","질문2"]}]}\n\n'
            f"질문 목록:\n{numbered}"
        )

        try:
            raw = await self.llm_service.chat(
                model=target.model,
                system_prompt="당신은 데이터 분석 도구입니다. JSON만 출력합니다.",
                messages=[{"role": "user", "content": prompt}],
                api_key=api_key,
            )
        except Exception:
            logger.exception("통계 주제 묶기 실패 user=%s", user_id)
            fail("주제 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.", "TOPIC_FAILED")

        topics = _parse_topics(raw)
        if topics is None:
            logger.warning("통계 주제 묶기 JSON 파싱 실패 user=%s raw=%.200s", user_id, raw)
            fail("주제 분석 결과를 읽지 못했습니다. 다시 시도해 주세요.", "TOPIC_PARSE_FAILED")

        return success(data={"topics": topics, "analyzed": len(sample)})


def _parse_topics(raw: str) -> list[dict] | None:
    """LLM 응답에서 topics 배열을 뽑는다.

    JSON만 출력하라고 지시해도 코드블록이나 앞뒤 설명을 붙이는 경우가 있어
    중괄호 구간을 잘라 파싱한다.
    """
    text = (raw or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None

    topics = parsed.get("topics")
    if not isinstance(topics, list):
        return None

    cleaned = []
    for t in topics:
        if not isinstance(t, dict):
            continue
        name = str(t.get("name") or "").strip()
        if not name:
            continue
        examples = [str(e).strip() for e in (t.get("examples") or []) if str(e).strip()]
        try:
            count = int(t.get("count") or 0)
        except (TypeError, ValueError):
            count = 0
        cleaned.append({"name": name, "count": count, "examples": examples[:2]})
    return cleaned
