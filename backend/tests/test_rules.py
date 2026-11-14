"""Tests for step 3: rules are read from the lab's reference files."""

import shutil
from pathlib import Path

import pytest

from app.config import settings
from app.pipeline.rules import FALLBACK_RULES, load_rules


def test_rules_come_from_files(rules) -> None:
    assert rules.from_files is True


def test_glossary_aliases(rules) -> None:
    assert rules.aliases["SGPT"] == "ALT"
    assert rules.aliases["SGOT"] == "AST"
    assert rules.aliases["FBS"] == "Fasting Blood Sugar"
    assert rules.aliases["Hb"] == "Hemoglobin"
    assert rules.aliases["PLT"] == "Platelet Count"
    assert rules.aliases["WBC"] == "White Blood Cell Count"


@pytest.mark.parametrize(
    "test, sex, low, high, unit, source",
    [
        ("Hemoglobin", "Male", 13.8, 17.2, "g/dL", "4_ranges_hematology.md"),
        ("Hemoglobin", "Female", 12.1, 15.1, "g/dL", "4_ranges_hematology.md"),
        ("White Blood Cell Count", "All", 4500, 11000, "cells/mcL", "4_ranges_hematology.md"),
        ("Platelet Count", "All", 150000, 450000, "cells/mcL", "4_ranges_hematology.md"),
        ("Fasting Blood Sugar", "All", 70, 99, "mg/dL", "5_ranges_biochemistry.md"),
        ("ALT", "Male", 7, 55, "U/L", "5_ranges_biochemistry.md"),
        ("ALT", "Female", 7, 45, "U/L", "5_ranges_biochemistry.md"),
        ("AST", "Male", 8, 48, "U/L", "5_ranges_biochemistry.md"),
        ("AST", "Female", 8, 43, "U/L", "5_ranges_biochemistry.md"),
        ("Cholesterol", "All", 125, 200, "mg/dL", "5_ranges_biochemistry.md"),
        ("TSH", "All", 0.4, 4.0, "mIU/L", "6_ranges_thyroid_urine.md"),
        ("Urine pH", "All", 4.5, 8.0, None, "6_ranges_thyroid_urine.md"),
    ],
)
def test_parsed_range_numbers(rules, test, sex, low, high, unit, source) -> None:
    (row,) = [r for r in rules.ranges_for(test) if r.sex == sex]
    assert (row.low, row.high, row.unit, row.source_file) == (low, high, unit, source)
    assert (row.age_min, row.age_max) == (18, 100)


def test_text_range_for_urine_protein(rules) -> None:
    (row,) = rules.ranges_for("Urine Protein")
    assert (row.text, row.low, row.high) == ("Negative", None, None)


def test_urgent_thresholds_are_inclusive(rules) -> None:
    by_test = {u.test: u for u in rules.urgent}
    assert (by_test["Hemoglobin"].op, by_test["Hemoglobin"].value) == ("<=", 7.0)
    assert (by_test["Fasting Blood Sugar"].op, by_test["Fasting Blood Sugar"].value) == (">=", 300)
    assert (by_test["Platelet Count"].op, by_test["Platelet Count"].value) == ("<=", 50000)
    assert (by_test["ALT"].op, by_test["ALT"].value) == (">=", 1000)
    assert by_test["Hemoglobin"].is_triggered(7.0) and not by_test["Hemoglobin"].is_triggered(7.1)


def test_parsed_rules_match_the_hand_written_fallback(rules) -> None:
    assert rules.ranges == FALLBACK_RULES.ranges
    assert rules.urgent == FALLBACK_RULES.urgent


def test_changed_file_number_is_followed(tmp_path: Path) -> None:
    for path in settings.data_dir.glob("[1-6]_*.md"):
        shutil.copy(path, tmp_path / path.name)
    sheet = tmp_path / "5_ranges_biochemistry.md"
    sheet.write_text(sheet.read_text().replace("| 125 | 200 |", "| 125 | 190 |"))
    (row,) = load_rules(tmp_path).ranges_for("Cholesterol")
    assert row.high == 190


def test_missing_files_use_fallback(tmp_path: Path) -> None:
    rules = load_rules(tmp_path)
    assert rules.from_files is False
    assert rules.ranges == FALLBACK_RULES.ranges
