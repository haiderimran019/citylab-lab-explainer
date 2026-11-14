"""Pick the configured provider and call it with retry/backoff and truthful usage logging."""

import logging
import random
import time
from collections.abc import Callable
from functools import lru_cache

from app.config import settings
from app.llm import usage_log
from app.llm.base import LLMError, LLMProvider, LLMResult
from app.llm.template import TemplateProvider
from app.llm.usage_log import UsageRecord

logger = logging.getLogger(__name__)

MIN_TIMEOUT_S, MAX_TIMEOUT_S = 2.0, 60.0
_sleep = time.sleep  # replaced in tests


def clamped_timeout() -> float:
    """`settings.llm_timeout_s`, kept within a sane 2–60 s window."""
    return min(max(settings.llm_timeout_s, MIN_TIMEOUT_S), MAX_TIMEOUT_S)


@lru_cache(maxsize=1)
def get_provider() -> LLMProvider:
    """The provider named by `LLM_PROVIDER`, or the offline template when no key is set."""
    if settings.llm_provider == "gemini" and settings.llm_api_key:
        from app.llm.gemini import GeminiProvider  # imported lazily: only needed with a key

        return GeminiProvider(settings.llm_api_key, settings.llm_model, clamped_timeout())
    if settings.llm_provider != "template":
        logger.warning("LLM provider %r unavailable (missing key or unknown); using templates", settings.llm_provider)
    return TemplateProvider()


def _backoff(attempt: int) -> float:
    """1 s, 2 s, 4 s … plus up to 0.5 s of jitter."""
    return 2**attempt + random.uniform(0, 0.5)


def call_with_retry(
    operation: str, call: Callable[[LLMProvider], LLMResult], provider: LLMProvider | None = None
) -> LLMResult:
    """Run `call(provider)`, retrying 429/5xx/timeouts with exponential backoff.

    Every real attempt is written to the usage log. Stops after `LLM_MAX_RETRIES` retries or
    when the retry budget would be exceeded, then re-raises the last `LLMError` so the
    caller can fall back (see `log_fallback`).
    """
    provider = provider or get_provider()
    if isinstance(provider, TemplateProvider):
        return call(provider)  # raises "offline" at once; nothing was called, so nothing to log

    started = time.monotonic()
    attempt = 0
    while True:
        try:
            result = call(provider)
        except LLMError as error:
            usage_log.append(UsageRecord(operation, provider.name, provider.model, ok=False, error_type=error.kind))
            delay = _backoff(attempt)
            out_of_budget = time.monotonic() - started + delay > settings.llm_retry_budget_s
            if not error.retryable or attempt >= settings.llm_max_retries or out_of_budget:
                raise
            logger.info("LLM %s failed (%s); retrying in %.1fs", operation, error.kind, delay)
            _sleep(delay)
            attempt += 1
            continue
        usage_log.append(
            UsageRecord(
                operation, result.provider, result.model, ok=True, latency_ms=result.latency_ms,
                input_tokens=result.input_tokens, output_tokens=result.output_tokens,
            )
        )
        return result


def log_fallback(operation: str, reason: str) -> None:
    """Record that template text was served instead of AI text (counts toward the fallback rate)."""
    usage_log.append(
        UsageRecord(operation, TemplateProvider.name, TemplateProvider.model, ok=True, error_type=reason, fallback_used=True)
    )
