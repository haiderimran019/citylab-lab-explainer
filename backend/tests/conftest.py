"""Shared fixtures: the real rules and a helper that classifies a corpus patient."""

from pathlib import Path

import pytest

from app.config import settings
from app.models import Sex
from app.pipeline.classify import Classification, classify_report
from app.pipeline.parse import parse_report
from app.pipeline import explain
from app.pipeline.rules import Rules, load_rules
from app.ratelimit import limiter


@pytest.fixture(scope="session")
def rules() -> Rules:
    return load_rules(settings.data_dir)


@pytest.fixture(scope="session")
def classify_patient(rules: Rules):
    """`classify_patient("P012", sex="Female")` → Classification, using report demographics by default."""

    def run(patient_id: str, age: int | None = None, sex: Sex | None = None) -> Classification:
        path = next(Path(settings.data_dir).glob(f"report_{patient_id}_*.md"))
        parsed = parse_report(path.read_text(encoding="utf-8"))
        return classify_report(
            parsed.tests,
            age if age is not None else parsed.demographics.age,
            sex or parsed.demographics.sex,
            rules,
            path.name,
        )

    return run


@pytest.fixture(autouse=True)
def isolated_llm(monkeypatch, tmp_path):
    """Every test: usage log in a temp file, offline provider unless a test injects one, no real sleeps."""
    from app.llm import factory

    monkeypatch.setattr(settings, "usage_log_path", tmp_path / "llm_usage.jsonl")
    monkeypatch.setattr(settings, "llm_api_key", None)
    monkeypatch.setattr(factory, "_sleep", lambda _seconds: None)
    factory.get_provider.cache_clear()
    explain.cache.clear()
    limiter.reset()


@pytest.fixture
def use_provider(monkeypatch):
    """`use_provider(FakeProvider(...))` routes every LLM call in the app to that provider."""
    from app.llm import factory

    def install(provider):
        monkeypatch.setattr(factory, "get_provider", lambda: provider)
        return provider

    return install
