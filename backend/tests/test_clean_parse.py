"""Tests for step 1 (clean) and step 2 (parse)."""

from pathlib import Path

import pytest

from app.config import settings
from app.pipeline.clean import clean
from app.pipeline.parse import (
    Demographics,
    normalize_sex,
    parse_demographics,
    parse_report,
    parse_tests,
    parse_value,
)


def _numbered(text: str) -> list[tuple[int, str]]:
    return list(enumerate(text.strip("\n").splitlines(), start=1))


def _read(patient_id: str) -> str:
    return next(Path(settings.data_dir).glob(f"report_{patient_id}_*.md")).read_text()


# --------------------------------------------------------------------------- clean


def test_clean_stops_at_first_appendix_and_keeps_line_numbers() -> None:
    text = "title\n\n- Hb: 13 g/dL\n### APPENDIX 1: NOISE\n- WBC: 9000 cells/mcL\n"
    assert clean(text) == [(1, "title"), (2, ""), (3, "- Hb: 13 g/dL")]


def test_clean_without_appendix_returns_everything() -> None:
    assert [n for n, _ in clean("a\nb\nc")] == [1, 2, 3]


def test_corpus_file_is_cut_to_real_part() -> None:
    lines = clean(_read("P001"))
    assert len(lines) < 20
    assert all("APPENDIX" not in line for _, line in lines)


# --------------------------------------------------------------------------- corpus


CORPUS = {
    "P001": [("Hemoglobin", 13.5, "g/dL", 12), ("WBC", 6000, "cells/mcL", 13)],
    "P002": [("SGPT", 45, "U/L", 14)],
    "P003": [("Fasting Blood Sugar", 110, "mg/dL", 12)],
    "P004": [("Hemoglobin", 6.5, "g/dL", 12), ("Platelet Count", 120000, "cells/mcL", 13)],
    "P005": [("Fasting Blood Sugar", 6.0, "mmol/L", 12)],
    "P006": [("Serum Ferritin", 25, "ng/mL", 12)],
    "P007": [("TSH", 2.5, "mIU/L", 12)],
    "P008": [("pH Level", 5.5, None, 12), ("Protein", "Negative", None, 13)],
    "P009": [("ALT", 85, "U/L", 14), ("AST", 60, "U/L", 15)],
    "P010": [("Cholesterol", 200, "mg/dL", 12)],
    "P011": [("WBC", 12000, "cells/mcL", 12), ("PLT", 140000, "cells/mcL", 13)],
    "P012": [("AST", 44, "U/L", 12)],
    "P013": [("Fasting Blood Sugar", 350, "mg/dL", 12)],
    "P014": [("FBS", 85, "mg/dL", 12), ("SGOT", 22, "U/L", 13)],
}


@pytest.mark.parametrize("patient_id", sorted(CORPUS))
def test_every_corpus_report_parses_exactly(patient_id: str) -> None:
    tests = parse_report(_read(patient_id)).tests
    assert [(t.name, t.value, t.unit, t.line) for t in tests] == CORPUS[patient_id]


def test_corpus_demographics_complete() -> None:
    assert parse_report(_read("P004")).demographics == Demographics(
        name="Diana Prince", age=42, sex="Female", mrn="CLD-P004-9942"
    )


def test_corrupted_age_and_sex_become_none() -> None:
    demo = parse_report(_read("P003")).demographics
    assert (demo.name, demo.age, demo.sex) == ("Charlie Brown", None, None)


def test_not_provided_sex_becomes_none() -> None:
    demo = parse_report(_read("P012")).demographics
    assert (demo.age, demo.sex) == (32, None)


def test_sex_comes_from_field_not_name() -> None:
    assert parse_report(_read("P002")).demographics.sex == "Female"  # "Bob" is Female per report


# --------------------------------------------------------------------------- formats


