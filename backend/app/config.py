"""All runtime settings, read from environment variables (or a local `.env`).

This is the only place settings live. API keys and model names are never
hard-coded anywhere else in the codebase.
"""

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
"""Repository root (…/citylab-lab-explainer), independent of the working directory."""

_ON_VERCEL = bool(os.environ.get("VERCEL"))
_DEFAULT_LOG = (
    Path("/tmp/llm_usage.jsonl") if _ON_VERCEL else REPO_ROOT / "backend" / "logs" / "llm_usage.jsonl"
)


class Settings(BaseSettings):
    """Application settings. Every field maps to an upper-case env var (e.g. `LLM_MODEL`)."""

    model_config = SettingsConfigDict(env_file=(REPO_ROOT / ".env", ".env"), extra="ignore")

    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    llm_api_key: str | None = None
    llm_timeout_s: float = 20
    llm_max_retries: int = 3
    data_dir: Path = REPO_ROOT / "data" / "lab_reports"
    usage_log_path: Path = _DEFAULT_LOG


settings = Settings()
