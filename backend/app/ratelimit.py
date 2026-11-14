"""In-memory sliding-window rate limit for LLM-backed requests (per client IP).

Protects the AI quota from spam. Memory is per server instance, so on serverless hosting
the limit is "per warm instance" — good enough for a demo, documented as a limitation.
"""

import math
import threading
import time
from collections import deque

from fastapi import Request

from app.config import settings
from app.errors import AppError

WINDOW_S = 60.0


class RateLimiter:
    """Allow at most `limit` hits per `window_s` seconds for each key."""

    def __init__(self, limit: int, window_s: float = WINDOW_S):
        self.limit = limit
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, now: float | None = None) -> int | None:
        """Record a hit. Returns None if allowed, else the seconds to wait before retrying."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] >= self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(1, math.ceil(self.window_s - (now - hits[0])))
            hits.append(now)
            if len(self._hits) > 10_000:  # forget idle clients so memory stays bounded
                self._hits = {k: v for k, v in self._hits.items() if v and now - v[-1] < self.window_s}
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter(settings.rate_limit_per_minute)


def client_ip(request: Request) -> str:
    """The caller's IP: first `X-Forwarded-For` entry (set by Vercel's proxy), else the socket peer."""
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def enforce_llm_rate_limit(request: Request) -> None:
    """Raise HTTP 429 `rate_limited` when this IP made too many LLM-backed requests this minute."""
    retry_after = limiter.hit(client_ip(request))
    if retry_after is not None:
        raise AppError(
            429, "rate_limited", "Too many requests, please wait a moment",
            headers={"Retry-After": str(retry_after)}, extra={"retry_after": retry_after},
        )
