# 역할: FastAPI 앱에 모든 공통 미들웨어(CORS, 보안 등)를 일괄 등록

from fastapi import FastAPI

from .cors import setup_cors
from .security import setup_security
from .request_id import setup_request_id
from .rate_limit import setup_rate_limit
from .access_log import setup_access_log


def setup_middlewares(app: FastAPI):
    """공통 미들웨어 등록.

    ⚠️ `add_middleware`는 나중에 등록한 것이 **바깥**에 온다.
    즉 아래 호출 순서의 역순이 실제 실행 순서다:

        request_id → access_log → rate_limit → security → cors → 라우터

    request_id를 가장 바깥에 두는 이유: 모든 응답이 x-request-id를 달고,
    액세스 로그가 빈 `[req:-]` 없이 찍힌다.
    access_log를 rate_limit보다 바깥에 두는 이유: 429로 거절된 요청도 로그에 남는다.
    """
    setup_cors(app)
    setup_security(app)
    setup_rate_limit(app)
    setup_access_log(app)
    setup_request_id(app)
