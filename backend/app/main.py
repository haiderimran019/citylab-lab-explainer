"""FastAPI application: HTTP routes only. All logic lives in `app.analysis`, `app.pipeline` and `app.llm`."""

from typing import Annotated

from fastapi import FastAPI, Query

from app.analysis import CUSTOM_ID, PASTED_FILE, classify_parsed, parse_pasted
from app.config import settings
from app.corpus import corpus, get_report
from app.errors import install_error_handling
from app.llm.factory import get_provider
from app.models import (
    Analysis,
    AnalyzeRequest,
    ErrorResponse,
    HealthResponse,
    PatientSummary,
    RuleRange,
    RulesResponse,
    RuleUrgent,
    SexInput,
)
from app.pipeline.rules import CONTEXT_ALIASES, EDGE_RULE, load_rules

app = FastAPI(
    title="CityLab Lab Report Explainer",
    description="Code does the medical math. AI only does the talking.",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
install_error_handling(app)

AgeQuery = Annotated[int | None, Query(ge=0, le=130, description="Override a missing or wrong age")]
SexQuery = Annotated[SexInput, Query(description="Override a missing sex: Male or Female")]


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness check with the provider and model actually in use (never the key)."""
    provider = get_provider()
    return HealthResponse(
        status="ok",
        provider=provider.name,
        model=provider.model,
        rules_loaded=load_rules(settings.data_dir).from_files,
        patients=len(corpus()),
    )


@app.get("/api/patients", response_model=list[PatientSummary])
def list_patients() -> list[PatientSummary]:
    """Every stored patient report, in ID order."""
    return [report.summary() for report in corpus().values()]


@app.get("/api/patients/{patient_id}/analysis", response_model=Analysis)
def patient_analysis(
    patient_id: str, age: AgeQuery = None, sex: SexQuery = None
) -> Analysis:
    """Full analysis of a stored report. `age`/`sex` fill in missing demographics."""
    report = get_report(patient_id)
    return classify_parsed(report.parsed, report.id, report.file, age, sex)


@app.post("/api/analyze", response_model=Analysis)
def analyze(body: AnalyzeRequest) -> Analysis:
    """Analyze a pasted or uploaded report (patient id `custom`)."""
    return classify_parsed(parse_pasted(body.report_text), CUSTOM_ID, PASTED_FILE, body.age, body.sex)


@app.get("/api/rules", response_model=RulesResponse)
def rules() -> RulesResponse:
    """The parsed ranges, aliases and urgent thresholds (for the "How it works" panel)."""
    loaded = load_rules(settings.data_dir)
    return RulesResponse(
        aliases={**loaded.aliases, **CONTEXT_ALIASES},
        ranges=[
            RuleRange(
                test=r.test, sex=r.sex, age_min=r.age_min, age_max=r.age_max, low=r.low, high=r.high,
                text=r.text, unit=r.unit, source_file=r.source_file,
            )
            for r in loaded.ranges
        ],
        urgent=[RuleUrgent(test=u.test, op=u.op, value=u.value, unit=u.unit) for u in loaded.urgent],
        edge_rule=EDGE_RULE,
    )
