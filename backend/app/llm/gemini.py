"""Google Gemini provider — the only module that imports the Google SDK."""

import time
from typing import Any

import httpx
from google import genai
from google.genai import errors, types

from app.llm.base import TRANSCRIBE_INSTRUCTION, LLMError, LLMResult


def to_llm_error(exc: Exception) -> LLMError:
    """Translate SDK/network exceptions into our provider-independent error."""
    if isinstance(exc, errors.APIError):
        code = exc.code or 0
        if code == 429:
            return LLMError("rate_limit", "HTTP 429", retryable=True)
        if code >= 500:
            return LLMError("server", f"HTTP {code}", retryable=True)
        if code in (401, 403):
            return LLMError("auth", f"HTTP {code}")
        return LLMError("bad_request", f"HTTP {code}")
    if isinstance(exc, httpx.TimeoutException):
        return LLMError("timeout", "request timed out", retryable=True)
    if isinstance(exc, httpx.TransportError):
        return LLMError("network", type(exc).__name__, retryable=True)
    return LLMError("unknown", type(exc).__name__)


class GeminiProvider:
    """Gemini via `google-genai`. One shared HTTP client; the SDK's own retries are off (we retry)."""

    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout_s: float):
        self.model = model
        self._http = httpx.Client(timeout=timeout_s)
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=int(timeout_s * 1000),
                retry_options=types.HttpRetryOptions(attempts=1),
                httpx_client=self._http,
            ),
        )

    def _call(self, contents: Any, config: types.GenerateContentConfig) -> LLMResult:
        """Run one request and package the reply with latency, tokens and the real model version."""
        started = time.perf_counter()
        try:
            response = self._client.models.generate_content(model=self.model, contents=contents, config=config)
        except Exception as exc:  # noqa: BLE001 — every SDK failure becomes an LLMError
            raise to_llm_error(exc) from exc
        text = (response.text or "").strip()
        if not text:
            raise LLMError("bad_output", "empty response")
        usage = response.usage_metadata
        return LLMResult(
            text=text,
            provider=self.name,
            model=response.model_version or self.model,
            latency_ms=round((time.perf_counter() - started) * 1000),
            input_tokens=usage.prompt_token_count if usage else None,
            output_tokens=usage.candidates_token_count if usage else None,
        )

    def generate(self, system: str, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        """Generate text (JSON when a schema is given) at a low temperature for consistency."""
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            response_mime_type="application/json" if json_schema else None,
            response_json_schema=json_schema,
        )
        return self._call(prompt, config)

    def transcribe(self, file_bytes: bytes, mime_type: str) -> LLMResult:
        """Read an image or scanned PDF exactly as written."""
        contents = [types.Part.from_bytes(data=file_bytes, mime_type=mime_type), TRANSCRIBE_INSTRUCTION]
        return self._call(contents, types.GenerateContentConfig(temperature=0))
