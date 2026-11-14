"""Print cost-and-speed numbers from the LLM usage log (for the README).

Usage:
    python backend/scripts/usage_stats.py                 # configured log (backend/logs/llm_usage.jsonl)
    python backend/scripts/usage_stats.py path/to/log.jsonl
"""

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.llm.usage_log import read_records, summarize  # noqa: E402


def main(argv: list[str]) -> int:
    """Read the log, print a summary, return a process exit code."""
    path = Path(argv[1]) if len(argv) > 1 else settings.usage_log_path
    records = read_records(path)
    if not records:
        print(f"No usage records found at {path}")
        return 0
    stats = summarize(records)
    operations = Counter(str(r.get("operation", "?")) for r in records if not r.get("fallback_used"))
    errors = Counter(str(r.get("error_type")) for r in records if not r.get("ok"))
    models = Counter(f"{r.get('provider')}/{r.get('model')}" for r in records if r.get("ok") and not r.get("fallback_used"))

    print(f"Usage log:            {path}")
    print(f"Period:               {records[0].get('ts')} → {records[-1].get('ts')}")
    print(f"Total LLM calls:      {stats.llm_calls} ({stats.ok_calls} ok)")
    print(f"Average latency:      {stats.avg_latency_ms if stats.avg_latency_ms is not None else '–'} ms")
    print(f"Tokens in / out:      {stats.input_tokens} / {stats.output_tokens}")
    print(f"Template fallbacks:   {stats.fallbacks} ({stats.fallback_rate:.0%} of answers)")
    print(f"Calls by operation:   {dict(operations)}")
    print(f"Models that answered: {dict(models)}")
    if errors:
        print(f"Errors by type:       {dict(errors)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
