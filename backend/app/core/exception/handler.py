# core/exception/handler.py
import json

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from app.core.utils.response import BaseResponse
from app.core.logging import get_logger
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = get_logger(__name__)


def setup_exceptions(app: FastAPI) -> None:
    """
    모든 예외 핸들러를 등록하는 함수
    """
    @app.exception_handler(StarletteHTTPException)
    @app.exception_handler(HTTPException)
    async def http_handler(request: Request, exc: HTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "HTTP Error"

        body = BaseResponse(
            success=False,
            message=message,
            data=None,
            errorCode=getattr(exc, "error_code", "HTTP_ERROR"),
        )

        return JSONResponse(
            status_code=exc.status_code,
            content=body.model_dump(),
        )

    @app.exception_handler(UnicodeDecodeError)
    @app.exception_handler(json.JSONDecodeError)
    async def bad_body_handler(request: Request, exc: Exception):
        """본문을 못 읽는 요청은 400이다. 서버 잘못이 아니다.

        `await request.json()` 은 두 가지로 터진다 —
          - UnicodeDecodeError: UTF-8 이 아닌 바이트 (CP949 로 보낸 한글 등)
          - JSONDecodeError:    JSON 문법이 깨진 본문

        둘 다 아래 unhandled_handler 로 떨어져 **500 + 스택트레이스**가 됐다.
        보내는 쪽 잘못인데 error.log 에는 우리 장애처럼 쌓이고, 실제로
        그것 때문에 "채팅이 죽었다"고 오진한 적이 있다.

        스택트레이스 없이 한 줄만 남긴다. 잘못된 요청은 얼마든지 들어올 수 있어
        전부 트레이스를 남기면 진짜 장애가 묻힌다.
        """
        logger.warning(
            "Bad request body: %s (%s %s)",
            type(exc).__name__,
            request.method,
            request.url.path,
        )
        body = BaseResponse(
            success=False,
            message="요청 본문을 읽을 수 없습니다. UTF-8 로 인코딩된 JSON 이어야 합니다.",
            data=None,
            errorCode="INVALID_BODY",
        )
        return JSONResponse(status_code=400, content=body.model_dump())

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        # exc_info=True가 없으면 str(exc)만 남아 원인을 못 찾는다.
        # 예외 메시지가 빈 경우 "Unhandled exception: " 한 줄로 끝난다.
        logger.error(
            f"Unhandled exception: {type(exc).__name__}: {exc} "
            f"({request.method} {request.url.path})",
            exc_info=True,
        )
        body = BaseResponse(
            success=False,
            message="Internal Server Error",
            data=None,
            errorCode="INTERNAL_ERROR",
        )

        return JSONResponse(
            status_code=500,
            content=body.model_dump(),
        )
