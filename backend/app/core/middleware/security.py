from fastapi import FastAPI

# Starlette BaseHTTPMiddleware는 StreamingResponse + downstream request.json()
# 조합에서 deadlock을 유발한다. ASGI raw 미들웨어로 작성한다.

SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"x-xss-protection", b"1; mode=block"),
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
]

# /embed/* 는 widget.js가 iframe으로 로드하므로 X-Frame-Options를 제외한다.
EMBED_HEADERS = [h for h in SECURITY_HEADERS if h[0] != b"x-frame-options"]


class Security:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        headers_to_add = EMBED_HEADERS if path.startswith("/embed/") else SECURITY_HEADERS

        async def send_with_security(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(headers_to_add)
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_security)


def setup_security(app: FastAPI):
    app.add_middleware(Security)
