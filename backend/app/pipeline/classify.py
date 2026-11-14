"""Step 4 — CLASSIFY: pure, deterministic status decisions. The LLM never touches this.

Rules applied (all from the lab's files):
* the range is chosen by the patient's age and sex; age bounds are inclusive;
* a value exactly on a limit is NORMAL;
* urgent thresholds are inclusive ("hit or pass") and apply whatever the demographics;
* missing age/sex that a range depends on → `needs_info` (never guessed);
* unknown test, unknown unit or no range for this patient → `cannot_classify`.
"""

from dataclasses import dataclass

from app.models import MissingField, RangeUsed, Sex, Source, Status, TestResult
from app.pipeline.normalize import UnitConversionError, canonical, convert, format_number
from app.pipeline.parse import RawTest
from app.pipeline.rules import RangeRule, Rules, UrgentRule
from app.texts import URGENT_BANNER

CANNOT = "cannot be classified from the files"


@dataclass(frozen=True)
class Classification:
    """Classified results of one report plus the report-level flags."""

    results: list[TestResult]
    missing_info: list[MissingField]
    ask_message: str | None
    urgent_banner: str | None


@dataclass(frozen=True)
class _UrgentHit:
    rule: UrgentRule
    value: int | float


def _quantity(value: int | float | str, unit: str | None) -> str:
    """'45 U/L', or just '5.5' when there is no unit."""
    shown = format_number(value) if isinstance(value, (int, float)) else value
    return f"{shown} {unit}" if unit else shown


def _range_text(rule: RangeRule) -> str:
    """'7–45 U/L'."""
    return _quantity(f"{format_number(rule.low)}–{format_number(rule.high)}", rule.unit)


def _range_used(rule: RangeRule) -> RangeUsed:
    return RangeUsed(
        low=rule.low, high=rule.high, text=rule.text, unit=rule.unit, sex=rule.sex,
        age_min=rule.age_min, age_max=rule.age_max, source_file=rule.source_file,
    )


def _missing_fields(candidates: list[RangeRule], age: int | None, sex: Sex | None) -> list[MissingField]:
    """Demographics this test's ranges depend on that the report does not give."""
    missing: list[MissingField] = []
    if age is None:
        missing.append("age")
    if sex is None and any(r.sex != "All" for r in candidates):
        missing.append("sex")
    return missing


def _needs_info_reason(name: str, candidates: list[RangeRule], missing: list[MissingField]) -> str:
    """'AST ranges differ by sex and sex is missing' (and the age equivalent)."""
    band = f"{candidates[0].age_min}–{candidates[0].age_max} years"
    parts = {"age": f"depend on age ({band})", "sex": "differ by sex"}
    verb = "are" if len(missing) > 1 else "is"
    return f"{name} ranges {' and '.join(parts[m] for m in missing)} and {' and '.join(missing)} {verb} missing"


def _pick_range(candidates: list[RangeRule], age: int, sex: Sex | None) -> RangeRule | None:
    """First range matching the patient's sex (or 'All') and age band (inclusive)."""
    return next(
        (r for r in candidates if r.sex in ("All", sex) and r.age_min <= age <= r.age_max),
        None,
    )


def _urgent_hit(name: str, value: int | float | str, unit: str | None, rules: Rules) -> _UrgentHit | None:
    """The first urgent threshold this value hits or passes (after unit conversion), if any."""
    if not isinstance(value, (int, float)):
        return None
    for rule in rules.urgent_for(name):
        try:
            conversion = convert(value, unit, rule.unit, name)
        except UnitConversionError:
            continue
        compared = conversion.value if conversion else value
        if rule.is_triggered(compared):
            return _UrgentHit(rule, compared)
    return None


def _urgent_phrase(hit: _UrgentHit) -> str:
    """'at/below the urgent limit 7.0 g/dL'."""
    side = "at/below" if hit.rule.op == "<=" else "at/above"
    return f"{side} the urgent limit {format_number(hit.rule.value)} {hit.rule.unit}"


def _compare_numeric(value: int | float, unit: str | None, rule: RangeRule) -> tuple[Status, str]:
    """Status and a plain-words reason. Limits themselves are NORMAL."""
    shown = _quantity(value, unit)
    if value == rule.low or value == rule.high:
        side = "lower" if value == rule.low else "upper"
        return "normal", f"{shown} is exactly on the {side} limit of {_range_text(rule)} → NORMAL (on-limit rule)"
    if rule.low <= value <= rule.high:
        return "normal", f"{shown} is within {_range_text(rule)} → NORMAL"
    if value < rule.low:
        return "low", f"{shown} is below {_quantity(rule.low, rule.unit)} → LOW"
    return "high", f"{shown} is above {_quantity(rule.high, rule.unit)} → HIGH"


