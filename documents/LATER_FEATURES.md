# Later features — do ONLY after the core works and is deployed
Order: core + tests + deploy → 1 → 2 → 3 → 4 → 5. Stop adding features at about 2:00 (README, video, submit).

## 1. Must-have usability (frontend, ~30 min)
- Skeleton loaders with step messages: "Reading report…" → "Checking ranges…" → "Writing explanation…"
- After 8 s: "Taking longer than usual" + Retry; fetch timeout 20 s with one automatic retry
- Offline banner (`navigator.onLine`)
- Save the last patient and analysis in localStorage → restore on reload
- Friendly error toasts, never raw errors
- Show statuses first; AI explanations fill in after

## 2. Camera / PDF upload (~30–40 min)
**Backend:** `POST /api/upload` (multipart `file`, max 4 MB, jpeg/png/pdf).
- PDF → `pypdf` text; if little or no text, treat it as a scan.
- Image or scan → LLM via the provider interface: "Transcribe this lab report exactly as written: name, age, sex, MRN, each test as `Name: value unit`. Do not interpret, add or correct. Write [UNREADABLE] for unclear parts."
- Return `{report_text, extracted_by}`. Don't classify here.
- Log usage. Add `pypdf` and `python-multipart` to requirements.

**Frontend:** "Scan or upload report" button: `<input type="file" accept="image/*,application/pdf" capture="environment">`.
- Shrink images to 1600px JPEG before upload.
- Show the text in an editable box → "Confirm & analyze" → `POST /api/analyze`.
- Show "Read by {extracted_by}". Friendly errors.

## 3. Guidance (~20 min)
- First-visit 3-step tooltip tour (skippable, remembered)
- Status legend
- (i) glossary tooltip per test
- Range bar per numeric result (normal zone + value marker)
- Empty state: "Choose a patient or tap Scan report"
- Gentle notes under urgent ("a doctor should check today") and needs_info ("ranges differ for men and women")

## 4. Extras
- Download/print summary (`window.print()` + print CSS)
- Copy doctor questions
- Read aloud (`speechSynthesis`)
- A+ text size toggle
- Urdu/English toggle (labels + ask the LLM to answer in Urdu)

## Demo closer
"And on a phone, you can just take a photo of the report."
