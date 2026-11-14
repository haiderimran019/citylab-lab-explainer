"""Load the lab's rules from its own reference files at startup.

* aliases            ← ``*glossary*.md`` (``**SGPT** is the exact equivalent of **ALT**``)
                       plus the abbreviations in range headings (``Hemoglobin (Hb)``)
* reference ranges   ← ``*ranges*.md`` (bullet lists, tables and inline bullets)
* urgent thresholds  ← ``*urgent*.md`` (table; "hit or pass" → inclusive)

If the organizers change a number in the files, the app follows. ``FALLBACK_RULES`` is a
hand-written copy used only when a file yields nothing.
"""

import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

from app.pipeline.clean import clean

logger = logging.getLogger(__name__)

Number = int | float
RangeSex = Literal["Male", "Female", "All"]
EDGE_RULE = "Value exactly on a limit = NORMAL; age bounds are inclusive"


@dataclass(frozen=True)
class RangeRule:
    """One reference range row for a test, sex and age band."""

    test: str
    sex: RangeSex
    age_min: int
    age_max: int
    low: Number | None
    high: Number | None
    text: str | None
    unit: str | None
    source_file: str
    line: int


@dataclass(frozen=True)
class UrgentRule:
    """A dangerous-value threshold. Inclusive: `<=` for "Less than", `>=` for "Greater than"."""

    test: str
    op: Literal["<=", ">="]
    value: Number
    unit: str
    source_file: str
    line: int

    def is_triggered(self, value: float) -> bool:
        """True when `value` hits or passes the threshold."""
        return value <= self.value if self.op == "<=" else value >= self.value

    def describe(self) -> str:
        """Human-readable rule with its source, e.g. 'Hemoglobin less than 7.0 g/dL (3_….md)'."""
        word = "less than" if self.op == "<=" else "greater than"
        return f"{self.test} {word} {self.value} {self.unit} ({self.source_file})"


@dataclass(frozen=True)
class Rules:
    """Everything the classifier needs. `from_files` is False if any part used the fallback."""

    aliases: dict[str, str]
    ranges: tuple[RangeRule, ...]
    urgent: tuple[UrgentRule, ...]
    from_files: bool

    def ranges_for(self, test: str) -> list[RangeRule]:
        """All range rows for a canonical test name (case-insensitive)."""
        return [r for r in self.ranges if r.test.lower() == test.lower()]

    def urgent_for(self, test: str) -> list[UrgentRule]:
        """All urgent thresholds for a canonical test name (case-insensitive)."""
        return [u for u in self.urgent if u.test.lower() == test.lower()]


CONTEXT_ALIASES: dict[str, str] = {
    "pH": "Urine pH",
    "pH Level": "Urine pH",
    "Protein": "Urine Protein",
    "Glucose (Fasting)": "Fasting Blood Sugar",
    "Fasting Glucose": "Fasting Blood Sugar",
    "Total Cholesterol": "Cholesterol",
    "Platelets": "Platelet Count",
}
"""Safe mappings that are not in the glossary — our documented assumption (see README)."""


# --------------------------------------------------------------------------- helpers

_PARENTHETICAL = re.compile(r"\s*\(([^)]*)\)")
_ALIAS = re.compile(r"\*\*(.+?)\*\*\s+(?:is the exact equivalent of|maps to)\s+\*\*(.+?)\*\*", re.IGNORECASE)
_NUM = r"\d[\d,]*(?:\.\d+)?"
_AGE_BAND = rf"(?P<age_min>\d+)\s*-\s*(?P<age_max>\d+)\s*(?:yrs|years)"
_HEADING_BULLET = re.compile(r"^\*\s*\*\*(?P<name>[^*]+)\*\*\s*:\s*$")
_SUB_BULLET = re.compile(
    rf"^\s+[*\-]\s*(?P<sex>Male|Female|All)\b[^(]*\({_AGE_BAND}\)\s*:\s*"
    rf"(?P<low>{_NUM})\s*-\s*(?P<high>{_NUM})\s*(?P<unit>.*)$",
    re.IGNORECASE,
)
_INLINE_BULLET = re.compile(
    rf"^\*\s*\*\*(?P<name>[^*]+)\*\*\s*:\s*(?P<body>.+?)\s*"
    rf"\(Applicable to (?P<sex>Male|Female|All)\w*\s+sex(?:es)?,\s*{_AGE_BAND}\)",
    re.IGNORECASE,
)
_NUMERIC_BODY = re.compile(rf"^(?P<low>{_NUM})\s*-\s*(?P<high>{_NUM})\s*(?P<unit>.*)$")