def _compare_text(value: int | float | str, rule: RangeRule) -> tuple[Status, str]:
    """Qualitative range such as 'Negative': only an exact match can be judged."""
    if isinstance(value, str) and value.lower() == (rule.text or "").lower():
        return "normal", f"{value} matches the expected result '{rule.text}' → NORMAL"
    return "cannot_classify", f"'{value}' is not '{rule.text}', and the files give no rule for other results — {CANNOT}"


def classify_test(
    test: RawTest, age: int | None, sex: Sex | None, rules: Rules, source_file: str
) -> tuple[TestResult, list[MissingField]]:
    """Classify one test. Also returns the demographics it still needs (empty if none)."""
    name, alias_note = canonical(test.name, rules)
    fields = {
        "name_in_report": test.name, "canonical_name": name, "alias_note": alias_note,
        "value": test.value, "unit": test.unit, "source": Source(file=source_file, line=test.line),
        "extracted_by": test.extracted_by,
    }

    def done(status: Status, reason: str, **extra) -> TestResult:
        """Build the result; an urgent hit overrides any status that couldn't be decided."""
        hit = _urgent_hit(name, test.value, test.unit, rules) if name else None
        if hit and status in ("needs_info", "cannot_classify"):
            reason = f"{_quantity(hit.value, hit.rule.unit)} is {_urgent_phrase(hit)} → URGENT. ({reason})"
        elif hit:
            reason = reason.replace(f" → {status.upper()}", f" ({status.upper()}) and {_urgent_phrase(hit)} → URGENT")
        return TestResult(
            **fields, **extra, reason=reason,
            status="urgent" if hit else status,
            is_urgent=hit is not None,
            urgent_rule=hit.rule.describe() if hit else None,
        )

    candidates = rules.ranges_for(name) if name else []
    if not candidates:
        return done("cannot_classify", f"{test.name} has no matching range in the reference files — {CANNOT}"), []

    missing = _missing_fields(candidates, age, sex)
    if missing:
        return done("needs_info", _needs_info_reason(name, candidates, missing)), missing

    rule = _pick_range(candidates, age, sex)
    if rule is None:
        who = f"age {age}" + (f" ({sex})" if sex else "")
        return done("cannot_classify", f"no {name} range for {who} in the files — {CANNOT}"), []

    if rule.text is not None or not isinstance(test.value, (int, float)):
        if rule.text is None:
            return done("cannot_classify", f"'{test.value}' is not an exact number — {CANNOT}"), []
        status, reason = _compare_text(test.value, rule)
        return done(status, reason, range=_range_used(rule)), []

    try:
        conversion = convert(test.value, test.unit, rule.unit, name)
    except UnitConversionError:
        unit = f"unit '{test.unit}'" if test.unit else "a missing unit"
        return done("cannot_classify", f"{unit} cannot be converted to {rule.unit or 'the range unit'} using the files — {CANNOT}"), []

    value = conversion.value if conversion else test.value
    status, reason = _compare_numeric(value, rule.unit, rule)
    return done(status, reason, range=_range_used(rule), converted=conversion), []


def build_ask_message(test_names: list[str], missing: list[MissingField]) -> str:
    """Friendly request for the demographics we refuse to guess."""
    words = {"age": "age", "sex": "biological sex"}
    request = {
        ("sex",): "Please tell me Male or Female.",
        ("age",): "Please tell me the patient's age in years.",
        ("age", "sex"): "Please tell me the patient's age and sex (Male or Female).",
    }[tuple(missing)]
    return (
        f"I can't choose the right normal range for {', '.join(test_names)} because the report "
        f"doesn't state the patient's {' and '.join(words[m] for m in missing)}. {request}"
    )


def classify_report(
    tests: list[RawTest], age: int | None, sex: Sex | None, rules: Rules, source_file: str
) -> Classification:
    """Classify every test of one report.

    When any test needs demographics, `missing_info` lists *every* missing demographic
    (age and/or sex) so the user is asked once, not twice.
    """
    results: list[TestResult] = []
    waiting_on: list[str] = []
    for test in tests:
        result, missing = classify_test(test, age, sex, rules, source_file)
        results.append(result)
        if missing:
            waiting_on.append(result.canonical_name or test.name)

    missing_info: list[MissingField] = []
    if waiting_on and age is None:
        missing_info.append("age")
    if waiting_on and sex is None:
        missing_info.append("sex")
    return Classification(
        results=results,
        missing_info=missing_info,
        ask_message=build_ask_message(waiting_on, missing_info) if waiting_on else None,
        urgent_banner=URGENT_BANNER["en"] if any(r.is_urgent for r in results) else None,
    )
