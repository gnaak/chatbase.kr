from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.provider.http.endpoint import with_provider
from app.core.provider.http.login import with_login, without_login
from app.core.provider.http.service import ServiceProvider

router = APIRouter()


# ── 임베드 위젯 (인증 없음) ─────────────────────
@router.post("/message")
@with_provider
@without_login
async def send_message(p: ServiceProvider):
    """body: {bot_id, visitor_id, content, session_id?}"""
    return await p.chat_service.send_message(p.request)


@router.post("/stream")
@with_provider
@without_login
async def stream_message(p: ServiceProvider):
    """SSE 응답. body: {bot_id, visitor_id, content, session_id?}

    이벤트 타입:
      - meta: { session_id, user_message }
      - chunk: { text }
      - done: { bot_message }
      - error: { message }

    body는 라우터에서 미리 읽어 generator에 넘긴다. StreamingResponse가
    시작된 후 generator 내부에서 receive를 호출하면 uvicorn이 hang하므로.
    """
    body = await p.request.json()
    return StreamingResponse(
        p.chat_service.stream_message(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── 대시보드 (로그인 필수) ─────────────────────
@router.get("/sessions")
@with_provider
@with_login()
async def list_sessions(p: ServiceProvider):
    """query: bot_id (optional)"""
    return await p.chat_service.list_sessions(p.request)


@router.get("/sessions/{session_id}")
@with_provider
@with_login()
async def get_session(p: ServiceProvider):
    return await p.chat_service.get_session_messages(p.request)
