"""Friendly, leak-free error responses: `{"error", "code", "request_id"}`.

Details (stack traces, provider messages) are logged server-side only, tagged with the
request ID, and never returned to the client.
"""

import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.request_id import HEADER, current_request_id, new_request_id

logger = logging.getLogger(__name__)

INTERNAL_ERROR = "Something went wrong on our side. Please try again."


class AppError(Exception):
    """An expected error with a user-facing message and a stable machine-readable code."""

    def __init__(self, status_code: int, code: str, message: str, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers or {}


def error_response(status_code: int, code: str, message: str, headers: dict[str, str] | None = None) -> JSONResponse:
    """JSON error body in the shape every endpoint shares."""
    body = {"error": message, "code": code, "request_id": current_request_id()}
    return JSONResponse(status_code=status_code, content=body, headers=headers)


def _validation_message(exc: RequestValidationError) -> str:
    """'Invalid age: Input should be less than or equal to 130' (no internals)."""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(part) for part in first.get("loc", ())[1:]) or "request"
    return f"Invalid {field}: {first.get('msg', 'bad value')}"


def install_error_handling(app: FastAPI) -> None:
    """Register the request-ID middleware and every exception handler on `app`."""

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        request_id = new_request_id(request.headers.get(HEADER))
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled error [request_id=%s] %s %s", request_id, request.method, request.url.path)
            response = error_response(500, "internal_error", INTERNAL_ERROR)
        response.headers[HEADER] = request_id
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.status_code, exc.code, exc.message, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, "invalid_input", _validation_message(exc))

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        message = "Not found" if exc.status_code == 404 else str(exc.detail)
        return error_response(exc.status_code, code, message)
