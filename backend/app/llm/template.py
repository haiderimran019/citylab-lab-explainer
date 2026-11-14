"""Offline "provider": used when no API key is set or `LLM_PROVIDER=template`.

It never calls anything. Callers catch its `offline` error and use their template text,
so statuses and the rest of the app keep working without AI.
"""

from typing import Any

from app.llm.base import LLMError, LLMResult


class TemplateProvider:
    """No-AI provider. Every call raises a non-retryable `offline` LLMError."""

    name = "template"
    model = "none"

    def generate(self, system: str, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        """Always offline; the caller falls back to template text."""
        raise LLMError("offline", "AI text generation is switched off (template mode)")

    def transcribe(self, file_bytes: bytes, mime_type: str) -> LLMResult:
        """Image reading needs an AI model, so it is unavailable offline."""
        raise LLMError("offline", "Image reading unavailable offline")
