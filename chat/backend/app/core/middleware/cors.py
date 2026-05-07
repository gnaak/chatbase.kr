# 역할: CORS 설정을 FastAPI 애플리케이션에 적용하는 모듈
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# 임베드 위젯은 iframe 방식이므로 같은 origin(chatbase.kr)에서 API 호출됨.
# 외부 도메인(example.com 등)에서 직접 fetch는 발생하지 않음.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://chatbase.kr",
    "https://www.chatbase.kr",
]


def setup_cors(app: FastAPI):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
