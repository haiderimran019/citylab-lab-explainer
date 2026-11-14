"""Credentials stay hidden, provider names are forgiving, and usage records are complete and durable."""

import json
import logging

import pytest
from pydantic import SecretStr

from app.config import Settings, settings
from app.llm import factory
from app.llm.factory import call_with_retry, get_provider, log_fallback
from app.llm.usage_log import STDOUT_PREFIX
from tests.fakes import FakeProvider, read_log

SECRET = "AQ.FAKE-SECRET-FOR-TEST-123"


# --------------------------------------------------------------------------- #3 credentials


def test_api_key_never_printed(monkeypatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", SECRET)
    loaded = Settings(_env_file=None)
    assert SECRET not in repr(loaded) and SECRET not in str(loaded.model_dump())
    assert loaded.api_key() == SECRET


def test_blank_key_means_offline(monkeypatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "   ")
    assert Settings(_env_file=None).api_key() is None


def test_key_is_never_in_usage_log_or_health(monkeypatch, use_provider) -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setattr(settings, "llm_api_key", SecretStr(SECRET))
    use_provider(FakeProvider("Your sugar is fine. Ask your doctor."))
    client = TestClient(app)
    client.post("/api/chat", json={"patient_id": "P014", "message": "sugar?"})
    assert SECRET not in settings.usage_log_path.read_text()
    assert SECRET not in client.get("/api/health").text


# --------------------------------------------------------------------------- #5 provider names


@pytest.mark.parametrize("raw", ["Gemini", " GEMINI ", "gemini"])
def test_provider_name_is_case_insensitive(monkeypatch, raw) -> None:
    monkeypatch.setenv("LLM_PROVIDER", raw)
    assert Settings(_env_file=None).llm_provider == "gemini"


def test_unknown_provider_warns_clearly(monkeypatch, caplog) -> None:
    monkeypatch.setattr(settings, "llm_provider", "openai")
    factory.get_provider.cache_clear()
    with caplog.at_level(logging.WARNING):
        assert get_provider().name == "template"
    assert "Unknown LLM_PROVIDER 'openai'" in caplog.text and "gemini, template" in caplog.text


def test_missing_key_warns_clearly(caplog) -> None:
    with caplog.at_level(logging.WARNING):
        get_provider()
    assert "LLM_API_KEY is not set" in caplog.text


def test_template_mode_is_silent(monkeypatch, caplog) -> None:
    monkeypatch.setattr(settings, "llm_provider", "template")
    with caplog.at_level(logging.WARNING):
        assert get_provider().name == "template"
    assert caplog.text == ""


# --------------------------------------------------------------------------- #1 audit records


def test_record_has_provider_model_timestamp_environment_release(monkeypatch) -> None:
    monkeypatch.setattr(settings, "release", "abc1234")
    call_with_retry("explain", lambda p: p.generate("s", "p"), FakeProvider("ok"))
    (record,) = read_log(settings.usage_log_path)
    assert (record["provider"], record["model"], record["environment"], record["release"]) == (
        "fake", "fake-model-1", "test", "abc1234",
    )
    assert record["ts"].endswith("+00:00") and "." in record["ts"]  # UTC with milliseconds


def test_records_go_to_stdout_when_enabled(monkeypatch, capsys) -> None:
    monkeypatch.setattr(settings, "usage_log_stdout", True)
    log_fallback("chat", "offline")
    line = capsys.readouterr().out.strip()
    assert line.startswith(f"{STDOUT_PREFIX} ")
    record = json.loads(line.removeprefix(f"{STDOUT_PREFIX} "))
    assert (record["provider"], record["fallback_used"]) == ("template", True)
    assert read_log(settings.usage_log_path) == [record]  # file and stdout carry the same record


def test_stdout_still_works_when_file_is_not_writable(monkeypatch, capsys, tmp_path) -> None:
    blocked = tmp_path / "file-not-dir"
    blocked.write_text("")
    monkeypatch.setattr(settings, "usage_log_path", blocked / "llm_usage.jsonl")
    monkeypatch.setattr(settings, "usage_log_stdout", True)
    log_fallback("chat", "offline")
    assert STDOUT_PREFIX in capsys.readouterr().out


def test_existing_records_are_never_rewritten() -> None:
    path = settings.usage_log_path
    path.write_text('{"historical": true}\n')
    log_fallback("explain", "offline")
    lines = path.read_text().splitlines()
    assert lines[0] == '{"historical": true}' and len(lines) == 2


def test_environment_and_release_on_vercel(monkeypatch) -> None:
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("VERCEL_GIT_COMMIT_SHA", "f4ff1c8a9b0c1d2e")
    loaded = Settings(_env_file=None)
    assert (loaded.app_env, loaded.release, loaded.usage_log_stdout) == ("vercel-production", "f4ff1c8", True)


def test_environment_and_release_locally(monkeypatch) -> None:
    for name in ("VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA"):
        monkeypatch.delenv(name, raising=False)
    loaded = Settings(_env_file=None)
    assert (loaded.app_env, loaded.release, loaded.usage_log_stdout) == ("local", None, False)


def test_broken_provider_install_falls_back_instead_of_crashing(monkeypatch, caplog) -> None:
    """Regression: on Vercel a missing dependency made every AI request return 500."""
    import builtins

    from fastapi.testclient import TestClient

    from app.main import app

    real_import = builtins.__import__

    def failing_import(name, *args, **kwargs):
        if name == "app.llm.gemini":
            raise ModuleNotFoundError("No module named 'httpx'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(settings, "llm_api_key", SecretStr("some-key"))
    monkeypatch.setattr(builtins, "__import__", failing_import)
    factory.get_provider.cache_clear()
    with caplog.at_level(logging.ERROR):
        client = TestClient(app)
        health = client.get("/api/health")
        analysis = client.get("/api/patients/P004/analysis")
    assert health.status_code == 200 and health.json()["provider"] == "template"
    assert analysis.status_code == 200 and analysis.json()["results"][0]["status"] == "urgent"
    assert "Gemini provider failed to start" in caplog.text
