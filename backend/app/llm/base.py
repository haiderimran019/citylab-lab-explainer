"""Provider-independent LLM interface. Nothing outside `app/llm/` knows which vendor is used."""

from dataclasses import dataclass
from typing import Any, Literal, Protocol

ErrorKind = Literal[
    "rate_limit", "server", "timeout", "network", "auth", "bad_request", "bad_output", "offline", "unknown"
]

TRANSCRIBE_INSTRUCTION = (
    "Transcribe this lab report exactly as written. Output: Patient Full Name, Recorded Age, "
    "Biological Sex, Medical Record Number, then each test on its own line as `Name: value unit`. "
    "Do not interpret, convert, correct or add anything. Write [UNREADABLE] for any unclear part."
)
"""The one instruction every provider uses to read a photo or scanned PDF."""


@dataclass(frozen=True)
class LLMResult:
    """What a provider returned, plus the facts the usage log needs."""

    text: str
    provider: str
    model: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None


class LLMError(Exception):
    """A provider call failed. `retryable` is True for 429, 5xx, timeouts and network errors.

    The message is for server logs only and is never sent to the client.
    """

    def __init__(self, kind: ErrorKind, message: str, retryable: bool = False):
        super().__init__(message)
        self.kind = kind
        self.retryable = retryable


class LLMProvider(Protocol):
    """Anything that can write text (and optionally read images) for us."""

    name: str
    model: str

    def generate(self, system: str, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        """Generate text. With `json_schema`, the reply must be JSON matching it."""
        ...

    def transcribe(self, file_bytes: bytes, mime_type: str) -> LLMResult:
        """Read a photo or scanned PDF using `TRANSCRIBE_INSTRUCTION`."""
        ...
