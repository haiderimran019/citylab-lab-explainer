"""Tests for the provider-independent LLM layer (step 6)."""

import httpx
import pytest
from pydantic import SecretStr
from google.genai import errors

from app.config import settings
from app.llm import factory
from app.llm.base import LLMError
from app.llm.factory import call_with_retry, clamped_timeout, get_provider, log_fallback
from app.llm.gemini import GeminiProvider, to_llm_error
from app.llm.template import TemplateProvider
from tests.fakes import FakeProvider, read_log

RATE_LIMIT = LLMError("rate_limit", "HTTP 429", retryable=True)


def _generate(provider):
    return provider.generate("system", "PATIENT Diana Prince hemoglobin 6.5")


def test_no_key_means_offline_template_provider() -> None:
    provider = get_provider()
    assert (provider.name, provider.model) == ("template", "none")


def test_key_selects_gemini_with_configured_model(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", SecretStr("test-key"))
    monkeypatch.setattr(settings, "llm_model", "some-model-from-env")
    provider = get_provider()
    assert isinstance(provider, GeminiProvider)
    assert provider.model == "some-model-from-env"


def test_success_is_logged_with_real_provider_and_model() -> None:
    result = call_with_retry("explain", _generate, FakeProvider("hello"))
    assert result.text == "hello"
    (record,) = read_log(settings.usage_log_path)
    assert (record["provider"], record["model"], record["ok"], record["operation"]) == ("fake", "fake-model-1", True, "explain")
    assert (record["input_tokens"], record["output_tokens"], record["latency_ms"]) == (100, 50, 12)


def test_retries_rate_limit_then_succeeds(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(factory, "_sleep", sleeps.append)
    provider = FakeProvider(RATE_LIMIT, RATE_LIMIT, "ok")
    assert call_with_retry("explain", _generate, provider).text == "ok"
    assert len(provider.calls) == 3
    assert [round(s) for s in sleeps] == [1, 2]
    assert [(r["ok"], r["error_type"]) for r in read_log(settings.usage_log_path)] == [
        (False, "rate_limit"), (False, "rate_limit"), (True, None),
    ]


def test_gives_up_after_max_retries() -> None:
    provider = FakeProvider(RATE_LIMIT)
    with pytest.raises(LLMError):
        call_with_retry("explain", _generate, provider)
    assert len(provider.calls) == settings.llm_max_retries + 1


def test_non_retryable_error_is_not_retried() -> None:
    provider = FakeProvider(LLMError("auth", "HTTP 401"))
    with pytest.raises(LLMError):
        call_with_retry("explain", _generate, provider)
    assert len(provider.calls) == 1


def test_retry_budget_stops_early(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_retry_budget_s", 0.5)
    provider = FakeProvider(RATE_LIMIT)
    with pytest.raises(LLMError):
        call_with_retry("explain", _generate, provider)
    assert len(provider.calls) == 1


def test_template_provider_raises_offline_and_logs_nothing() -> None:
    with pytest.raises(LLMError) as caught:
        call_with_retry("explain", _generate, TemplateProvider())
    assert caught.value.kind == "offline"
    assert read_log(settings.usage_log_path) == []


def test_template_transcribe_is_clearly_unavailable() -> None:
    with pytest.raises(LLMError, match="unavailable offline"):
        TemplateProvider().transcribe(b"x", "image/png")


def test_fallback_is_logged_truthfully() -> None:
    log_fallback("explain", "rate_limit")
    (record,) = read_log(settings.usage_log_path)
    assert (record["provider"], record["model"], record["fallback_used"], record["error_type"]) == (
        "template", "none", True, "rate_limit",
    )


def test_log_never_contains_prompt_or_patient_data() -> None:
    call_with_retry("explain", _generate, FakeProvider("Diana's reply text"))
    raw = settings.usage_log_path.read_text()
    assert "Diana" not in raw and "6.5" not in raw and "reply" not in raw


def test_log_is_append_only() -> None:
    call_with_retry("explain", _generate, FakeProvider("a"))
    call_with_retry("chat", _generate, FakeProvider("b"))
    assert [r["operation"] for r in read_log(settings.usage_log_path)] == ["explain", "chat"]


@pytest.mark.parametrize(
    "exc, kind, retryable",
    [
        (errors.ClientError(429, {}), "rate_limit", True),
        (errors.ServerError(503, {}), "server", True),
        (errors.ClientError(401, {}), "auth", False),
        (errors.ClientError(404, {}), "bad_request", False),
        (httpx.ReadTimeout("slow"), "timeout", True),
        (httpx.ConnectError("down"), "network", True),
        (ValueError("weird"), "unknown", False),
    ],
)
def test_gemini_error_mapping(exc, kind, retryable) -> None:
    error = to_llm_error(exc)
    assert (error.kind, error.retryable) == (kind, retryable)


@pytest.mark.parametrize("configured, expected", [(20, 20), (0.1, 2.0), (500, 60.0)])
def test_timeout_is_clamped(monkeypatch, configured, expected) -> None:
    monkeypatch.setattr(settings, "llm_timeout_s", configured)
    assert clamped_timeout() == expected