def _number(text: str) -> Number:
    """'150,000' → 150000, '7.0' → 7.0 (keeps the file's own precision)."""
    text = text.replace(",", "")
    return float(text) if "." in text else int(text)


def _base_name(name: str) -> str:
    """'Hemoglobin (Hb)' → 'Hemoglobin'."""
    return _PARENTHETICAL.sub("", name.replace("*", "")).strip()


def _abbreviation(name: str) -> str | None:
    """'Hemoglobin (Hb)' → 'Hb'; None when there is no parenthesis."""
    match = _PARENTHETICAL.search(name)
    return match.group(1).strip() if match else None


def _sex(text: str) -> RangeSex:
    """'Male'/'female'/'All' (any case) → canonical form."""
    return text.strip().capitalize()  # type: ignore[return-value]


def _cells(line: str) -> list[str]:
    """Cells of a markdown table row, markdown stripped."""
    return [cell.replace("*", "").strip() for cell in line.strip().strip("|").split("|")]


def _files(data_dir: Path, pattern: str) -> list[Path]:
    return sorted(data_dir.glob(pattern))


# --------------------------------------------------------------------------- parsers


def parse_aliases(text: str) -> dict[str, str]:
    """Glossary aliases: abbreviation → canonical name."""
    aliases: dict[str, str] = {}
    for _, line in clean(text):
        for alias, canonical in _ALIAS.findall(line):
            aliases[alias.strip()] = _base_name(canonical)
    return aliases


def parse_urgent(text: str, source_file: str) -> list[UrgentRule]:
    """Rows like `| **Hemoglobin** | Less than | 7.0 | g/dL |`."""
    rules: list[UrgentRule] = []
    for line_no, line in clean(text):
        if not line.strip().startswith("|"):
            continue
        cells = _cells(line)
        if len(cells) < 4 or not re.fullmatch(_NUM, cells[2]):
            continue
        condition = cells[1].lower()
        if condition.startswith("less"):
            op: Literal["<=", ">="] = "<="
        elif condition.startswith("greater"):
            op = ">="
        else:
            continue
        rules.append(UrgentRule(_base_name(cells[0]), op, _number(cells[2]), cells[3], source_file, line_no))
    return rules


def _table_range(line: str, source_file: str, line_no: int) -> RangeRule | None:
    """`| **ALT** | Female | 18 | 100 | 7 | 45 | U/L |`."""
    cells = _cells(line)
    if len(cells) < 7 or cells[1].capitalize() not in {"Male", "Female", "All"}:
        return None
    if not all(re.fullmatch(_NUM, c) for c in cells[2:6]):
        return None
    return RangeRule(
        test=_base_name(cells[0]), sex=_sex(cells[1]),
        age_min=int(cells[2]), age_max=int(cells[3]),
        low=_number(cells[4]), high=_number(cells[5]), text=None,
        unit=cells[6] or None, source_file=source_file, line=line_no,
    )


def _inline_range(match: re.Match[str], source_file: str, line_no: int) -> RangeRule:
    """`* **TSH**: 0.4 - 4.0 mIU/L (Applicable to All sexes, 18-100 yrs)` or a text range."""
    body = match["body"].strip()
    numeric = _NUMERIC_BODY.match(body)
    return RangeRule(
        test=_base_name(match["name"]), sex=_sex(match["sex"]),
        age_min=int(match["age_min"]), age_max=int(match["age_max"]),
        low=_number(numeric["low"]) if numeric else None,
        high=_number(numeric["high"]) if numeric else None,
        text=None if numeric else body,
        unit=(numeric["unit"].strip() or None) if numeric else None,
        source_file=source_file, line=line_no,
    )


def parse_ranges(text: str, source_file: str) -> tuple[list[RangeRule], dict[str, str]]:
    """Read every range format in one file. Also returns abbreviations found in headings."""
    ranges: list[RangeRule] = []
    abbreviations: dict[str, str] = {}
    heading: str | None = None
    for line_no, line in clean(text):
        if line.strip().startswith("|"):
            rule = _table_range(line, source_file, line_no)
        elif inline := _INLINE_BULLET.match(line):
            rule = _inline_range(inline, source_file, line_no)
        elif head := _HEADING_BULLET.match(line):
            heading = _base_name(head["name"])
            if abbreviation := _abbreviation(head["name"]):
                abbreviations[abbreviation] = heading
            continue
        elif (sub := _SUB_BULLET.match(line)) and heading:
            rule = RangeRule(
                test=heading, sex=_sex(sub["sex"]),
                age_min=int(sub["age_min"]), age_max=int(sub["age_max"]),
                low=_number(sub["low"]), high=_number(sub["high"]), text=None,
                unit=sub["unit"].strip() or None, source_file=source_file, line=line_no,
            )
        else:
            continue
        if rule:
            ranges.append(rule)
    return ranges, abbreviations


