"""Step 3 — NORMALIZE: canonical test names and explicit, shown-in-full unit conversions."""

import re
from dataclasses import dataclass

from app.models import Conversion
from app.pipeline.rules import CONTEXT_ALIASES, Rules

GLOSSARY_FILE = "2_medical_glossary.md"
_STRIP_WORDS = re.compile(r"\b(?:serum|blood)\b|\([^)]*\)", re.IGNORECASE)


class UnitConversionError(ValueError):
    """The report's unit cannot be converted to the range's unit with the explicit table."""


def format_number(value: int | float) -> str:
    """Show a number without float noise: 45 → '45', 6.0 → '6.0', 18.016 → '18.016'."""
    if isinstance(value, int):
        return str(value)
    return f"{value:.1f}" if abs(value - round(value, 1)) < 1e-9 else f"{value:g}"


# --------------------------------------------------------------------------- names


def _lookup(name: str, mapping: dict[str, str]) -> str | None:
    """Case-insensitive dictionary lookup."""
    lowered = name.lower()
    return next((v for k, v in mapping.items() if k.lower() == lowered), None)


def canonical(name: str, rules: Rules) -> tuple[str | None, str | None]:
    """Map a report name to a canonical test name. Returns `(canonical, alias_note)`.

    Order: exact range name → glossary alias → context alias → retry without
    'Serum'/'Blood'/parentheses. Returns `(None, None)` when nothing matches.
    """
    range_names = {r.test.lower(): r.test for r in rules.ranges}
    candidates = [name.strip()]
    stripped = " ".join(_STRIP_WORDS.sub(" ", name).split())
    if stripped and stripped.lower() != name.strip().lower():
        candidates.append(stripped)

    for candidate in candidates:
        if candidate.lower() in range_names:
            return range_names[candidate.lower()], None
        if target := _lookup(candidate, rules.aliases):
            return target, f"{name} = {target} (from {GLOSSARY_FILE})"
        if target := _lookup(candidate, CONTEXT_ALIASES):
            return target, f"{name} = {target} (context mapping, documented assumption)"
    return None, None


# --------------------------------------------------------------------------- units


def unit_key(unit: str | None) -> str:
    """Spelling-independent unit key: 'cells/mcL', '/µL', '/mm³' → '/ul'; '×10³/µL' → '10^3/ul'."""
    key = (unit or "").lower().replace(" ", "").replace("cells", "")
    for old, new in (("µ", "u"), ("μ", "u"), ("mcl", "ul"), ("mcg", "ug"), ("mm³", "ul"), ("mm3", "ul")):
        key = key.replace(old, new)
    key = re.sub(r"^(?:x|×|\*)?(?:10\^?3|10³|k|thou)/", "10^3/", key)
    key = re.sub(r"^(?:x|×|\*)?(?:10\^?9|10⁹)/", "10^9/", key)
    return key


@dataclass(frozen=True)
class _Factor:
    """One explicit conversion: multiply by `factor` (shown as ÷ when `divide`)."""

    factor: float
    divide: bool = False
    note: str | None = None
    test: str | None = None  # None = applies to any test


_CONVERSIONS: dict[tuple[str, str], list[_Factor]] = {
    ("mmol/l", "mg/dl"): [
        _Factor(18.016, note="glucose molar mass 180.16 g/mol; standard constant", test="Fasting Blood Sugar"),
        _Factor(38.67, note="cholesterol standard constant", test="Cholesterol"),
    ],
    ("g/l", "g/dl"): [_Factor(10, divide=True, test="Hemoglobin")],
    ("10^3/ul", "/ul"): [_Factor(1000)],
    ("10^9/l", "/ul"): [_Factor(1000)],
    ("iu/l", "u/l"): [_Factor(1, note="same unit for enzymes")],
    ("uiu/ml", "miu/l"): [_Factor(1, note="same unit for TSH")],
}


def _round(value: float) -> int | float:
    """One decimal place, the precision lab values are reported in; large counts as whole numbers."""
    rounded = round(value, 1)
    return int(rounded) if abs(rounded) >= 1000 and rounded == int(rounded) else rounded


def convert(value: int | float, unit_from: str | None, unit_to: str | None, test: str) -> Conversion | None:
    """Convert `value` from the report's unit to the range's unit, showing the math.

    Returns None when the units are already the same. Raises `UnitConversionError` when the
    conversion is not in the explicit table (we never guess a factor).
    """
    source, target = unit_key(unit_from), unit_key(unit_to)
    if source == target:
        return None
    factors = [f for f in _CONVERSIONS.get((source, target), []) if f.test in (None, test)]
    if not factors:
        raise UnitConversionError(f"{unit_from or 'no unit'} → {unit_to or 'no unit'}")
    rule = factors[0]
    result = _round(value / rule.factor if rule.divide else value * rule.factor)
    symbol = "÷" if rule.divide else "×"
    steps = (
        f"{format_number(value)} {unit_from} {symbol} {format_number(rule.factor)} "
        f"= {format_number(result)} {unit_to}"
    )
    if rule.note:
        steps += f" ({rule.note})"
    return Conversion(value=result, unit=unit_to or "", steps=steps)
