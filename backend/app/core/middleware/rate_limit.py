import ipaddress
import time
from collections import defaultdict
from dataclasses import dataclass
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


@dataclass(frozen=True)
class RateLimitRule:
    """경로 묶음 하나에 대한 한도.

    묶음마다 버킷을 따로 쓴다. 예전에는 IP 하나로만 세어서, 자기 봇을 20번
    테스트해본 봇 주인이 **로그인까지 막히는** 상황이 됐다. 성격이 다른
    트래픽은 서로의 한도를 깎으면 안 된다.
    """

    paths: frozenset[str]
    max_requests: int
    window_seconds: int


#: 한도는 "정상 사용자는 절대 안 걸리고, 자동화는 확실히 느려지는" 선으로 잡는다.
RATE_LIMIT_RULES: dict[str, RateLimitRule] = {
    # 방문자가 봇과 나누는 대화. 사람이 1분에 20번 넘게 묻지 않는다.
    "chat": RateLimitRule(
        paths=frozenset({"/api/chat/stream"}),
        max_requests=20,
        window_seconds=60,
    ),
    # 로그인. bcrypt가 느려 무차별 대입은 원래 비현실적이지만,
    # 유출된 이메일·비밀번호 조합을 넣어보는 크리덴셜 스터핑은 시간만 있으면 된다.
    # 비밀번호를 몇 번 틀리는 정상 사용자는 10회에 닿지 않는다.
    "auth_login": RateLimitRule(
        paths=frozenset({"/api/auth/login", "/api/auth/google", "/api/auth/kakao"}),
        max_requests=10,
        window_seconds=60,
    ),
    # 가입. 한 사람이 1분에 다섯 번 넘게 가입할 이유가 없다.
    "auth_signup": RateLimitRule(
        paths=frozenset({"/api/auth/signup"}),
        max_requests=5,
        window_seconds=60,
    ),
}

#: 경로 → 묶음 이름. 요청마다 순회하지 않도록 로드 시점에 뒤집어 둔다.
_GROUP_OF_PATH: dict[str, str] = {
    path: name for name, rule in RATE_LIMIT_RULES.items() for path in rule.paths
}

#: 버킷 청소 기준. 창이 가장 긴 규칙을 넘겨야 아직 유효한 기록을 지우지 않는다.
_SWEEP_AFTER = max(rule.window_seconds for rule in RATE_LIMIT_RULES.values())


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
    """묶음별 · IP별 슬라이딩 윈도우.

    ⚠️ 프로세스 안의 메모리라 워커가 여러 개면 한도가 워커 수만큼 곱해진다.
    정확한 한도가 필요해지면 Redis 같은 공용 저장소로 옮겨야 한다. 지금은
    자동화를 느리게 만드는 것이 목적이라 이 정도로 충분하다.
    """

    def __init__(self, app):
        super().__init__(app)
        #: 키는 "묶음:IP". 묶음을 섞으면 서로의 한도를 깎는다.
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        group = _GROUP_OF_PATH.get(request.url.path)
        if group is None:
            return await call_next(request)

        rule = RATE_LIMIT_RULES[group]
        key = f"{group}:{client_ip_of(request)}"
        now = time.time()

        recent = [t for t in self._requests[key] if now - t < rule.window_seconds]

        if len(recent) >= rule.max_requests:
            self._requests[key] = recent
            return JSONResponse(
                status_code=429,
                content={"success": False, "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."},
            )

        recent.append(now)
        self._requests[key] = recent
        self._sweep(now)
        return await call_next(request)

    def _sweep(self, now: float) -> None:
        """창을 벗어난 버킷을 지운다.

        defaultdict에 키를 계속 만들기만 하면 방문자 IP가 쌓이는 만큼 메모리가
        늘어난다(프로세스가 재시작될 때까지 반환되지 않는다).
        """
        stale = [
            key
            for key, hits in self._requests.items()
            if not hits or now - hits[-1] >= _SWEEP_AFTER
        ]
        for key in stale:
            del self._requests[key]


def setup_rate_limit(app: FastAPI):
    app.add_middleware(RateLimitMiddleware)
