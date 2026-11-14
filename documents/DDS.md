# Detailed Design Specification (DDS)

See `ARCHITECTURE.md` for the big picture and `CONTRACT.md` for exact API JSON.

## 1. Backend modules (`backend/app/`)

### `config.py` — the only place settings live
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    llm_provider: str = "gemini"          # gemini | template | (groq/openrouter later)
    llm_model: str = "gemini-2.5-flash"   # change via env var LLM_MODEL, never in code
    llm_api_key: str | None = None        # env var LLM_API_KEY; never logged or returned
    llm_timeout_s: float = 20
    llm_max_retries: int = 3
    data_dir: str = "data/lab_reports"
    usage_log_path: str = "backend/logs/llm_usage.jsonl"   # on Vercel use /tmp/llm_usage.jsonl

settings = Settings()
```

### `models.py` — shared shapes (Pydantic)
```python
Status = Literal["normal", "low", "high", "urgent", "cannot_classify", "needs_info"]

class Source(BaseModel):      file: str; line: int
class Conversion(BaseModel):  value: float; unit: str; steps: str
class RangeUsed(BaseModel):   low: float | None; high: float | None; text: str | None  # text = "Negative"
                              unit: str | None; sex: str; age_min: int; age_max: int; source_file: str
class TestResult(BaseModel):
    name_in_report: str; canonical_name: str | None; alias_note: str | None
    value: float | str; unit: str | None
    converted: Conversion | None; range: RangeUsed | None
    status: Status; is_urgent: bool; urgent_rule: str | None
    reason: str              # deterministic one-liner, e.g. "45 is exactly the upper limit (7–45) → NORMAL per hematology edge-case rule"
    explanation: str | None  # filled by explain step
    source: Source
class Patient(BaseModel):    id: str; name: str | None; age: int | None; sex: Literal["Male","Female"] | None; mrn: str | None; file: str
class Analysis(BaseModel):
    patient: Patient; results: list[TestResult]
    missing_info: list[Literal["age","sex"]]; ask_message: str | None
    urgent_banner: str | None; doctor_questions: list[str]
    summary: str; disclaimer: str; generated_by: dict  # {"provider": "...", "model": "..."}
