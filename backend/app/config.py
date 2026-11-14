"""All runtime settings, read from environment variables (or a local `.env`).

This is the only place settings live. API keys and model names are never
hard-coded anywhere else in the codebase.
"""

import os
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
"""Repository root (…/citylab-lab-explainer), independent of the working directory."""

_ON_VERCEL = bool(os.environ.get("VERCEL"))
_DEFAULT_LOG = (
    Path("/tmp/llm_usage.jsonl") if _ON_VERCEL else REPO_ROOT / "backend" / "logs" / "llm_usage.jsonl"
)


def _default_app_env() -> str:
    """'vercel-production' / 'vercel-preview' on Vercel (from VERCEL_ENV), else 'local'."""
    vercel_env = os.environ.get("VERCEL_ENV")
    return f"vercel-{vercel_env}" if vercel_env else "local"


def _default_release() -> str | None:
    """Short git commit of the deployment (Vercel sets VERCEL_GIT_COMMIT_SHA), else None."""
    return os.environ.get("VERCEL_GIT_COMMIT_SHA", "")[:7] or None


class Settings(BaseSettings):
    """Application settings. Every field maps to an upper-case env var (e.g. `LLM_MODEL`)."""

    model_config = SettingsConfigDict(env_file=(REPO_ROOT / ".env", ".env"), extra="ignore")

    llm_provider: str = "gemini"
    llm_model: str = "gemini-3.5-flash-lite"
    llm_api_key: SecretStr | None = None
    llm_timeout_s: float = 20
    llm_max_retries: int = 3
    llm_retry_budget_s: float = 25
    rate_limit_per_minute: int = 20
    data_dir: Path = REPO_ROOT / "data" / "lab_reports"
    usage_log_path: Path = _DEFAULT_LOG
    usage_log_stdout: bool = Field(default_factory=lambda: bool(os.environ.get("VERCEL")))
    app_env: str = Field(default_factory=_default_app_env)
    release: str | None = Field(default_factory=_default_release)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"

    @field_validator("llm_provider")
    @classmethod
    def _normalize_provider(cls, value: str) -> str:
        """'Gemini ' → 'gemini', so a capital letter or stray space can't silently switch AI off."""
        return value.strip().lower()

    @field_validator("llm_api_key", mode="before")
    @classmethod
    def _blank_key_is_none(cls, value: object) -> object:
        """An empty `LLM_API_KEY=` means "no key" (offline mode)."""
        return None if isinstance(value, str) and not value.strip() else value

    def api_key(self) -> str | None:
        """The raw key, for the provider only. Everywhere else it prints as '**********'."""
        return self.llm_api_key.get_secret_value() if self.llm_api_key else None


settings = Settings()
