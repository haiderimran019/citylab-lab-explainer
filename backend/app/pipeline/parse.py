"""Step 2 — PARSE: read demographics and test lines from a cleaned report.

Supported test-line formats (all seen in the CityLab corpus):

* ``- Hemoglobin: 13.5 g/dL`` / ``* **Hemoglobin**: 6.5 g/dL`` / ``TSH: 2.5 mIU/L``
* markdown table rows ``| SGPT | 45 | U/L |``
* ``pH Level -> 5.5``
* paired lines ``Test Conducted: X`` + ``Value Recorded: 110 mg/dL``
  and ``Test: AST`` + ``Result: 44 U/L``
"""

import re
from dataclasses import dataclass, field

from app.models import Sex, normalize_sex
from app.pipeline.clean import NumberedLine, clean

Value = int | float | str


@dataclass(frozen=True)
class Demographics:
    """Patient details found in a report. Anything missing or corrupted is None."""

    name: str | None = None
    age: int | None = None
    sex: Sex | None = None
    mrn: str | None = None


@dataclass(frozen=True)
class RawTest:
    """One test exactly as written in the report (markdown removed), before normalization."""

    name: str
    value: Value
    unit: str | None
    line: int


@dataclass(frozen=True)
class ParsedReport:
    """Everything the parser extracted from one report."""

    demographics: Demographics
    tests: list[RawTest] = field(default_factory=list)


_BULLET = r"^\s*(?:[*\-+•]\s+|\d+[.)]\s+)?"
_KEY_VALUE = re.compile(_BULLET + r"(?P<key>[^:|]+?)\s*:\s*(?P<val>.*)$")
_ARROW = re.compile(_BULLET + r"(?P<key>[^:|]+?)\s*(?:->|→|=>)\s*(?P<val>.+)$")
_NUMBER = re.compile(r"^(?P<cmp>[<>]=?|≤|≥)?\s*(?P<num>-?\d[\d,]*(?:\.\d+)?)\s*(?P<unit>.*)$")
_TABLE_SEPARATOR = re.compile(r"^:?-{2,}:?$")
_FLAG_SUFFIX = re.compile(r"\s*\((?:h|l|high|low|critical|normal|abnormal)\)$", re.IGNORECASE)
_PARENTHETICAL = re.compile(r"\([^)]*\)")
_RESULTS_HEADING = re.compile(r"^\s*#.*\bRESULTS?\b|ANALYTICAL RESULTS", re.IGNORECASE)

_QUALITATIVE = {
    "negative", "positive", "trace", "nil", "absent", "present",
    "detected", "not detected", "reactive", "non-reactive", "non reactive",
}
_MISSING = {"", "n/a", "na", "none", "unknown", "not provided", "not available", "-", "--"}

_DEMOGRAPHIC_KEYS: dict[str, set[str]] = {
    "name": {"patient full name", "patient name", "full name", "name"},
    "age": {"recorded age", "patient age", "age"},
    "sex": {"biological sex", "sex at birth", "sex", "gender"},
    "mrn": {"medical record number", "medical record no", "mrn"},
}
_PAIRED_TEST_KEYS = {"test conducted", "test", "test name", "analyte", "parameter", "investigation"}
_PAIRED_VALUE_KEYS = {"value recorded", "result", "value", "reading", "observed value"}
_NON_TEST_KEYS = set().union(*_DEMOGRAPHIC_KEYS.values()) | {
    "date", "date of issuance", "report date", "collection date", "date of birth", "dob",
    "patient id", "id", "report id", "referred by", "doctor", "physician", "sample",
    "specimen", "time", "phone", "address", "lab", "laboratory", "note", "notes", "comment",
}


def _strip_markdown(text: str) -> str:
    """Remove bold/italic/code markers and surrounding whitespace."""
    return text.replace("*", "").replace("`", "").replace("__", "").strip()


def _normalize_key(key: str) -> str:
    """Lower-case a field label and drop parentheses, e.g. 'Medical Record Number (MRN)'."""
    return " ".join(_PARENTHETICAL.sub(" ", _strip_markdown(key)).lower().split())


def _is_missing(value: str) -> bool:
    """True for placeholders such as '[DATA CORRUPTED]', '[NOT PROVIDED]', 'N/A' or blank."""
    value = value.strip()
    return value.startswith("[") or value.lower() in _MISSING


# --------------------------------------------------------------------------- demographics


def _parse_age(value: str) -> int | None:
    """Leading whole number between 0 and 130, else None."""
    match = re.match(r"^(\d{1,3})\b", value)
    age = int(match.group(1)) if match else None
    return age if age is not None and age <= 130 else None


