# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config.settings import settings
from app.core.middleware.register import setup_middlewares
from app.core.exception.handler import setup_exceptions
from app.core.logging import setup_logging, get_logger
from app.module import *

# 로깅 설정
setup_logging()
logger = get_logger(__name__)

# 1. Lifespan 설정: 서버 시작과 종료 시 실행될 로직
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Chatbase backend started.")

    yield
    print("Chatbase backend stopping.")
    # 예: await ws_manager.close_all()


def create_app() -> FastAPI:
    # 운영에서는 자동 문서를 닫는다.
    #
    # 기본값으로 두면 /docs · /redoc · /openapi.json 이 인증 없이 열려서
    # 어드민·결제를 포함한 전 엔드포인트와 요청 스키마가 그대로 공개된다.
    # 지금은 nginx가 /api/* 만 넘겨서 밖에서 안 보일 수 있지만,
    # 프록시 설정 한 줄에 기댈 문제가 아니라 앱에서 닫는다.
    #
    # 로컬은 그대로 열어둔다 — 개발 중에 쓸 일이 많다.
    is_local = settings.env == "local"
    app = FastAPI(
        lifespan=lifespan,
        docs_url="/docs" if is_local else None,
        redoc_url="/redoc" if is_local else None,
        openapi_url="/openapi.json" if is_local else None,
    )
    
    # 1. 예외 핸들러 등록 (가장 먼저 혹은 미들웨어 직후에 등록 권장)
    setup_exceptions(app)
    
    # 2. CORS 및 보안 헤더 미들웨어 등록
    setup_middlewares(app)
    
    # 3. 라우터 등록
    setup_routers(app)
    
    return app


# FastAPI 실행 인스턴스
app = create_app()
app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")
