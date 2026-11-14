"""Append-only JSONL usage log: one line per LLM call or template fallback.

Records the real provider and model, latency, tokens and outcome. Never prompts, replies,
file contents or patient data. The app only ever appends; it never edits or deletes lines.
"""

import json
import logging
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from app.config import settings
from app.request_id import current_request_id

logger = logging.getLogger(__name__)
_lock = threading.Lock()


@dataclass(frozen=True)
class UsageRecord:
    """One log line."""

    operation: str
    provider: str
    model: str
    ok: bool
    latency_ms: int = 0
    input_tokens: int | None = None
    output_tokens: int | None = None
    error_type: str | None = None
    fallback_used: bool = False
    ts: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))
    request_id: str | None = field(default_factory=current_request_id)


def append(record: UsageRecord) -> None:
    """Append one record. A logging failure is reported but never breaks the request."""
    path = settings.usage_log_path
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with _lock, path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")
    except OSError:
        logger.warning("Could not write usage log at %s", path, exc_info=True)