def parse_demographics(lines: list[NumberedLine]) -> Demographics:
    """Read name, age, sex and MRN. The first occurrence of each field wins.

    Sex is only ever taken from an explicit sex/gender field — never inferred from the name.
    """
    found: dict[str, str] = {}
    for _, line in lines:
        match = _KEY_VALUE.match(line)
        if not match:
            continue
        key = _normalize_key(match["key"])
        value = _strip_markdown(match["val"])
        for field_name, aliases in _DEMOGRAPHIC_KEYS.items():
            if key in aliases and field_name not in found:
                found[field_name] = value
    usable = {k: v for k, v in found.items() if not _is_missing(v)}
    return Demographics(
        name=usable.get("name"),
        age=_parse_age(usable["age"]) if "age" in usable else None,
        sex=normalize_sex(usable.get("sex")),
        mrn=usable.get("mrn"),
    )


# --------------------------------------------------------------------------- test values


def parse_value(raw: str) -> tuple[Value, str | None] | None:
    """Split a result such as '6.0 mmol/L' into (6.0, 'mmol/L').

    Qualitative results ('Negative', 'Trace', …) are kept as text. Bounded values such as
    '<0.5 mg/dL' are kept as text too, because they are not an exact number.
    Returns None when the text is not a lab value.
    """
    text = _FLAG_SUFFIX.sub("", _strip_markdown(raw)).rstrip(".").strip()
    if _is_missing(text):
        return None
    if text.lower() in _QUALITATIVE:
        return text[:1].upper() + text[1:].lower(), None
    match = _NUMBER.match(text)
    if not match:
        return None
    unit = match["unit"].strip() or None
    if unit and (unit[0] in "-:/" or len(unit) > 25 or len(unit.split()) > 3):
        return None
    number = match["num"].replace(",", "")
    if match["cmp"]:
        return f"{match['cmp']}{number}", unit
    return (float(number) if "." in number else int(number)), unit


def _is_test_name(name: str) -> bool:
    """A plausible test name: starts with a letter, short, and not a demographic/meta label."""
    return (
        0 < len(name) <= 60
        and name[0].isalpha()
        and len(name.split()) <= 6
        and _normalize_key(name) not in _NON_TEST_KEYS
    )


def _make_test(name: str, raw_value: str, line_no: int, unit: str | None = None) -> RawTest | None:
    """Build a RawTest if `name` and `raw_value` look like a real lab result."""
    name = _strip_markdown(name).rstrip(":").strip()
    parsed = parse_value(raw_value)
    if parsed is None or not _is_test_name(name):
        return None
    value, inline_unit = parsed
    return RawTest(name=name, value=value, unit=unit or inline_unit, line=line_no)


def _parse_table_row(line: str, line_no: int) -> RawTest | None:
    """Parse `| name | value | unit |`. Header and separator rows return None."""
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if len(cells) < 2 or all(_TABLE_SEPARATOR.match(c) for c in cells if c):
        return None
    unit = _strip_markdown(cells[2]) if len(cells) > 2 and cells[2].strip() else None
    return _make_test(cells[0], cells[1], line_no, unit)


def _results_section(lines: list[NumberedLine]) -> list[NumberedLine]:
    """Lines after the results heading, or all lines when the report has no such heading."""
    for index, (_, line) in enumerate(lines):
        if _RESULTS_HEADING.search(line):
            return lines[index + 1 :]
    return lines


def parse_tests(lines: list[NumberedLine]) -> list[RawTest]:
    """Find every test result line, keeping the original line number of each."""
    tests: list[RawTest] = []
    pending_name: tuple[str, int] | None = None

    for line_no, line in _results_section(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("|"):
            test = _parse_table_row(stripped, line_no)
        elif arrow := _ARROW.match(line):
            test = _make_test(arrow["key"], arrow["val"], line_no)
        elif key_value := _KEY_VALUE.match(line):
            key = _normalize_key(key_value["key"])
            if key in _PAIRED_TEST_KEYS:
                pending_name = (_strip_markdown(key_value["val"]), line_no)
                continue
            if key in _PAIRED_VALUE_KEYS:
                test = _make_test(pending_name[0], key_value["val"], pending_name[1]) if pending_name else None
                pending_name = None
            else:
                test = _make_test(key_value["key"], key_value["val"], line_no)
        else:
            test = None
        if test:
            tests.append(test)
    return tests


def parse_report(text: str) -> ParsedReport:
    """Clean a raw report and parse its demographics and tests."""
    lines = clean(text)
    return ParsedReport(demographics=parse_demographics(lines), tests=parse_tests(lines))
