# API Contract (shared by backend and frontend)
Base path: `/api`. All JSON. Both Claudes must follow this exactly. Change it only through Haider.

## GET /api/health
```json
{ "status": "ok", "provider": "gemini", "model": "gemini-2.5-flash", "rules_loaded": true, "patients": 14 }
```

## GET /api/patients
```json
[
  { "id": "P004", "name": "Diana Prince", "age": 42, "sex": "Female", "mrn": "CLD-P004-9942",
    "file": "report_P004_Diana_Prince_Hem_Urgent.md", "test_count": 2 }
]
```

## GET /api/patients/{id}/analysis?age=32&sex=Female  (age and sex are optional overrides)
## POST /api/analyze  body: { "report_text": "...", "age": null, "sex": null }
Both return an **Analysis**. In the example below, the second result is borrowed from P005 to show the `converted` shape; a real response only contains one patient's tests.
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
  "generated_by": { "provider": "gemini", "model": "gemini-2.5-flash" }
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

## POST /api/chat
Request:
```json
{ "patient_id": "P014", "report_text": null, "message": "Is my sugar okay?", "age": null, "sex": null }
```
Response:
```json
{ "reply": "Your Fasting Blood Sugar (FBS) is 85 mg/dL, which is inside the lab's normal range of 70–99...",
  "refused": false,
  "sources": [{ "file": "report_P014_Nancy_Multiple.md", "line": 12 }, { "file": "5_ranges_biochemistry.md", "line": 4 }],
  "generated_by": { "provider": "gemini", "model": "gemini-2.5-flash" } }
```
Refusal: `{ "reply": "I can only discuss the report currently open. Sharing another patient's results is not allowed (CityLab Safety Rule 1: Privacy).", "refused": true, "sources": [{"file":"1_lab_safety_rules.md","line":3}] }`

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
| 422 | `invalid_input` | bad query/body value (message names the field) |
| 422 | `no_tests_found` | pasted text contains no recognisable test lines |
| 500 | `internal_error` | anything unexpected ("Something went wrong on our side. Please try again.") |

Errors never contain keys, stack traces or provider details.
