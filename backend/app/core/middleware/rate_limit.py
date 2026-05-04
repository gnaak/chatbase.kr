import time
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

RATE_LIMITED_PATHS = {"/api/chat/message", "/api/chat/stream"}
MAX_REQUESTS = 20
WINDOW_SECONDS = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.url.path not in RATE_LIMITED_PATHS:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if now - t < WINDOW_SECONDS
        ]

        if len(self._requests[client_ip]) >= MAX_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={"success": False, "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."},
            )

        self._requests[client_ip].append(now)
        return await call_next(request)


def setup_rate_limit(app: FastAPI):
    app.add_middleware(RateLimitMiddleware)
