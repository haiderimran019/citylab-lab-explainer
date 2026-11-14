# API Contract (shared by backend and frontend)
Base path: `/api`. All JSON. Both Claudes must follow this exactly. Change it only through Haider.

> **Changelog (backend):** v2 adds `explain` + `lang` query params, `POST /api/explain`, `POST /api/upload`,
> `extracted_by` on each result, nullable explanation fields, health stats, `X-Request-Id`, `request_id`/`retry_after`
> in errors, and HTTP 413/415/429/503 codes. No existing field was removed or renamed.

## Common query params
| Param | Values | Default | Used by |
|---|---|---|---|
| `explain` | `true` \| `false` | `true` | analysis endpoints. `false` = statuses only, no AI call, ~ms response |
| `lang` | `en` \| `ur` | `en` | analysis endpoints, `/api/explain`, `/api/chat`. `ur` = summary, explanations, doctor questions, chat reply, disclaimer and urgent banner in simple Urdu. Test names, numbers, units, `status`, `reason` and ranges stay English (the frontend translates status labels). |

## GET /api/health
```json
{ "status": "ok", "provider": "gemini", "model": "gemini-3.5-flash-lite", "rules_loaded": true, "patients": 14,
  "cache_size": 3, "llm_calls_today": 12, "fallbacks_today": 1, "avg_latency_ms": 1840 }
```
`provider`/`model` are the ones actually in use (`"template"`/`"none"` when no key is set). The four stats come from today's (UTC) usage log; `avg_latency_ms` is `null` before the first successful AI call.

## GET /api/patients
```json
[
  { "id": "P004", "name": "Diana Prince", "age": 42, "sex": "Female", "mrn": "CLD-P004-9942",
    "file": "report_P004_Diana_Prince_Hem_Urgent.md", "test_count": 2 }
]
```

## GET /api/patients/{id}/analysis?age=32&sex=Female&explain=true&lang=en  (all params optional)
## POST /api/analyze?explain=true&lang=en  body: { "report_text": "...", "age": null, "sex": null }
Both return an **Analysis**.

**Fast path for slow networks:** call with `explain=false` first → every `status`, `range`, `converted`, `reason`,
`urgent_banner`, `missing_info`, `ask_message` and `disclaimer` arrives at once, while `summary`, `doctor_questions`,
`generated_by` and every result's `explanation` are `null`. Then call `POST /api/explain` with that Analysis and fill the text in.
Statuses are identical with `explain=true` and `explain=false` (tested).

