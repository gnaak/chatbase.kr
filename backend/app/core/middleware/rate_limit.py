import ipaddress
import time
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

RATE_LIMITED_PATHS = {"/api/chat/message", "/api/chat/stream"}
MAX_REQUESTS = 20
WINDOW_SECONDS = 60


def _valid_ip(raw: str | None) -> str | None:
    """IP 형식만 통과시킨다.

    헤더는 클라이언트가 보내는 값이라 검증 없이 dict 키로 쓰면 아무 문자열이나
    새 버킷을 만들어 메모리를 불릴 수 있다.
    """
    if not raw:
        return None
    candidate = raw.strip()
    try:
        ipaddress.ip_address(candidate)
    except ValueError:
        return None
    return candidate


def client_ip_of(request: Request) -> str:
    """방문자 실제 IP.

    Cloudflare 프록시 + nginx 뒤에서는 `request.client.host`가 방문자가 아니라
    nginx(127.0.0.1) 또는 Cloudflare 엣지 IP다. 그대로 쓰면 전 세계 방문자가
    한 버킷에 뭉쳐서 서비스 전체가 20req/min으로 묶인다.

    신뢰 전제: 보안 그룹에서 80/443 인바운드를 Cloudflare IP 대역으로 제한해야
    한다. 그렇지 않으면 이 헤더를 위조해 자기 한도를 우회할 수 있다.

    로컬 개발에는 두 헤더가 없으므로 자연히 `request.client.host`로 떨어진다.
    """
    # Cloudflare가 직접 세팅하는 값. 프록시 체인과 무관하게 방문자 IP 하나만 담긴다.
    cf_ip = _valid_ip(request.headers.get("CF-Connecting-IP"))
    if cf_ip:
        return cf_ip

    # "client, proxy1, proxy2" — 맨 왼쪽이 최초 클라이언트.
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        first = _valid_ip(forwarded.split(",")[0])
        if first:
            return first

    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.url.path not in RATE_LIMITED_PATHS:
            return await call_next(request)

        client_ip = client_ip_of(request)
        now = time.time()

        recent = [t for t in self._requests[client_ip] if now - t < WINDOW_SECONDS]

        if len(recent) >= MAX_REQUESTS:
            self._requests[client_ip] = recent
            return JSONResponse(
                status_code=429,
                content={"success": False, "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."},
            )

        recent.append(now)
        self._requests[client_ip] = recent
        self._sweep(now)
        return await call_next(request)

    def _sweep(self, now: float) -> None:
        """창을 벗어난 IP 버킷을 지운다.

        defaultdict에 키를 계속 만들기만 하면 방문자 IP가 쌓이는 만큼 메모리가
        늘어난다(프로세스가 재시작될 때까지 반환되지 않는다).
        """
        stale = [
            ip
            for ip, hits in self._requests.items()
            if not hits or now - hits[-1] >= WINDOW_SECONDS
        ]
        for ip in stale:
            del self._requests[ip]


def setup_rate_limit(app: FastAPI):
    app.add_middleware(RateLimitMiddleware)
