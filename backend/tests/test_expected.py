"""Expected-answer suite: one test per row of the table in documents/DDS.md §3."""


def _by_name(classification) -> dict:
    return {r.canonical_name or r.name_in_report: r for r in classification.results}


def test_p001_cbc_normal(classify_patient) -> None:
    results = _by_name(classify_patient("P001"))
    hb, wbc = results["Hemoglobin"], results["White Blood Cell Count"]
    assert (hb.value, hb.status, hb.range.sex, hb.range.low, hb.range.high) == (13.5, "normal", "Female", 12.1, 15.1)
    assert (wbc.value, wbc.status) == (6000, "normal")


def test_p002_sgpt_alias_female_range_on_limit(classify_patient) -> None:
    (alt,) = classify_patient("P002").results
    assert (alt.name_in_report, alt.canonical_name, alt.value) == ("SGPT", "ALT", 45)
    assert (alt.range.sex, alt.range.low, alt.range.high) == ("Female", 7, 45)
    assert alt.status == "normal"
    assert "SGPT = ALT" in alt.alias_note


def test_p003_missing_age_and_sex_needs_info(classify_patient) -> None:
    result = classify_patient("P003")
    (fbs,) = result.results
    assert (fbs.canonical_name, fbs.status, fbs.range) == ("Fasting Blood Sugar", "needs_info", None)
    assert result.missing_info == ["age", "sex"]
    assert result.ask_message


def test_p004_hemoglobin_urgent_platelets_low(classify_patient) -> None:
    result = classify_patient("P004")
    results = _by_name(result)
    hb, plt = results["Hemoglobin"], results["Platelet Count"]
    assert (hb.value, hb.status, hb.is_urgent) == (6.5, "urgent", True)
    assert "LOW" in hb.reason
    assert (plt.value, plt.status, plt.is_urgent) == (120000, "low", False)
    assert result.urgent_banner


def test_p005_glucose_unit_conversion(classify_patient) -> None:
    (fbs,) = classify_patient("P005").results
    assert (fbs.value, fbs.unit) == (6.0, "mmol/L")
    assert (fbs.converted.value, fbs.converted.unit) == (108.1, "mg/dL")
    assert "18.016" in fbs.converted.steps
    assert fbs.status == "high"


def test_p006_unknown_test_cannot_classify(classify_patient) -> None:
    (ferritin,) = classify_patient("P006").results
    assert (ferritin.name_in_report, ferritin.status, ferritin.range) == ("Serum Ferritin", "cannot_classify", None)
    assert "cannot be classified from the files" in ferritin.reason


def test_p007_tsh_normal(classify_patient) -> None:
    (tsh,) = classify_patient("P007").results
    assert (tsh.canonical_name, tsh.value, tsh.status) == ("TSH", 2.5, "normal")


def test_p008_urine_context_aliases(classify_patient) -> None:
    results = _by_name(classify_patient("P008"))
    assert (results["Urine pH"].name_in_report, results["Urine pH"].status) == ("pH Level", "normal")
    assert (results["Urine Protein"].value, results["Urine Protein"].status) == ("Negative", "normal")


def test_p009_liver_high_not_urgent(classify_patient) -> None:
    result = classify_patient("P009")
    results = _by_name(result)
    assert (results["ALT"].value, results["ALT"].status) == (85, "high")
    assert (results["AST"].value, results["AST"].status) == (60, "high")
    assert result.urgent_banner is None


def test_p010_cholesterol_on_limit_normal(classify_patient) -> None:
    (chol,) = classify_patient("P010").results
    assert (chol.value, chol.status) == (200, "normal")


def test_p011_wbc_high_platelets_low(classify_patient) -> None:
    results = _by_name(classify_patient("P011"))
    assert (results["White Blood Cell Count"].value, results["White Blood Cell Count"].status) == (12000, "high")
    assert (results["Platelet Count"].value, results["Platelet Count"].status) == (140000, "low")


def test_p012_missing_sex_then_supplied(classify_patient) -> None:
    result = classify_patient("P012")
    (ast,) = result.results
    assert (ast.status, ast.range) == ("needs_info", None)
    assert result.missing_info == ["sex"]

    (female,) = classify_patient("P012", sex="Female").results
    assert (female.status, female.range.low, female.range.high) == ("high", 8, 43)

    (male,) = classify_patient("P012", sex="Male").results
    assert male.status == "normal"


def test_p013_sugar_high_and_urgent(classify_patient) -> None:
    result = classify_patient("P013")
    (fbs,) = result.results
    assert (fbs.value, fbs.status, fbs.is_urgent) == (350, "urgent", True)
    assert "HIGH" in fbs.reason
    assert result.urgent_banner


def test_p014_aliases_normal(classify_patient) -> None:
    results = _by_name(classify_patient("P014"))
    assert (results["Fasting Blood Sugar"].name_in_report, results["Fasting Blood Sugar"].status) == ("FBS", "normal")
    assert (results["AST"].name_in_report, results["AST"].value, results["AST"].status) == ("SGOT", 22, "normal")
