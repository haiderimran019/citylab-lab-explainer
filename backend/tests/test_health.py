"""Smoke tests for the app skeleton."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_ok_and_corpus_size() -> None:
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["patients"] == 14
    assert "api_key" not in str(body).lower()


def test_vercel_entrypoint_exposes_same_app() -> None:
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "api" / "index.py"
    spec = importlib.util.spec_from_file_location("vercel_index", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.app is app
