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

def _warm_llm_imports() -> None:
    """LLM SDK 임포트를 기동 시점으로 당긴다.

    ## 왜

    `ServiceProvider`는 서비스를 지연 로드한다(`core/provider/http/service.py`).
    좋은 설계지만, 그 결과 **OpenAI · Anthropic · google-genai SDK 임포트 비용을
    첫 요청이 뒤집어쓴다.** 실측:

        app.module.bot.bot_service          2404 ms
          └ app.module.infra.llm.llm_service  2145 ms
              └ openai                         738 ms   (openai.types.beta 만 146ms)

    게다가 **파이썬 임포트 락이 이 구간을 직렬화한다.** 로그인 직후 대시보드가
    네 요청을 동시에 쏘면 뒤엣것들이 앞의 임포트를 기다린다 — 실제로 그랬다:

        GET /api/user/me   2897.0ms  ┐ 둘이 726ms 차이로 시작했는데
        GET /api/bot/      2191.7ms  ┘ 같은 순간에 같이 끝났다
        GET /api/api-key/    33.1ms  ← 임포트가 끝난 뒤라 정상 속도
        GET /api/usage/      50.6ms

    DB가 아니다. 같은 시점 실측으로 커넥션 생성 30ms, PK 조회 0.9ms였다.

    ## 그래서

    프로세스당 한 번 무는 비용이라 요청 경로에 두면 **배포 직후 첫 손님**이
    3초를 기다린다. 위젯 대화라면 그 사람은 남의 사이트 방문자다.
    기동은 얼마가 걸리든 상관없으므로 여기로 옮긴다.

    ⚠️ 지연 로드 자체는 그대로 둔다. 여기서 미리 임포트해두면 `ServiceProvider`가
    나중에 하는 `from ... import ...`가 `sys.modules` 캐시에 맞아 공짜가 된다.
    """
    import app.module.infra.llm.llm_service  # noqa: F401
    import app.module.infra.openai.vector_store_service  # noqa: F401


# 1. Lifespan 설정: 서버 시작과 종료 시 실행될 로직
@asynccontextmanager
async def lifespan(app: FastAPI):
    _warm_llm_imports()
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
