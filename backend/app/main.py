"""FastAPI application: HTTP routes only. All logic lives in `app.pipeline` and `app.llm`."""

from fastapi import FastAPI

from app.config import settings
from app.models import HealthResponse

app = FastAPI(
    title="CityLab Lab Report Explainer",
    description="Code does the medical math. AI only does the talking.",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)


def _count_report_files() -> int:
    """Number of patient report files in the data folder."""
    return len(list(settings.data_dir.glob("report_*.md")))


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness check with the configured provider and model (never the key)."""
    return HealthResponse(
        status="ok",
        provider=settings.llm_provider,
        model=settings.llm_model,
        rules_loaded=False,
        patients=_count_report_files(),
    )
