"""HTTP tests for the routes (step 5)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_patient_list_matches_contract() -> None:
    patients = client.get("/api/patients").json()
    assert len(patients) == 14
    p004 = next(p for p in patients if p["id"] == "P004")
    assert p004 == {
        "id": "P004", "name": "Diana Prince", "age": 42, "sex": "Female", "mrn": "CLD-P004-9942",
        "file": "report_P004_Diana_Prince_Hem_Urgent.md", "test_count": 2,
    }


def test_analysis_shape_for_urgent_patient() -> None:
    body = client.get("/api/patients/P004/analysis").json()
    assert body["patient"]["id"] == "P004"
    assert body["urgent_banner"]
    hb = body["results"][0]
    assert (hb["canonical_name"], hb["status"], hb["is_urgent"]) == ("Hemoglobin", "urgent", True)
    assert hb["range"]["source_file"] == "4_ranges_hematology.md"
    assert hb["source"] == {"file": "report_P004_Diana_Prince_Hem_Urgent.md", "line": 12}
    assert body["disclaimer"]


def test_patient_id_is_case_insensitive() -> None:
    assert client.get("/api/patients/p014/analysis").status_code == 200


@pytest.mark.parametrize("sex, status", [("Female", "high"), ("female", "high"), ("M", "normal")])
def test_sex_override_reclassifies(sex: str, status: str) -> None:
    body = client.get("/api/patients/P012/analysis", params={"sex": sex}).json()
    assert body["results"][0]["status"] == status
    assert body["missing_info"] == []
    assert body["patient"]["sex"] in ("Male", "Female")


def test_missing_info_and_ask_message() -> None:
    body = client.get("/api/patients/P012/analysis").json()
    assert body["missing_info"] == ["sex"]
    assert "Male or Female" in body["ask_message"]


def test_unknown_patient_is_friendly_404() -> None:
    response = client.get("/api/patients/P999/analysis")
    assert response.status_code == 404
    assert response.json()["error"] == "Patient not found"
    assert response.json()["code"] == "not_found"
    assert response.json()["request_id"] == response.headers["X-Request-Id"]


def test_invalid_sex_is_friendly_422() -> None:
    response = client.get("/api/patients/P012/analysis", params={"sex": "robot"})
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_input"
    assert "Male or Female" in response.json()["error"]


def test_analyze_pasted_report() -> None:
    text = "Name: Sam Lee\nAge: 30\nSex: Female\nHb: 70 g/L\n"
    body = client.post("/api/analyze", json={"report_text": text}).json()
    assert body["patient"]["id"] == "custom"
    (hb,) = body["results"]
    assert (hb["status"], hb["converted"]["value"]) == ("urgent", 7.0)


def test_analyze_age_override() -> None:
    body = client.post("/api/analyze", json={"report_text": "TSH: 2.5 mIU/L", "age": 40}).json()
    assert body["results"][0]["status"] == "normal"


@pytest.mark.parametrize("text", ["   ", "hello there, nothing to see"])
def test_analyze_garbage_is_friendly(text: str) -> None:
    response = client.post("/api/analyze", json={"report_text": text})
    assert response.status_code == 422
    assert "Traceback" not in response.text


def test_rules_endpoint() -> None:
    body = client.get("/api/rules").json()
    assert body["aliases"]["SGPT"] == "ALT"
    assert {"test": "ALT", "sex": "Female", "age_min": 18, "age_max": 100, "low": 7, "high": 45,
            "text": None, "unit": "U/L", "source_file": "5_ranges_biochemistry.md"} in body["ranges"]
    assert {"test": "Hemoglobin", "op": "<=", "value": 7.0, "unit": "g/dL"} in body["urgent"]
    assert "NORMAL" in body["edge_rule"]


def test_request_id_header_on_every_response_and_echoed() -> None:
    assert client.get("/api/health").headers["X-Request-Id"]
    assert client.get("/api/health", headers={"X-Request-Id": "trace-123"}).headers["X-Request-Id"] == "trace-123"


def test_unknown_route_is_json_404() -> None:
    response = client.get("/api/nope")
    assert (response.status_code, response.json()["code"]) == (404, "not_found")


def test_unexpected_error_hides_details(monkeypatch) -> None:
    def boom(*_args, **_kwargs):
        raise RuntimeError("secret provider url https://internal")

    monkeypatch.setattr("app.main.get_report", boom)
    response = client.get("/api/patients/P001/analysis")
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert "internal" not in response.json()["error"] and "secret" not in response.text
    assert response.headers["X-Request-Id"] == response.json()["request_id"]
