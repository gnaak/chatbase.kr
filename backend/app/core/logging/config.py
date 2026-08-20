import logging
import logging.handlers
from pathlib import Path

from app.core.logging.context import get_request_id

LOG_FORMAT = "[%(asctime)s] [%(levelname)s] [req:%(request_id)s] [%(name)s] %(message)s"

# backend/logs/ 디렉토리. settings.BASE_DIR 따라감.
LOG_DIR = Path(__file__).resolve().parent.parent.parent.parent / "logs"

MAX_BYTES = 10 * 1024 * 1024  # 10MB
BACKUP_COUNT = 5


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def _access_status(record: logging.LogRecord) -> int | None:
    """uvicorn.access record에서 응답 status 추출. 없으면 None."""
    if record.name != "uvicorn.access":
        return None
    args = record.args
    if not args:
        return None
    try:
        # uvicorn.access args 마지막이 status code
        return int(args[-1] if not isinstance(args, dict) else args.get("status_code", 0))
    except (ValueError, TypeError):
        return None


class AccessOkFilter(logging.Filter):
    """uvicorn.access 중 status < 400만 통과."""
    def filter(self, record: logging.LogRecord) -> bool:
        status = _access_status(record)
        return status is not None and 200 <= status < 400


class ErrorFilter(logging.Filter):
    """uvicorn.access status >= 400 또는 일반 ERROR 이상."""
    def filter(self, record: logging.LogRecord) -> bool:
        status = _access_status(record)
        if status is not None:
            return status >= 400
        return record.levelno >= logging.ERROR


def _make_file_handler(filename: str) -> logging.Handler:
    LOG_DIR.mkdir(exist_ok=True)
    handler = logging.handlers.RotatingFileHandler(
        LOG_DIR / filename,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(RequestIdFilter())
    return handler


def setup_logging() -> None:
    formatter = logging.Formatter(LOG_FORMAT)

    # 콘솔
    stream = logging.StreamHandler()
    stream.setFormatter(formatter)
    stream.addFilter(RequestIdFilter())

    # app.log — 모든 로그
    app_handler = _make_file_handler("app.log")

    # access.log — 2xx/3xx만
    access_handler = _make_file_handler("access.log")
    access_handler.addFilter(AccessOkFilter())

    # error.log — 4xx/5xx + ERROR 이상
    error_handler = _make_file_handler("error.log")
    error_handler.addFilter(ErrorFilter())

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()
    root.addHandler(stream)
    root.addHandler(app_handler)
    root.addHandler(access_handler)
    root.addHandler(error_handler)

    # uvicorn 로거는 root로 propagate
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True

    # provider 별도 파일 (app.log에도 동시 기록 — propagate=True)
    for provider in ("openai", "anthropic", "gemini"):
        lg = logging.getLogger(f"app.infra.{provider}")
        lg.handlers.clear()
        lg.setLevel(logging.INFO)
        lg.propagate = True
        lg.addHandler(_make_file_handler(f"{provider}.log"))