@pytest.mark.parametrize(
    "line, expected",
    [
        ("- Hemoglobin: 13.5 g/dL", ("Hemoglobin", 13.5, "g/dL")),
        ("* **Hemoglobin**: 6.5 g/dL", ("Hemoglobin", 6.5, "g/dL")),
        ("- **Hb:** 70 g/L", ("Hb", 70, "g/L")),
        ("TSH: 2.5 mIU/L", ("TSH", 2.5, "mIU/L")),
        ("| SGPT | 45 | U/L |", ("SGPT", 45, "U/L")),
        ("| **ALT** | 85 U/L |", ("ALT", 85, "U/L")),
        ("* pH Level -> 5.5", ("pH Level", 5.5, None)),
        ("Protein → Negative", ("Protein", "Negative", None)),
        ("1. PLT: 150,000 cells/mcL", ("PLT", 150000, "cells/mcL")),
        ("- WBC: 12000 cells/mcL (H)", ("WBC", 12000, "cells/mcL")),
    ],
)
def test_single_line_formats(line: str, expected: tuple) -> None:
    (test,) = parse_tests([(5, line)])
    assert (test.name, test.value, test.unit, test.line) == (*expected, 5)


def test_paired_lines_use_name_line_number() -> None:
    lines = _numbered("Test Conducted: Fasting Blood Sugar\nValue Recorded: 110 mg/dL\n\nTest: AST\nResult: 44 U/L")
    assert [(t.name, t.value, t.unit, t.line) for t in parse_tests(lines)] == [
        ("Fasting Blood Sugar", 110, "mg/dL", 1),
        ("AST", 44, "U/L", 4),
    ]


def test_table_header_and_separator_rows_are_skipped() -> None:
    lines = _numbered("| Test Name | Result | Unit |\n| :--- | :--- | :--- |\n| ALT | 85 | U/L |")
    assert [t.name for t in parse_tests(lines)] == ["ALT"]


def test_pasted_report_without_heading_skips_demographics_and_prose() -> None:
    report = """Name: Sam Lee
Age: 30
Sex: F
MRN: X-1
Date: 2026-11-13
The analyzers ran fine and results are as follows:
Hb: 70 g/L
Glucose: 5.5 mmol/mol
"""
    parsed = parse_report(report)
    assert parsed.demographics == Demographics(name="Sam Lee", age=30, sex="Female", mrn="X-1")
    assert [(t.name, t.value, t.unit) for t in parsed.tests] == [("Hb", 70, "g/L"), ("Glucose", 5.5, "mmol/mol")]


def test_only_results_section_is_parsed_when_heading_exists() -> None:
    lines = _numbered("Recorded Age: 28\nWeight: 70 kg\n## ANALYTICAL RESULTS\n- TSH: 2.5 mIU/L")
    assert [t.name for t in parse_tests(lines)] == ["TSH"]


def test_garbage_text_yields_no_tests() -> None:
    assert parse_report("hello world\n\n!!!").tests == []


# --------------------------------------------------------------------------- helpers


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("6.0 mmol/L", (6.0, "mmol/L")),
        ("45", (45, None)),
        ("negative", ("Negative", None)),
        ("<0.5 mg/dL", ("<0.5", "mg/dL")),
        ("[DATA CORRUPTED]", None),
        ("Alice Smith", None),
        ("2026-11-13", None),
    ],
)
def test_parse_value(raw: str, expected: tuple | None) -> None:
    assert parse_value(raw) == expected


@pytest.mark.parametrize(
    "raw, expected", [("Male", "Male"), ("m", "Male"), ("FEMALE", "Female"), ("F", "Female"), ("x", None), (None, None)]
)
def test_normalize_sex(raw: str | None, expected: str | None) -> None:
    assert normalize_sex(raw) == expected


def test_demographic_placeholders_are_none() -> None:
    lines = _numbered("* **Recorded Age**: N/A\n* **Biological Sex**: [NOT PROVIDED]\n* **Patient Full Name**:")
    assert parse_demographics(lines) == Demographics()
