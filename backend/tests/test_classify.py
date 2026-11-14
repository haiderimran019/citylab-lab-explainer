"""Edge cases for normalize and classify (beyond the corpus table)."""

import pytest

from app.pipeline.classify import classify_report, classify_test
from app.pipeline.normalize import UnitConversionError, canonical, convert, format_number, unit_key
from app.pipeline.parse import RawTest

FILE = "custom.md"


def _one(rules, name, value, unit, age=30, sex="Female"):
    result, _ = classify_test(RawTest(name, value, unit, 1), age, sex, rules, FILE)
    return result


# --------------------------------------------------------------------------- normalize


@pytest.mark.parametrize(
    "name, expected",
    [
        ("Hemoglobin", "Hemoglobin"),
        ("hemoglobin", "Hemoglobin"),
        ("Hb", "Hemoglobin"),
        ("Hemoglobin (Hb)", "Hemoglobin"),
        ("SGPT", "ALT"),
        ("Platelets", "Platelet Count"),
        ("Glucose (Fasting)", "Fasting Blood Sugar"),
        ("Serum Cholesterol", "Cholesterol"),
        ("Serum Ferritin", None),
        ("Vitamin D", None),
    ],
)
def test_canonical_names(rules, name, expected) -> None:
    assert canonical(name, rules)[0] == expected


def test_alias_note_cites_glossary(rules) -> None:
    assert canonical("SGOT", rules) == ("AST", "SGOT = AST (from 2_medical_glossary.md)")


@pytest.mark.parametrize(
    "unit, key",
    [("cells/mcL", "/ul"), ("/µL", "/ul"), ("cells/mm³", "/ul"), ("×10³/µL", "10^3/ul"), ("K/uL", "10^3/ul"),
     ("10^9/L", "10^9/l"), ("U/L", "u/l"), ("µIU/mL", "uiu/ml")],
)
def test_unit_keys(unit, key) -> None:
    assert unit_key(unit) == key


def test_same_unit_needs_no_conversion() -> None:
    assert convert(150000, "cells/µL", "cells/mcL", "Platelet Count") is None


def test_hemoglobin_g_per_l() -> None:
    conversion = convert(70, "g/L", "g/dL", "Hemoglobin")
    assert (conversion.value, conversion.steps) == (7.0, "70 g/L ÷ 10 = 7.0 g/dL")


def test_thousands_per_microlitre() -> None:
    assert convert(140, "10^3/uL", "cells/mcL", "Platelet Count").value == 140000


def test_enzyme_iu_equals_u() -> None:
    assert convert(45, "IU/L", "U/L", "ALT").value == 45


def test_unknown_unit_raises() -> None:
    with pytest.raises(UnitConversionError):
        convert(5.5, "mmol/mol", "mg/dL", "Fasting Blood Sugar")


def test_conversion_factor_is_test_specific() -> None:
    with pytest.raises(UnitConversionError):
        convert(5, "mmol/L", "mg/dL", "ALT")


@pytest.mark.parametrize("value, text", [(45, "45"), (6.0, "6.0"), (108.1, "108.1"), (0.4, "0.4"), (18.016, "18.016")])
def test_format_number(value, text) -> None:
    assert format_number(value) == text


# --------------------------------------------------------------------------- classify


def test_value_on_lower_limit_is_normal(rules) -> None:
    result = _one(rules, "Hemoglobin", 12.1, "g/dL")
    assert result.status == "normal"
    assert "lower limit" in result.reason


def test_just_below_lower_limit_is_low(rules) -> None:
    assert _one(rules, "Hemoglobin", 12.0, "g/dL").status == "low"


def test_urgent_threshold_is_inclusive_after_conversion(rules) -> None:
    result = _one(rules, "Hb", 70, "g/L")
    assert (result.status, result.is_urgent, result.converted.value) == ("urgent", True, 7.0)
    assert "3_dangerous_urgent_values.md" in result.urgent_rule


def test_urgent_glucose_at_threshold(rules) -> None:
    assert _one(rules, "FBS", 300, "mg/dL").is_urgent is True
    assert _one(rules, "FBS", 299, "mg/dL").is_urgent is False


def test_age_outside_every_band(rules) -> None:
    result = _one(rules, "Hemoglobin", 13, "g/dL", age=15)
    assert (result.status, result.range) == ("cannot_classify", None)
    assert "age 15" in result.reason


def test_age_upper_bound_is_inclusive(rules) -> None:
    assert _one(rules, "TSH", 2.0, "mIU/L", age=100).status == "normal"


def test_unconvertible_unit(rules) -> None:
    result = _one(rules, "Glucose (Fasting)", 5.5, "mmol/mol")
    assert result.status == "cannot_classify"
    assert "mmol/mol" in result.reason and "cannot be classified from the files" in result.reason


def test_missing_unit_cannot_classify(rules) -> None:
    assert _one(rules, "Hemoglobin", 13, None).status == "cannot_classify"


def test_alias_without_range_cannot_classify(rules) -> None:
    result = _one(rules, "RBC", 4.5, "million/mcL")
    assert (result.canonical_name, result.status) == ("Red Blood Cell Count", "cannot_classify")


def test_text_range_mismatch_is_not_invented(rules) -> None:
    assert _one(rules, "Protein", "Positive", None).status == "cannot_classify"


def test_bounded_value_is_not_an_exact_number(rules) -> None:
    assert _one(rules, "TSH", "<0.1", "mIU/L").status == "cannot_classify"


def test_sex_independent_test_does_not_need_sex(rules) -> None:
    result = classify_report([RawTest("TSH", 2.5, "mIU/L", 1)], 40, None, rules, FILE)
    assert (result.results[0].status, result.missing_info, result.ask_message) == ("normal", [], None)


def test_urgent_value_is_flagged_even_when_demographics_missing(rules) -> None:
    result = classify_report([RawTest("FBS", 400, "mg/dL", 1)], None, None, rules, FILE)
    (fbs,) = result.results
    assert (fbs.status, fbs.is_urgent) == ("urgent", True)
    assert result.urgent_banner and result.missing_info == ["age", "sex"]


def test_source_line_is_kept(rules) -> None:
    result, _ = classify_test(RawTest("TSH", 2.5, "mIU/L", 42), 40, "Male", rules, "r.md")
    assert (result.source.file, result.source.line) == ("r.md", 42)