Each result also has `"extracted_by": "regex" | "llm"`. `"llm"` means the report's layout wasn't recognised and the AI copied the
test lines (values are re-checked against the text by code); such results have `source.line = 0`. In the example below, the second result is borrowed from P005 to show the `converted` shape; a real response only contains one patient's tests.
```json
{
  "patient": { "id": "P004", "name": "Diana Prince", "age": 42, "sex": "Female", "mrn": "CLD-P004-9942",
               "file": "report_P004_Diana_Prince_Hem_Urgent.md" },
  "results": [
    {
      "name_in_report": "Hemoglobin",
      "canonical_name": "Hemoglobin",
      "alias_note": null,
      "value": 6.5,
      "unit": "g/dL",
      "converted": null,
      "range": { "low": 12.1, "high": 15.1, "text": null, "unit": "g/dL", "sex": "Female",
                 "age_min": 18, "age_max": 100, "source_file": "4_ranges_hematology.md" },
      "status": "urgent",
      "is_urgent": true,
      "urgent_rule": "Hemoglobin less than 7.0 g/dL (3_dangerous_urgent_values.md)",
      "reason": "6.5 is below 12.1 (LOW) and at/below the urgent limit 7.0 → URGENT",
      "explanation": "Hemoglobin is the part of your blood that carries oxygen...",
      "source": { "file": "report_P004_Diana_Prince_Hem_Urgent.md", "line": 12 }
    },
    {
      "name_in_report": "Fasting Blood Sugar",
      "canonical_name": "Fasting Blood Sugar",
      "alias_note": null,
      "value": 6.0,
      "unit": "mmol/L",
      "converted": { "value": 108.1, "unit": "mg/dL",
                     "steps": "6.0 mmol/L × 18.016 = 108.1 mg/dL (glucose molar mass 180.16 g/mol; standard constant)" },
      "range": { "low": 70, "high": 99, "text": null, "unit": "mg/dL", "sex": "All", "age_min": 18, "age_max": 100,
                 "source_file": "5_ranges_biochemistry.md" },
      "status": "high", "is_urgent": false, "urgent_rule": null,
      "reason": "108.1 mg/dL is above 99 → HIGH",
      "explanation": "...", "source": { "file": "report_P005_Ethan_Hunt_Sugar_UnitConv.md", "line": 12 }
    }
  ],
  "missing_info": [],
  "ask_message": null,
  "urgent_banner": "⚠ One or more results are at a dangerous level. Please see a doctor today.",
  "doctor_questions": [
    "My hemoglobin is 6.5 g/dL, which the lab marks as urgent. Should I be seen today?",
    "What could be causing my low hemoglobin and low platelet count?",
    "Do I need repeat tests, and when?"
  ],
  "summary": "Two results are below the normal range, and one of them is urgent...",
  "disclaimer": "This is not a diagnosis. Only a licensed doctor can diagnose a condition.",
  "generated_by": { "provider": "gemini", "model": "gemini-3.5-flash-lite" }
}
```

`status` ∈ `normal | low | high | urgent | cannot_classify | needs_info`

**needs_info example (P012):**
```json
"missing_info": ["sex"],
"ask_message": "I can't choose the right normal range for AST because the report doesn't state the patient's biological sex. Please tell me Male or Female.",
"results": [{ "canonical_name": "AST", "status": "needs_info", "range": null,
              "reason": "AST ranges differ by sex and sex is missing", "...": "..." }]
```

**cannot_classify example (P006):** `"status": "cannot_classify", "range": null, "reason": "Serum Ferritin has no matching range in the reference files — cannot be classified from the files"`

## POST /api/explain?lang=en
Request: `{ "analysis": <Analysis exactly as returned with explain=false> }`
Response:
```json
{ "summary": "Two results are below the normal range, and one of them is urgent...",
  "explanations": { "Hemoglobin": "Hemoglobin is the part of your blood that carries oxygen...", "Platelet Count": "..." },
  "doctor_questions": ["Should I see a doctor today about my Hemoglobin?", "..."],
  "generated_by": { "provider": "gemini", "model": "gemini-3.5-flash-lite" } }
```
Keys of `explanations` are `canonical_name` (or `name_in_report` when `canonical_name` is null). Cached: the same results +
language never call the AI twice. If the AI fails, template text is returned with `generated_by = {"provider":"template","model":"none"}`.

