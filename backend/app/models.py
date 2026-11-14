"""Pydantic models shared by the pipeline and the API (see documents/CONTRACT.md)."""

from typing import Literal

from pydantic import BaseModel, Field

Status = Literal["normal", "low", "high", "urgent", "cannot_classify", "needs_info"]
Sex = Literal["Male", "Female"]
MissingField = Literal["age", "sex"]


class Source(BaseModel):
    """Where a fact came from: a file name and a 1-based line number (0 = not line-based)."""

    file: str
    line: int


class Conversion(BaseModel):
    """A unit conversion applied before comparing, with the math spelled out."""

    value: int | float
    unit: str
    steps: str


class RangeUsed(BaseModel):
    """The reference range a result was compared against."""

    low: int | float | None
    high: int | float | None
    text: str | None = None
    unit: str | None
    sex: str
    age_min: int
    age_max: int
    source_file: str


class TestResult(BaseModel):
    """One test line from a report, fully classified."""

    name_in_report: str
    canonical_name: str | None
    alias_note: str | None = None
    value: int | float | str
    unit: str | None
    converted: Conversion | None = None
    range: RangeUsed | None = None
    status: Status
    is_urgent: bool = False
    urgent_rule: str | None = None
    reason: str
    explanation: str | None = None
    source: Source


class Patient(BaseModel):
    """Demographics of the patient a report belongs to. Unknown values are None."""

    id: str
    name: str | None
    age: int | None
    sex: Sex | None
    mrn: str | None
    file: str


class PatientSummary(Patient):
    """A row in the patient list."""

    test_count: int


class GeneratedBy(BaseModel):
    """Which provider and model actually wrote the explanation text."""

    provider: str
    model: str


class Analysis(BaseModel):
    """Full analysis of one report."""

    patient: Patient
    results: list[TestResult]
    missing_info: list[MissingField] = Field(default_factory=list)
    ask_message: str | None = None
    urgent_banner: str | None = None
    doctor_questions: list[str] = Field(default_factory=list)
    summary: str
    disclaimer: str
    generated_by: GeneratedBy


class AnalyzeRequest(BaseModel):
    """Body of POST /api/analyze."""

    report_text: str = Field(min_length=1, max_length=200_000)
    age: int | None = Field(default=None, ge=0, le=130)
    sex: Sex | None = None


class ChatRequest(BaseModel):
    """Body of POST /api/chat. Either `patient_id` or `report_text` identifies the report."""

    patient_id: str | None = None
    report_text: str | None = Field(default=None, max_length=200_000)
    message: str = Field(min_length=1, max_length=2_000)
    age: int | None = Field(default=None, ge=0, le=130)
    sex: Sex | None = None


class ChatResponse(BaseModel):
    """Reply of POST /api/chat."""

    reply: str
    refused: bool
    sources: list[Source]
    generated_by: GeneratedBy | None = None


class HealthResponse(BaseModel):
    """Reply of GET /api/health. Never contains keys."""

    status: Literal["ok"]
    provider: str
    model: str
    rules_loaded: bool
    patients: int


class ErrorResponse(BaseModel):
    """Every error the API returns has this shape."""

    error: str
    code: str
