"""Turn an uploaded PDF or photo into report text. It does NOT classify.

The user checks or edits the text, then the frontend sends it to POST /api/analyze — so
a misread number is caught by a human before any status is computed.

* Size ≤ 4 MB; type must match BOTH the declared content type and the file's magic bytes.
* Text PDFs → `pypdf` (no AI). Scanned PDFs and photos → the provider's `transcribe`.
* File contents are never logged.
"""

import io
import logging
import re

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.errors import AppError
from app.llm import factory
from app.llm.base import LLMError
from app.models import UploadResponse
from app.pipeline.clean import clean
from app.pipeline.parse import parse_report

logger = logging.getLogger(__name__)

MAX_BYTES = 4 * 1024 * 1024
MIN_MEANINGFUL_CHARS = 30
MAX_PDF_PAGES = 10
UNREADABLE = "[UNREADABLE]"

_MAGIC: dict[str, tuple[bytes, ...]] = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "application/pdf": (b"%PDF-",),
}


def _matches_magic(content_type: str, data: bytes) -> bool:
    """True if the first bytes match the declared type (WEBP = 'RIFF....WEBP')."""
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return any(data.startswith(magic) for magic in _MAGIC.get(content_type, ()))


def validate_upload(content_type: str | None, data: bytes) -> str:
    """Check size and type; return the normalised content type or raise a friendly AppError."""
    if len(data) > MAX_BYTES:
        raise AppError(413, "file_too_large", "This file is larger than 4 MB. Please upload a smaller photo or PDF.")
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime not in (*_MAGIC, "image/webp") or not _matches_magic(mime, data):
        raise AppError(415, "unsupported_type", "Please upload a JPEG, PNG or WEBP photo, or a PDF.")
    return mime


def _meaningful_chars(text: str) -> int:
    """Letters and digits, ignoring [UNREADABLE] markers and whitespace."""
    return len(re.findall(r"[^\W_]", text.replace(UNREADABLE, "")))


def _pdf_text(data: bytes) -> str:
    """Text layer of the first pages of a PDF ('' for a scan)."""
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages[:MAX_PDF_PAGES])
    except (PyPdfError, ValueError, KeyError, TypeError) as exc:
        logger.info("pypdf could not read the upload (%s)", type(exc).__name__)
        raise AppError(422, "unreadable_image", "We couldn't read this PDF. Please try a photo of the report instead.") from exc


def _transcribe(data: bytes, mime: str) -> tuple[str, str]:
    """Read a photo or scanned PDF with the AI provider. Returns (text, 'provider/model')."""
    try:
        result = factory.call_with_retry("transcribe", lambda p: p.transcribe(data, mime))
    except LLMError as error:
        raise AppError(
            503, "ai_unavailable",
            "Reading photos needs the AI service, which is unavailable right now. Please paste the report text instead.",
        ) from error
    return result.text, f"{result.provider}/{result.model}"


def _warnings(text: str) -> list[str]:
    """Hints for the user before they confirm the text."""
    warnings: list[str] = []
    unreadable = text.count(UNREADABLE)
    if unreadable:
        warnings.append(f"{unreadable} part{'s' if unreadable > 1 else ''} unreadable")
    if not parse_report(text).tests:
        warnings.append("No test lines recognised — please check the text before analyzing")
    return warnings


def read_upload(content_type: str | None, data: bytes) -> UploadResponse:
    """Validate the file and extract its text (pypdf first, AI transcription for images and scans)."""
    mime = validate_upload(content_type, data)
    text, extracted_by = "", "pypdf"
    if mime == "application/pdf":
        text = _pdf_text(data)
    if _meaningful_chars(text) < MIN_MEANINGFUL_CHARS:
        text, extracted_by = _transcribe(data, mime)
        if _meaningful_chars(text) < MIN_MEANINGFUL_CHARS:
            raise AppError(422, "unreadable_image", "The photo is too unclear to read. Please retake it in good light, flat and in focus.")
    report_text = "\n".join(line for _, line in clean(text)).strip()
    return UploadResponse(report_text=report_text, extracted_by=extracted_by, warnings=_warnings(report_text))