## POST /api/upload  (multipart/form-data, field `file`)
Accepts JPEG, PNG, WEBP or PDF up to 4 MB (both the content type and the file's magic bytes are checked).
Text PDFs are read with pypdf (no AI); photos and scanned PDFs are transcribed by the AI provider. **Nothing is classified here**:
show `report_text` in an editable box, let the user confirm, then call `POST /api/analyze`.
```json
{ "report_text": "Patient Full Name: Sam Lee\nRecorded Age: 30\n...\nHemoglobin: 13.2 g/dL\nPlatelet Count: [UNREADABLE] cells/mcL",
  "extracted_by": "pypdf",
  "warnings": ["1 part unreadable"] }
```
`extracted_by` is `"pypdf"` or `"<provider>/<model>"` (e.g. `"gemini/gemini-3.5-flash-lite"`). Possible warnings:
`"N part(s) unreadable"`, `"No test lines recognised — please check the text before analyzing"`.

## POST /api/chat?lang=en
Request:
```json
{ "patient_id": "P014", "report_text": null, "message": "Is my sugar okay?", "age": null, "sex": null }
```
Response:
```json
{ "reply": "Your Fasting Blood Sugar (FBS) is 85 mg/dL, which is inside the lab's normal range of 70–99...",
  "refused": false,
  "sources": [{ "file": "report_P014_Nancy_Multiple.md", "line": 12 }, { "file": "5_ranges_biochemistry.md", "line": 4 }],
  "generated_by": { "provider": "gemini", "model": "gemini-3.5-flash-lite" } }
```
Refusal: `{ "reply": "I can only discuss the report currently open. Sharing another patient's results is not allowed (CityLab Safety Rule 1: Privacy).", "refused": true, "sources": [{"file":"1_lab_safety_rules.md","line":3}], "generated_by": null }`

`report_text` can replace `patient_id` for a pasted report. `age`/`sex` work like the analysis overrides (the chat never takes sex from the message text).
`generated_by` is `{"provider":"template","model":"none"}` when the AI was unavailable or its answer was unsafe.

## GET /api/rules
```json
{ "aliases": {"SGPT": "ALT", "pH Level": "Urine pH"},
  "ranges": [ {"test":"ALT","sex":"Female","age_min":18,"age_max":100,"low":7,"high":45,"text":null,"unit":"U/L","source_file":"5_ranges_biochemistry.md"},
              {"test":"Urine Protein","sex":"All","age_min":18,"age_max":100,"low":null,"high":null,"text":"Negative","unit":null,"source_file":"6_ranges_thyroid_urine.md"} ],
  "urgent": [ {"test":"Hemoglobin","op":"<=","value":7.0,"unit":"g/dL"} ],
  "edge_rule": "Value exactly on a limit = NORMAL; age bounds are inclusive" }
```
`aliases` includes the glossary aliases plus our documented context mappings. `text` is set only for qualitative ranges (then `low`/`high` are null).

## Input notes
- `sex` (query or body) is case-insensitive and accepts `Male`, `Female`, `M`, `F`. Anything else → 422 `invalid_input`.
- `age` must be 0–130.
- Patient IDs are case-insensitive (`p004` = `P004`).

## Request IDs
Every response carries an `X-Request-Id` header. A client may send its own `X-Request-Id` (letters, digits, `._-`, max 64 chars) and it is echoed back; otherwise the server makes one. The same ID appears in error JSON and in the server's LLM usage log, so a failed request can be traced.

## Errors
```json
{ "error": "Patient not found", "code": "not_found", "request_id": "3f9c2a1b7d4e5f60" }
```
| HTTP | code | When |
|---|---|---|
| 404 | `not_found` | unknown patient or route |
| 413 | `file_too_large` | upload over 4 MB |
| 415 | `unsupported_type` | upload not JPEG/PNG/WEBP/PDF, or bytes don't match the declared type |
| 422 | `invalid_input` | bad query/body value (message names the field) |
| 422 | `no_tests_found` | pasted text contains no recognisable test lines |
| 422 | `unreadable_image` | photo too unclear / PDF unreadable |
| 429 | `rate_limited` | more than 20 AI-backed requests per minute from one IP (body has `retry_after` seconds; `Retry-After` header too) |
| 500 | `internal_error` | anything unexpected ("Something went wrong on our side. Please try again.") |
| 503 | `ai_unavailable` | a photo needs the AI to be read, and the AI is offline or failing |

AI-backed (rate-limited) requests: analysis with `explain=true`, `/api/explain`, `/api/chat`, `/api/upload`. `explain=false` is never rate-limited.

Rate-limit example: `{ "error": "Too many requests, please wait a moment", "code": "rate_limited", "request_id": "…", "retry_after": 42 }`

Errors never contain keys, stack traces or provider details.
