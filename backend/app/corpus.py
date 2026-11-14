"""The patient reports shipped in `data/lab_reports/`, loaded into memory once."""

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.errors import AppError
from app.models import PatientSummary
from app.pipeline.parse import ParsedReport, parse_report

_PATIENT_ID = re.compile(r"^report_(P\d+)_", re.IGNORECASE)


@dataclass(frozen=True)
class CorpusReport:
    """One stored report, already parsed."""

    id: str
    file: str
    parsed: ParsedReport

    def summary(self) -> PatientSummary:
        """The row shown in the patient list."""
        demo = self.parsed.demographics
        return PatientSummary(
            id=self.id, name=demo.name, age=demo.age, sex=demo.sex, mrn=demo.mrn,
            file=self.file, test_count=len(self.parsed.tests),
        )


@lru_cache(maxsize=4)
def load_corpus(data_dir: Path) -> dict[str, CorpusReport]:
    """Parse every `report_P0xx_*.md` file, keyed by patient ID (e.g. 'P004'), in ID order."""
    reports: dict[str, CorpusReport] = {}
    for path in sorted(data_dir.glob("report_*.md")):
        match = _PATIENT_ID.match(path.name)
        if match:
            patient_id = match.group(1).upper()
            reports[patient_id] = CorpusReport(patient_id, path.name, parse_report(path.read_text(encoding="utf-8")))
    return reports


def corpus() -> dict[str, CorpusReport]:
    """The configured corpus."""
    return load_corpus(settings.data_dir)


def get_report(patient_id: str) -> CorpusReport:
    """Look up a stored report by ID (case-insensitive). Raises a 404 AppError if unknown."""
    report = corpus().get(patient_id.strip().upper())
    if report is None:
        raise AppError(404, "not_found", "Patient not found")
    return report