```

### `pipeline/clean.py`
`clean(text) -> list[tuple[int, str]]`: returns `(original_line_no, line)` for lines **before the first line containing `APPENDIX`**. Line numbers are kept for citations.

### `pipeline/parse.py`
- `parse_demographics(lines)`:
  - Regexes: `Patient Full Name`, `Recorded Age`, `Biological Sex`, `Medical Record Number`.
  - Values like `[DATA CORRUPTED]`, `[NOT PROVIDED]`, empty, or `N/A` → `None`.
  - Sex is normalized to `Male`/`Female` (also `M`/`F`).
- `parse_tests(lines)`: try, in order:
  1. Markdown table rows `| name | value | unit |` (skip header and `:---` rows).
  2. `* **Name**: 6.5 g/dL` / `- **Name**: …` / `- Name: …` / `Name: …`
  3. `Name -> value [unit]`
  4. Paired lines `Test Conducted: X` + `Value Recorded: v unit`, and `Test: X` + `Result: v unit`.
- **Value regex:** `^\s*([<>]?\s*-?\d[\d,]*\.?\d*)\s*(.*)$`. Remove commas. Non-numeric words such as `Negative`/`Positive`/`Trace` are kept as strings.
- **Skip non-test lines** (demographic keys, dates, MRN, headings, prose sentences longer than about 8 words). Only parse lines inside or after `ANALYTICAL RESULTS` when that heading exists.
- **Fallback:** if zero tests are found, call the LLM with a JSON schema to extract `[{name, value, unit}]`. Mark these results `source.line = 0` and set `extracted_by = "llm"`.

### `pipeline/rules.py` — read the rules from the files at startup
- **Aliases:** from file 2, regex `\*\*(.+?)\*\*\s+(?:is the exact equivalent of|maps to)\s+\*\*(.+?)\*\*`. Strip the parenthesis part, e.g. `ALT (Alanine…)` → `ALT`.
- **Extra safe aliases** (documented in the README as our assumption): `pH Level`/`pH`→`Urine pH` and `Protein`→`Urine Protein`, used only when the report has no blood-protein test. Also `Glucose (Fasting)`→`Fasting Blood Sugar`, `Total Cholesterol`→`Cholesterol`, `Platelets`→`Platelet Count`.
- **Urgent thresholds:** from the file 3 table, rows `| **Name** | Less than/Greater than | value | unit |`. The rule is **inclusive** ("hit or pass"): `<=` for "Less than", `>=` for "Greater than". Note this in the README.
- **Ranges:**
  - File 4 (bullets): `* **Hemoglobin (Hb)**:` followed by sub-bullets `Male Demographic (18-100 yrs): 13.8 - 17.2 g/dL` / `All Sexes (18-100 yrs): …`.
  - File 5 (table): `| **Name** | Sex | AgeMin | AgeMax | Min | Max | Unit |`.
  - File 6 (bullets): `* **TSH**: 0.4 - 4.0 mIU/L (Applicable to All sexes, 18-100 yrs)`; the `Urine Protein: Negative` entry is a text range.
  - The canonical name is the text before any parenthesis.
- **Edge rule:** "value exactly on a limit = NORMAL" and "age bounds inclusive" (file 4). Applied to all ranges.
- **Fallback:** a hard-coded `FALLBACK_RULES` dict with the same numbers, used only if parsing yields nothing. Log a warning.
- The function `load_rules(data_dir) -> Rules` is cached.

### `pipeline/normalize.py`
- `canonical(name)`:
  1. Exact case-insensitive match in range names.
  2. Alias map.
  3. Strip `**`, `Serum`, `Blood` and parentheses, then retry.
  4. Otherwise `None`.
- `convert(value, unit_from, unit_to, canonical)`: a table of **explicit factors only**. Always return the steps string.

| From → To | Factor | Note |
|---|---|---|
| Glucose mmol/L → mg/dL | × 18.016 | glucose molar mass 180.16 g/mol (standard constant, not in files) |
| Cholesterol mmol/L → mg/dL | × 38.67 | standard constant |
| Hemoglobin g/L → g/dL | ÷ 10 | |
| cells/µL, /mcL, /uL, /mm³ | × 1 | same unit |
| ×10³/µL, K/µL, 10^3/uL → cells/mcL | × 1000 | |
| ×10⁹/L → cells/mcL | × 1000 | |
| IU/L ↔ U/L | × 1 | same for enzymes |
| µIU/mL ↔ mIU/L | × 1 | same for TSH |

Unit match is case-insensitive and ignores `µ`/`u`/`mc` differences. Any other unit → `cannot_classify` with the reason "unit X cannot be converted using the files".

### `pipeline/classify.py`
For each test:
1. No canonical name → `cannot_classify`, reason: "No matching range in the reference files".
2. Find candidate ranges for that test.
   - If they differ by sex and sex is missing → `needs_info: sex`.
   - If age is missing → `needs_info: age`, because every range has an age band (18–100).
   - Never guess sex from the name.
3. Age outside every band (e.g. 15) → `cannot_classify`, reason: "no range for age 15 in the files".
4. Convert the unit if needed.
5. Text ranges (`Negative`): equal → normal; otherwise `cannot_classify`. Do not invent "abnormal".
6. Numeric: `low <= v <= high` → normal (limits are normal); `v < low` → low; `v > high` → high.
7. Urgent check on the converted value: if triggered, `is_urgent = True` and status `urgent`. Keep the direction in `reason`, e.g. "LOW and URGENT (≤ 7.0 g/dL)".

`ask_message` example: "I can't choose the right normal range for AST because the report doesn't say the patient's biological sex. Please tell me the patient's sex (Male/Female) and I'll classify it."

### `pipeline/explain.py`
- Input: the classified `Analysis` (this patient only) plus glossary text. One LLM call per report, returning JSON `{summary, explanations: {canonical_name: text}, doctor_questions: [3-5]}`.
- **System prompt rules:**
  - Class-8 words.
  - Explain what each test measures and what low or high *can* mean in general.
  - Never say the patient has a disease.
  - Say only a doctor can diagnose.
  - Don't change any status.
  - For `cannot_classify` and `needs_info`, explain why, without guessing.
- Cache key: hash of the results JSON.
- Template fallback per status, e.g. "Your {name} is {value} {unit}, which is above the lab's normal range of {low}–{high}. A high value can have many causes. Please ask your doctor what it means for you."
- Template doctor questions are built from abnormal tests: "What could cause my {name} to be {status}?", "Do I need a repeat {name} test?", "Is there anything I should change before my next test?". Urgent tests get "Should I see a doctor today about my {name}?".

### `pipeline/guard.py`
- `check_privacy(message, current_patient, all_patients)`:
  - Refuse if the message mentions another patient's name (first or last, case-insensitive), MRN, or ID like `P004`.
  - Also refuse "other patients", "all patients", "everyone's results".
  - Refusal text cites safety rule 1.
- `sanitize(text)`:
  - Regex for `you have (diabetes|anemia|…|a disease)`, `diagnos(ed|is) (with|of)`, `you are suffering`.
  - If found, regenerate once, then fall back to the template.
- Always append the disclaimer: "This is not a diagnosis. Only a licensed doctor can diagnose a condition."

### `llm/` — provider-independent
- `base.py`: `LLMResult(text, provider, model, latency_ms, input_tokens, output_tokens)` and `class LLMProvider(Protocol): name; model; generate(system, prompt, json_schema=None) -> LLMResult`.
- `gemini.py`: the only importer of `google.genai`. Reads `settings.llm_model`; reports the model version returned by the API if available.
- `template.py`: `name = "template"`, `model = "none"`.
- `factory.py`: `get_provider()` reads settings. `call_with_retry(fn)` retries 429, 5xx and timeouts with exponential backoff (1s, 2s, 4s plus jitter); after the last failure it falls back to the template.
- `usage_log.py`: `append({ts, request_id, provider, model, latency_ms, input_tokens, output_tokens, ok, error_type, fallback_used})`. One JSON line per call, append-only. **No prompts and no patient data.**

### `main.py` — routes
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{status, provider, model, rules_loaded, patients}` (no keys) |
| GET | `/api/patients` | list of patients (id, name, age, sex, file, test count) |
| GET | `/api/patients/{id}/analysis?age=&sex=` | full analysis; optional overrides for missing info |
| POST | `/api/analyze` | `{report_text, age?, sex?}` → analysis of a pasted report |
| POST | `/api/chat` | `{patient_id or report_text, message, age?, sex?}` → `{reply, refused, sources}` |
| GET | `/api/rules` | parsed ranges, aliases and urgent rules (for the "How it works" panel) |