# --------------------------------------------------------------------------- fallback

_H, _B, _T = "4_ranges_hematology.md", "5_ranges_biochemistry.md", "6_ranges_thyroid_urine.md"
_U = "3_dangerous_urgent_values.md"

FALLBACK_RULES = Rules(
    aliases={
        "SGPT": "ALT", "SGOT": "AST", "FBS": "Fasting Blood Sugar", "Hb": "Hemoglobin",
        "PLT": "Platelet Count", "RBC": "Red Blood Cell Count", "WBC": "White Blood Cell Count",
    },
    ranges=(
        RangeRule("Hemoglobin", "Male", 18, 100, 13.8, 17.2, None, "g/dL", _H, 5),
        RangeRule("Hemoglobin", "Female", 18, 100, 12.1, 15.1, None, "g/dL", _H, 6),
        RangeRule("White Blood Cell Count", "All", 18, 100, 4500, 11000, None, "cells/mcL", _H, 8),
        RangeRule("Platelet Count", "All", 18, 100, 150000, 450000, None, "cells/mcL", _H, 10),
        RangeRule("Fasting Blood Sugar", "All", 18, 100, 70, 99, None, "mg/dL", _B, 4),
        RangeRule("ALT", "Male", 18, 100, 7, 55, None, "U/L", _B, 5),
        RangeRule("ALT", "Female", 18, 100, 7, 45, None, "U/L", _B, 6),
        RangeRule("AST", "Male", 18, 100, 8, 48, None, "U/L", _B, 7),
        RangeRule("AST", "Female", 18, 100, 8, 43, None, "U/L", _B, 8),
        RangeRule("Cholesterol", "All", 18, 100, 125, 200, None, "mg/dL", _B, 9),
        RangeRule("TSH", "All", 18, 100, 0.4, 4.0, None, "mIU/L", _T, 2),
        RangeRule("Urine pH", "All", 18, 100, 4.5, 8.0, None, None, _T, 3),
        RangeRule("Urine Protein", "All", 18, 100, None, None, "Negative", None, _T, 4),
    ),
    urgent=(
        UrgentRule("Hemoglobin", "<=", 7.0, "g/dL", _U, 6),
        UrgentRule("Fasting Blood Sugar", ">=", 300, "mg/dL", _U, 7),
        UrgentRule("Platelet Count", "<=", 50000, "cells/mcL", _U, 8),
        UrgentRule("ALT", ">=", 1000, "U/L", _U, 9),
    ),
    from_files=False,
)


# --------------------------------------------------------------------------- loader


@lru_cache(maxsize=4)
def load_rules(data_dir: Path) -> Rules:
    """Parse aliases, ranges and urgent thresholds from the reference files (cached).

    Each part falls back to `FALLBACK_RULES` independently if its files yield nothing.
    """
    aliases: dict[str, str] = {}
    ranges: list[RangeRule] = []
    urgent: list[UrgentRule] = []
    for path in _files(data_dir, "*glossary*.md"):
        aliases.update(parse_aliases(path.read_text(encoding="utf-8")))
    for path in _files(data_dir, "*ranges*.md"):
        file_ranges, abbreviations = parse_ranges(path.read_text(encoding="utf-8"), path.name)
        ranges.extend(file_ranges)
        for short, full in abbreviations.items():
            aliases.setdefault(short, full)
    for path in _files(data_dir, "*urgent*.md"):
        urgent.extend(parse_urgent(path.read_text(encoding="utf-8"), path.name))

    from_files = True
    if not aliases:
        logger.warning("No aliases parsed from %s; using FALLBACK_RULES aliases", data_dir)
        aliases, from_files = dict(FALLBACK_RULES.aliases), False
    if not ranges:
        logger.warning("No ranges parsed from %s; using FALLBACK_RULES ranges", data_dir)
        ranges, from_files = list(FALLBACK_RULES.ranges), False
    if not urgent:
        logger.warning("No urgent thresholds parsed from %s; using FALLBACK_RULES urgent", data_dir)
        urgent, from_files = list(FALLBACK_RULES.urgent), False
    return Rules(aliases=aliases, ranges=tuple(ranges), urgent=tuple(urgent), from_files=from_files)
