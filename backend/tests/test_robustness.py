"""Part 4: rate limit, health stats from the usage log, usage_stats script."""

import json
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import settings
from app.llm.usage_log import UsageRecord, append, summarize
from app.main import app
from app.ratelimit import RateLimiter, limiter
from tests.fakes import FakeProvider

client = TestClient(app)
SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "usage_stats.py"


def test_rate_limit_returns_friendly_429(monkeypatch) -> None:
    monkeypatch.setattr(limiter, "limit", 3)
    for _ in range(3):
        assert client.post("/api/chat", json={"patient_id": "P014", "message": "hi"}).status_code == 200
    response = client.post("/api/chat", json={"patient_id": "P014", "message": "hi"})
    body = response.json()
    assert response.status_code == 429
    assert (body["error"], body["code"]) == ("Too many requests, please wait a moment", "rate_limited")
    assert body["retry_after"] >= 1 and response.headers["Retry-After"] == str(body["retry_after"])


def test_rate_limit_ignores_statuses_only_requests(monkeypatch) -> None:
    monkeypatch.setattr(limiter, "limit", 1)
    for _ in range(5):
        assert client.get("/api/patients/P001/analysis", params={"explain": "false"}).status_code == 200


def test_rate_limit_is_per_ip_and_window_slides() -> None:
    rl = RateLimiter(limit=2, window_s=60)
    assert rl.hit("a", now=0) is None and rl.hit("a", now=1) is None
    assert rl.hit("a", now=2) == 58
    assert rl.hit("b", now=2) is None
    assert rl.hit("a", now=61) is None


def test_health_reports_stats_from_usage_log(use_provider) -> None:
    use_provider(FakeProvider("Your sugar is fine. Ask your doctor."))
    client.post("/api/chat", json={"patient_id": "P014", "message": "sugar?"})
    append(UsageRecord("explain", "template", "none", ok=True, error_type="offline", fallback_used=True))
    body = client.get("/api/health").json()
    assert (body["llm_calls_today"], body["fallbacks_today"], body["avg_latency_ms"]) == (1, 1, 12)
    assert body["cache_size"] == 0
    assert "key" not in json.dumps(body).lower()


def test_summarize_counts_and_rates() -> None:
    records = [
        {"ts": "2026-11-14T10:00:00", "ok": True, "latency_ms": 100, "input_tokens": 10, "output_tokens": 5},
        {"ts": "2026-11-14T10:01:00", "ok": False, "error_type": "rate_limit"},
        {"ts": "2026-11-14T10:02:00", "ok": True, "fallback_used": True},
        {"ts": "2026-11-13T09:00:00", "ok": True, "latency_ms": 300},
    ]
    today = summarize(records, day="2026-11-14")
    assert (today.llm_calls, today.ok_calls, today.fallbacks, today.avg_latency_ms) == (2, 1, 1, 100)
    assert (today.input_tokens, today.output_tokens, today.fallback_rate) == (10, 5, 0.5)
    assert summarize(records).avg_latency_ms == 200


def test_usage_stats_script(tmp_path: Path) -> None:
    log = tmp_path / "log.jsonl"
    log.write_text(json.dumps({"ts": "2026-11-14T10:00:00", "operation": "explain", "ok": True, "latency_ms": 900,
                               "input_tokens": 400, "output_tokens": 200}) + "\n")
    output = subprocess.run([sys.executable, str(SCRIPT), str(log)], capture_output=True, text=True, check=True).stdout
    assert "Total LLM calls" in output and "900 ms" in output and "400" in output


def test_usage_log_location_is_configurable() -> None:
    assert settings.usage_log_path.name == "llm_usage.jsonl"
