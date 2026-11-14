"""Append-only JSONL usage log: one line per LLM call or template fallback.

Records the real provider and model, latency, tokens, outcome, environment and release.
Never prompts, replies, file contents or patient data. The app only ever appends; it never
edits or deletes lines.

Where records go:
* the JSONL file (`USAGE_LOG_PATH`) — local runs keep it permanently;
* stdout as `LLM_USAGE {...}` when `USAGE_LOG_STDOUT` is on (default on Vercel), because
  Vercel's `/tmp` is wiped when an instance is recycled but its function logs are kept.
"""

import json
import logging
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.request_id import current_request_id

logger = logging.getLogger(__name__)
_lock = threading.Lock()
STDOUT_PREFIX = "LLM_USAGE"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


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
    ts: str = field(default_factory=_utc_now)
    request_id: str | None = field(default_factory=current_request_id)
    environment: str = field(default_factory=lambda: settings.app_env)
    release: str | None = field(default_factory=lambda: settings.release)


def append(record: UsageRecord) -> None:
    """Append one record to the file (and stdout when enabled). Never breaks the request."""
    line = json.dumps(asdict(record), ensure_ascii=False)
    if settings.usage_log_stdout:
        print(f"{STDOUT_PREFIX} {line}", flush=True)
    path = settings.usage_log_path
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with _lock, path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        logger.warning("Could not write usage log at %s", path, exc_info=True)


def read_records(path: Path | None = None) -> list[dict]:
    """Every record in the log (malformed lines are skipped). Missing file → []."""
    path = path or settings.usage_log_path
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    records = []
    for line in lines:
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return records


@dataclass(frozen=True)
class UsageSummary:
    """Aggregates for /api/health and the README's cost-and-speed section."""

    llm_calls: int
    ok_calls: int
    fallbacks: int
    avg_latency_ms: int | None
    input_tokens: int
    output_tokens: int

    @property
    def fallback_rate(self) -> float:
        """Share of user-facing AI operations that were answered by templates."""
        served = self.ok_calls + self.fallbacks
        return self.fallbacks / served if served else 0.0


def summarize(records: list[dict], day: str | None = None) -> UsageSummary:
    """Summarise records, optionally only those whose UTC timestamp starts with `day` (YYYY-MM-DD).

    A "call" is a real provider attempt; template fallbacks are counted separately.
    """
    chosen = [r for r in records if day is None or str(r.get("ts", "")).startswith(day)]
    calls = [r for r in chosen if not r.get("fallback_used")]
    ok = [r for r in calls if r.get("ok")]
    latencies = [r.get("latency_ms") or 0 for r in ok]
    return UsageSummary(
        llm_calls=len(calls),
        ok_calls=len(ok),
        fallbacks=sum(1 for r in chosen if r.get("fallback_used")),
        avg_latency_ms=round(sum(latencies) / len(latencies)) if latencies else None,
        input_tokens=sum(r.get("input_tokens") or 0 for r in ok),
        output_tokens=sum(r.get("output_tokens") or 0 for r in ok),
    )


def today() -> str:
    """Today's date in UTC, as used in record timestamps."""
    return datetime.now(timezone.utc).date().isoformat()
