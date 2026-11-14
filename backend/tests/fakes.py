"""A scriptable fake LLM provider for tests (no network)."""

import json
from pathlib import Path
from typing import Any

from app.llm.base import LLMError, LLMResult


class FakeProvider:
    """Returns or raises the scripted outcomes in order; records every call."""

    name = "fake"
    model = "fake-model-1"

    def __init__(self, *outcomes: str | LLMError):
        self.outcomes = list(outcomes)
        self.calls: list[tuple[str, Any]] = []

    def _next(self) -> LLMResult:
        outcome = self.outcomes.pop(0) if len(self.outcomes) > 1 else self.outcomes[0]
        if isinstance(outcome, LLMError):
            raise outcome
        return LLMResult(outcome, self.name, self.model, latency_ms=12, input_tokens=100, output_tokens=50)

    def generate(self, system: str, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        self.calls.append(("generate", prompt))
        return self._next()

    def transcribe(self, file_bytes: bytes, mime_type: str) -> LLMResult:
        self.calls.append(("transcribe", mime_type))
        return self._next()


def read_log(path: Path) -> list[dict]:
    """All usage-log records written during a test."""
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines()]
