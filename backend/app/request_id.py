"""Per-request ID: set by middleware, returned as `X-Request-Id`, written to logs and error JSON."""

import re
import uuid
from contextvars import ContextVar

HEADER = "X-Request-Id"
_VALID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_current: ContextVar[str | None] = ContextVar("request_id", default=None)


def new_request_id(incoming: str | None = None) -> str:
    """Reuse a well-formed incoming ID (so a client can trace its own call), else make one."""
    request_id = incoming if incoming and _VALID.match(incoming) else uuid.uuid4().hex[:16]
    _current.set(request_id)
    return request_id


def current_request_id() -> str | None:
    """The ID of the request being handled, or None outside a request."""
    return _current.get()
