"""Step 6 — GUARD: the safety rules from `1_lab_safety_rules.md`, enforced in code.

* Privacy lock (rule 1): refuse any chat message that mentions another patient.
* No diagnosis (rule 2): detect "you have diabetes"-style sentences in AI output so the
  caller can regenerate or fall back to template text.
* Status lock: detect AI text that calls an abnormal result "normal".
"""

import re
from dataclasses import dataclass

from app.models import Source, Status

SAFETY_FILE = "1_lab_safety_rules.md"
PRIVACY_RULE_SOURCE = Source(file=SAFETY_FILE, line=3)


@dataclass(frozen=True)
class KnownPatient:
    """Identifiers of one patient, used only to detect cross-patient questions."""

    id: str
    name: str | None
    mrn: str | None


# --------------------------------------------------------------------------- privacy

_GROUP_REQUEST = re.compile(
    r"\b(?:other|another|all|every|any)\s+patients?\b|\beveryone(?:'s)?\b|\beverybody(?:'s)?\b"
    r"|\bsomeone else(?:'s)?\b|\bpatient list\b|دوسرے مریض|تمام مریض",
    re.IGNORECASE,
)
_PATIENT_ID = re.compile(r"\bP\d{3}\b", re.IGNORECASE)


def _mentions_name(message: str, name: str) -> bool:
    """Full name or first name (any case) → match. A last name only counts when capitalised,
    so everyday words like 'my child' or 'I drew blood' are not mistaken for 'Child'/'Drew'."""
    parts = name.split()
    if re.search(rf"\b{re.escape(name)}\b", message, re.IGNORECASE):
        return True
    if parts and re.search(rf"\b{re.escape(parts[0])}\b", message, re.IGNORECASE):
        return True
    return any(re.search(rf"\b{re.escape(last)}\b", message) for last in parts[1:])


def is_cross_patient_request(message: str, current: KnownPatient, others: list[KnownPatient]) -> bool:
    """True if the message asks about any patient other than the one currently open."""
    if _GROUP_REQUEST.search(message):
        return True
    for patient_id in _PATIENT_ID.findall(message):
        if patient_id.upper() != current.id.upper():
            return True
    own_names = set((current.name or "").lower().split())
    for other in others:
        if other.id == current.id:
            continue
        if other.mrn and other.mrn.lower() in message.lower():
            return True
        if other.name and other.name.lower() != (current.name or "").lower():
            distinct = " ".join(p for p in other.name.split() if p.lower() not in own_names)
            if distinct and _mentions_name(message, distinct):
                return True
    return False


# --------------------------------------------------------------------------- diagnosis

_CONDITIONS = (
    r"diabetes|pre-?diabetes|an(?:a)?emia|hepatitis|cirrhosis|fatty liver|liver (?:disease|damage|failure)"
    r"|kidney (?:disease|failure)|cancer|leuk(?:a)?emia|infection|thyroid disease|hypo-?thyroidism"
    r"|hyper-?thyroidism|thrombocytopenia|leukocytosis|hyperglyc(?:a)?emia|hypoglyc(?:a)?emia"
    r"|high cholesterol|hypercholesterol(?:a)?emia|a disease|an illness|a disorder|a condition|a syndrome"
)
_DIAGNOSIS = [
    re.compile(
        rf"\byou(?:'ve| have| has| are suffering from| suffer from| are diagnosed with| have got|'ve got)\s+(?:{_CONDITIONS})\b",
        re.IGNORECASE,
    ),
    re.compile(r"\byou(?:'re| are)\s+(?:diabetic|an(?:a)?emic|pre-?diabetic)\b", re.IGNORECASE),
    re.compile(r"\b(?:you were|you are|you're|been) diagnosed (?:with|as)\b", re.IGNORECASE),
    re.compile(r"\b(?:this|these results?|your results?) (?:means?|confirms?|shows?|proves?) (?:that )?you have\b", re.IGNORECASE),
    re.compile(r"آپ کو\s+\S*\s*(?:ذیابیطس|شوگر کی بیماری|خون کی کمی|ہیپاٹائٹس|کینسر|بیماری)\s+ہے"),
]


def contains_diagnosis(text: str) -> bool:
    """True if the text states or implies that the patient has a disease."""
    return any(pattern.search(text) for pattern in _DIAGNOSIS)


_DIAGNOSIS_QUESTION = re.compile(
    r"\bdo i have\b|\bam i (?:sick|ill|diabetic|anemic)\b|\bwhat (?:disease|illness|condition)\b|\bdiagnos"
    r"|کیا مجھے .*(?:بیماری|ذیابیطس|شوگر)|مجھے کیا بیماری",
    re.IGNORECASE,
)


def asks_for_diagnosis(message: str) -> bool:
    """True if the user is asking what disease they have."""
    return bool(_DIAGNOSIS_QUESTION.search(message))


# --------------------------------------------------------------------------- status lock

_CALLED_NORMAL = re.compile(
    r"\b(?:is|are|looks?|seems?)\s+(?:completely |perfectly |totally )?normal\b|\bwithin (?:the )?normal range\b"
    r"|\bnothing to worry\b",
    re.IGNORECASE,
)


def contradicts_status(text: str, status: Status) -> bool:
    """True if AI text calls an abnormal (low/high/urgent) result normal or harmless."""
    return status in ("low", "high", "urgent") and bool(_CALLED_NORMAL.search(text))
