"""FastAPI application: HTTP routes only. All logic lives in services and `app.pipeline` / `app.llm`."""

from typing import Annotated

from fastapi import FastAPI, File, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.analysis import CUSTOM_ID, PASTED_FILE, build_analysis, parse_pasted
from app.chat import chat as answer_chat
from app.config import settings
from app.corpus import corpus, get_report
from app.errors import install_error_handling
from app.llm import usage_log
from app.llm.factory import get_provider
from app.models import (
    Analysis,
    AnalyzeRequest,
    ChatRequest,
    ChatResponse,
    ErrorResponse,
    ExplainRequest,
    ExplainResponse,
    HealthResponse,
    Lang,
    PatientSummary,
    RuleRange,
    RulesResponse,
    RuleUrgent,
    SexInput,
    UploadResponse,
)
from app.pipeline import explain as explainer
from app.pipeline.rules import CONTEXT_ALIASES, EDGE_RULE, load_rules
from app.ratelimit import enforce_llm_rate_limit
from app.upload import MAX_BYTES, read_upload

app = FastAPI(
    title="CityLab Lab Report Explainer",
    description="Code does the medical math. AI only does the talking.",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    responses={code: {"model": ErrorResponse} for code in (404, 413, 415, 422, 429, 500, 503)},
)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Request-Id"], expose_headers=["X-Request-Id", "Retry-After"],
)
install_error_handling(app)

AgeQuery = Annotated[int | None, Query(ge=0, le=130, description="Override a missing or wrong age")]
SexQuery = Annotated[SexInput, Query(description="Override a missing sex: Male or Female")]
ExplainQuery = Annotated[bool, Query(description="false = statuses only, no AI call (fast)")]
LangQuery = Annotated[Lang, Query(description="Language of AI/template text: en or ur")]


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness check, the provider/model actually in use, and today's usage stats (never keys)."""
    provider = get_provider()
    stats = usage_log.summarize(usage_log.read_records(), day=usage_log.today())
    return HealthResponse(
        status="ok",
        provider=provider.name,
        model=provider.model,
        rules_loaded=load_rules(settings.data_dir).from_files,
        patients=len(corpus()),
        cache_size=len(explainer.cache),
        llm_calls_today=stats.llm_calls,
        fallbacks_today=stats.fallbacks,
        avg_latency_ms=stats.avg_latency_ms,
    )


@app.get("/api/patients", response_model=list[PatientSummary])
def list_patients() -> list[PatientSummary]:
    """Every stored patient report, in ID order."""
    return [report.summary() for report in corpus().values()]


@app.get("/api/patients/{patient_id}/analysis", response_model=Analysis)
def patient_analysis(
    request: Request,
    patient_id: str,
    age: AgeQuery = None,
    sex: SexQuery = None,
    explain: ExplainQuery = True,
    lang: LangQuery = "en",
) -> Analysis:
    """Full analysis of a stored report. `age`/`sex` fill in missing demographics."""
    report = get_report(patient_id)
    if explain:
        enforce_llm_rate_limit(request)
    return build_analysis(report.parsed, report.id, report.file, age, sex, explain, lang)


@app.post("/api/analyze", response_model=Analysis)
def analyze(request: Request, body: AnalyzeRequest, explain: ExplainQuery = True, lang: LangQuery = "en") -> Analysis:
    """Analyze a pasted or uploaded report (patient id `custom`)."""
    if explain:
        enforce_llm_rate_limit(request)
    return build_analysis(parse_pasted(body.report_text), CUSTOM_ID, PASTED_FILE, body.age, body.sex, explain, lang)


@app.post("/api/explain", response_model=ExplainResponse)
def explain_analysis(request: Request, body: ExplainRequest, lang: LangQuery = "en") -> ExplainResponse:
    """Explanations for an Analysis fetched earlier with `explain=false` (cached; template on failure)."""
    enforce_llm_rate_limit(request)
    return explainer.explain(body.analysis, lang)


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: Request, body: ChatRequest, lang: LangQuery = "en") -> ChatResponse:
    """Chat about the open report only. Other patients are refused (Safety Rule 1)."""
    enforce_llm_rate_limit(request)
    return answer_chat(body, lang)


@app.post("/api/upload", response_model=UploadResponse)
async def upload(
    request: Request,
    file: Annotated[UploadFile, File(description="JPEG/PNG/WEBP photo or PDF, max 4 MB")],
) -> UploadResponse:
    """Extract report text from a PDF or photo. Not classified: the user confirms it, then calls /api/analyze."""
    enforce_llm_rate_limit(request)
    data = await file.read(MAX_BYTES + 1)
    return await run_in_threadpool(read_upload, file.content_type, data)


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


if (settings.frontend_dist / "index.html").exists():  # Docker: serve the built React app on the same origin
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