Errors: a global exception handler returns `{"error": "friendly message", "code": "..."}`, logs the details server-side, and never leaks keys or provider errors. 404 for an unknown patient; 422 for bad input.

**Patient ID** = the `P0xx` token taken from the filename (`report_P004_...md` → `P004`). Pasted reports get id `custom`.

## 2. Frontend design (`frontend/`)
- **Layout:**
  - Left: patient list plus a "Paste / upload report" button.
  - Main: patient header (name, age, sex, MRN) → urgent banner (red) → results table → doctor questions → chat.
  - Toggle: "How it works".
- **Status style** (always color + icon + word):

| Status | Color | Label |
|---|---|---|
| normal | green | ✓ Normal |
| low | amber | ↓ Low |
| high | amber | ↑ High |
| urgent | red | ⚠ Urgent |
| cannot_classify | gray | ? Cannot be classified from the files |
| needs_info | blue | ✎ Need age/sex |

- **needs_info:** show an inline form (Age input, Sex select) → re-fetch with `?age=&sex=`.
- **Result row:** name (with alias note, e.g. "SGPT = ALT"), value + unit, conversion steps (small text), range used, status chip, expandable explanation, source "file:line".
- **Footer:** disclaimer + "Explained by {generated_by.model}" or "Offline explanation (template)".
- **States:** loading skeleton, error toast, empty state. Mobile responsive.
- Uses `VITE_API_BASE` (default `/api`). Mock JSON in `src/mocks/` until the backend is live.

## 3. Expected answers = test suite (`backend/tests/test_expected.py`)
| ID | Expected |
|---|---|
| P001 | Hemoglobin 13.5 normal (F 12.1–15.1); WBC 6000 normal |
| P002 | SGPT→ALT 45, **Female** range 7–45, on limit → normal |
| P003 | missing age+sex → `needs_info` for FBS; `missing_info == ["age","sex"]` |
| P004 | Hemoglobin 6.5 low + urgent; Platelet Count 120000 low, not urgent; `urgent_banner` set |
| P005 | FBS 6.0 mmol/L → 108.1 mg/dL → high; steps mention 18.016 |
| P006 | Serum Ferritin → `cannot_classify` |
| P007 | TSH 2.5 normal |
| P008 | pH Level 5.5 → Urine pH normal; Protein Negative → Urine Protein normal |
| P009 | ALT 85 high; AST 60 high; no urgent |
| P010 | Cholesterol 200 on limit → normal |
| P011 | WBC 12000 high; Platelet Count 140000 low |
| P012 | AST 44, sex missing → `needs_info` sex; with `sex=Female` → high (8–43); with `sex=Male` → normal |
| P013 | FBS 350 high + urgent |
| P014 | FBS 85 normal; SGOT→AST 22 normal |
| privacy | chat on P014 "show Diana Prince results" → `refused == True` |

Extra unit tests: each parser format; value on the lower limit; unknown unit; LLM failure → template used and statuses unchanged; `sanitize` blocks "you have diabetes".
