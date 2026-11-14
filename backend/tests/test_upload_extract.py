"""Step 8 + Part 2: LLM fallback extractor and POST /api/upload."""

from fastapi.testclient import TestClient

from app.config import settings
from app.llm.base import LLMError
from app.main import app
from app.upload import MAX_BYTES
from tests.fakes import FakeProvider, read_log

client = TestClient(app)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64
TRANSCRIPT = (
    "Patient Full Name: Sam Lee\nRecorded Age: 30\nBiological Sex: Female\nMedical Record Number: X-1\n"
    "Hemoglobin: 13.2 g/dL\nPlatelet Count: [UNREADABLE] cells/mcL\nWBC: [UNREADABLE]"
)


def make_pdf(lines: list[str]) -> bytes:
    """A tiny valid one-page PDF with a real text layer (built by hand, no extra libraries)."""
    text_ops = "".join(f"({line}) Tj T* " for line in lines)
    stream = f"BT /F1 11 Tf 14 TL 50 780 Td {text_ops}ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def _upload(data: bytes, content_type: str, name: str = "report"):
    return client.post("/api/upload", files={"file": (name, data, content_type)})


# --------------------------------------------------------------------------- upload


def test_text_pdf_goes_through_pypdf_without_ai(use_provider) -> None:
    fake = use_provider(FakeProvider("should not be used"))
    pdf = make_pdf(["Patient Full Name: Sam Lee", "Recorded Age: 30", "Biological Sex: Female", "Hemoglobin: 13.5 g/dL", "TSH: 2.5 mIU/L"])
    body = _upload(pdf, "application/pdf").json()
    assert body["extracted_by"] == "pypdf"
    assert "Hemoglobin: 13.5 g/dL" in body["report_text"]
    assert body["warnings"] == []
    assert fake.calls == []


def test_uploaded_text_then_analyzes() -> None:
    pdf = make_pdf(["Recorded Age: 30", "Biological Sex: Female", "Hemoglobin: 13.5 g/dL"])
    text = _upload(pdf, "application/pdf").json()["report_text"]
    result = client.post("/api/analyze", params={"explain": "false"}, json={"report_text": text}).json()
    assert result["results"][0]["status"] == "normal"


def test_scanned_pdf_falls_back_to_transcription(use_provider) -> None:
    fake = use_provider(FakeProvider(TRANSCRIPT))
    body = _upload(make_pdf([]), "application/pdf").json()
    assert fake.calls == [("transcribe", "application/pdf")]
    assert body["extracted_by"] == "fake/fake-model-1"


def test_photo_is_transcribed_with_warnings_and_logged_without_contents(use_provider) -> None:
    use_provider(FakeProvider(TRANSCRIPT))
    body = _upload(PNG, "image/png").json()
    assert body["extracted_by"] == "fake/fake-model-1"
    assert "Hemoglobin: 13.2 g/dL" in body["report_text"]
    assert body["warnings"] == ["2 parts unreadable"]
    (record,) = read_log(settings.usage_log_path)
    assert (record["operation"], record["ok"]) == ("transcribe", True)
    assert "Sam" not in settings.usage_log_path.read_text()


def test_photo_transcription_retries_on_rate_limit(use_provider) -> None:
    fake = use_provider(FakeProvider(LLMError("rate_limit", "HTTP 429", retryable=True), TRANSCRIPT))
    assert _upload(JPEG, "image/jpeg").status_code == 200
    assert len(fake.calls) == 2


def test_webp_is_accepted(use_provider) -> None:
    use_provider(FakeProvider(TRANSCRIPT))
    assert _upload(WEBP, "image/webp").status_code == 200


def test_wrong_type_is_rejected() -> None:
    response = _upload(b"hello world", "text/plain")
    assert (response.status_code, response.json()["code"]) == (415, "unsupported_type")


def test_content_type_must_match_magic_bytes() -> None:
    response = _upload(b"%PDF-1.4 pretending", "image/png")
    assert (response.status_code, response.json()["code"]) == (415, "unsupported_type")


def test_oversize_is_rejected() -> None:
    response = _upload(PNG + b"\x00" * MAX_BYTES, "image/png")
    assert (response.status_code, response.json()["code"]) == (413, "file_too_large")


def test_photo_offline_is_friendly_ai_unavailable() -> None:
    response = _upload(PNG, "image/png")
    assert (response.status_code, response.json()["code"]) == (503, "ai_unavailable")


def test_blurry_photo_is_unreadable(use_provider) -> None:
    use_provider(FakeProvider("[UNREADABLE]\n[UNREADABLE]"))
    response = _upload(PNG, "image/png")
    assert (response.status_code, response.json()["code"]) == (422, "unreadable_image")


def test_corrupt_pdf_is_unreadable() -> None:
    response = _upload(b"%PDF-1.4 garbage without structure", "application/pdf")
    assert response.json()["code"] in ("unreadable_image", "ai_unavailable")
    assert response.status_code in (422, 503)


# --------------------------------------------------------------------------- LLM extractor


ODD_REPORT = "Lab printout\nHAEMOGLOBIN ..... 6.8 g/dL ..... flagged\nGlucose fasting ..... 92 mg/dL"


def test_llm_extractor_used_when_regex_finds_nothing(use_provider) -> None:
    reply = '{"tests": [{"name": "Hemoglobin", "value": "6.8", "unit": "g/dL"}, {"name": "Glucose (Fasting)", "value": "92", "unit": "mg/dL"}]}'
    use_provider(FakeProvider(reply))
    body = client.post("/api/analyze", params={"explain": "false"}, json={"report_text": ODD_REPORT, "age": 30, "sex": "F"}).json()
    hb, fbs = body["results"]
    assert (hb["status"], hb["is_urgent"], hb["extracted_by"], hb["source"]["line"]) == ("urgent", True, "llm", 0)
    assert (fbs["canonical_name"], fbs["status"]) == ("Fasting Blood Sugar", "normal")


def test_llm_extractor_drops_invented_values(use_provider) -> None:
    use_provider(FakeProvider('{"tests": [{"name": "Hemoglobin", "value": "11.0", "unit": "g/dL"}]}'))
    response = client.post("/api/analyze", params={"explain": "false"}, json={"report_text": ODD_REPORT})
    assert (response.status_code, response.json()["code"]) == (422, "no_tests_found")


def test_regex_reports_never_call_the_extractor(use_provider) -> None:
    fake = use_provider(FakeProvider('{"tests": []}'))
    client.post("/api/analyze", params={"explain": "false"}, json={"report_text": "TSH: 2.5 mIU/L"})
    assert fake.calls == []
