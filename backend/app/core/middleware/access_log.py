"""요청 한 건을 한 줄로 남기는 액세스 로그.

uvicorn.access를 쓰지 않고 직접 찍는 이유:

1. **소요 시간을 안 준다.** uvicorn.access 포맷에는 처리 시간 항목이 없다.
2. **request_id가 비어 있다.** contextvar는 앱이 실행되는 컨텍스트에서 세팅되는데
   uvicorn.access는 프로토콜 계층에서 로깅하므로 `[req:-]`로 찍힌다.
3. 쿼리스트링이 빠진다.

출력 예:
    [2026-08-27 11:25:07,054] [INFO] [req:0174be17-...] [http.access] GET /api/bot/ -> 200 (5.6ms) [127.0.0.1]

앞의 `[시각] [레벨] [req:...] [로거]` 부분은 core/logging/config.py의 LOG_FORMAT이 붙인다.
"""

import logging
import time

from fastapi import FastAPI
from starlette.requests import Request

# IP 판별 규칙(Cloudflare/XFF 신뢰 전제)은 rate_limit에 이미 문서화돼 있다.
# 같은 규칙을 두 군데서 관리하면 한쪽만 고쳐져서 어긋난다.
from app.core.middleware.rate_limit import client_ip_of

logger = logging.getLogger("http.access")


def _full_path(scope) -> str:
    """경로 + 쿼리스트링. `?projectId=1` 같은 조건이 로그에 남아야 재현이 된다."""
    path = scope.get("path", "-")
    raw_query = scope.get("query_string", b"")
    if not raw_query:
        return path
    return f"{path}?{raw_query.decode('latin-1', 'replace')}"


class AccessLogMiddleware:
    """순수 ASGI 미들웨어.

    BaseHTTPMiddleware를 쓰지 않는다 — 스트리밍 응답(`/api/chat/stream`)을
    한 번 버퍼링해서 SSE가 실시간으로 흐르지 않게 만들기 때문이다.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # 응답이 시작되기 전에 예외가 터지면 상단에서 500으로 변환되므로 500으로 남긴다.
        status = 500
        started = time.perf_counter()

        async def send_wrapper(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            # 예외로 빠져나가도 한 줄은 남긴다. 실패한 요청이 로그에서 사라지면
            # "요청이 왔는지" 자체를 알 수 없다.
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info(
                "%s %s -> %s (%.1fms) [%s]",
                scope.get("method", "-"),
                _full_path(scope),
                status,
                elapsed_ms,
                client_ip_of(Request(scope)),
                # status는 access.log / error.log 분기(config.py의 필터)에서 쓴다.
                extra={"status_code": status},
            )


def setup_access_log(app: FastAPI):
    app.add_middleware(AccessLogMiddleware)
