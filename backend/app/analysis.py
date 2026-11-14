"""Assemble an `Analysis` from report text: clean → parse → normalize → classify (→ explain).

The classify part is deterministic and makes no network call, so `explain=false` responses
are fast. Explanations are added on top by `app.pipeline.explain`.
"""

from app.config import settings
from app.errors import AppError
from app.models import Analysis, Lang, Patient, Sex
from app.pipeline.classify import classify_report
from app.pipeline.explain import apply_explanation, explain
from app.pipeline.extract import extract_tests_with_llm
from app.pipeline.parse import ParsedReport, parse_report
from app.pipeline.rules import load_rules
from app.texts import DISCLAIMER, URGENT_BANNER

CUSTOM_ID = "custom"
PASTED_FILE = "pasted_report"


def classify_parsed(
    parsed: ParsedReport,
    patient_id: str,
    file: str,
    age: int | None = None,
    sex: Sex | None = None,
    lang: Lang = "en",
) -> Analysis:
    """Statuses-only analysis. `age`/`sex` override the report's values when given."""
    age_used = age if age is not None else parsed.demographics.age
    sex_used = sex or parsed.demographics.sex
    classification = classify_report(parsed.tests, age_used, sex_used, load_rules(settings.data_dir), file)
    patient = Patient(
        id=patient_id, name=parsed.demographics.name, age=age_used, sex=sex_used,
        mrn=parsed.demographics.mrn, file=file,
    )
    return Analysis(
        patient=patient,
        results=classification.results,
        missing_info=classification.missing_info,
        ask_message=classification.ask_message,
        urgent_banner=URGENT_BANNER[lang] if classification.urgent_banner else None,
        disclaimer=DISCLAIMER[lang],
    )


def build_analysis(
    parsed: ParsedReport,
    patient_id: str,
    file: str,
    age: int | None = None,
    sex: Sex | None = None,
    explain_results: bool = True,
    lang: Lang = "en",
) -> Analysis:
    """Classified analysis, plus AI/template explanations when `explain_results` is True."""
    analysis = classify_parsed(parsed, patient_id, file, age, sex, lang)
    return apply_explanation(analysis, explain(analysis, lang), lang) if explain_results else analysis


def parse_pasted(report_text: str) -> ParsedReport:
    """Parse user-supplied text. If no regex format matches, ask the LLM to extract test lines.

    Raises a 422 AppError when neither finds a test.
    """
    parsed = parse_report(report_text)
    if not parsed.tests:
        parsed = ParsedReport(demographics=parsed.demographics, tests=extract_tests_with_llm(report_text))
    if not parsed.tests:
        raise AppError(
            422, "no_tests_found",
            "No lab test results were found in this text. Please paste the report section that lists the tests.",
        )
    return parsed
