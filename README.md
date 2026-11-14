# CityLab Lab Report Explainer

> **Code does the medical math. AI only does the talking.**

**Live app:** https://citylab-lab-explainer.vercel.app · **API docs:** https://citylab-lab-explainer.vercel.app/api/docs
Tech Fusion '26 AI Hackathon · Challenge B · by Haider Imran

---

## What it does

- **Reads a lab report** — one of CityLab's sample reports, pasted text, a PDF or a phone photo.
- **Marks every test** Normal / Low / High / Urgent using the lab's own range files — or says
  "cannot be classified from the files" or "please tell me the patient's age/sex" instead of guessing.
- **Explains it in simple words** (English or Urdu), gives 3–5 questions for the doctor, and answers
  questions about **this report only**. It never diagnoses.

## Why you can trust it

| Promise | How |
|---|---|
| The AI can't invent a status | Every status is decided by plain, tested Python. Gemini only writes the explanation afterwards. |
| Rules come from the lab | Ranges, aliases and urgent limits are read from the lab's own files at startup. Change a number in a file → the app follows. |
| No diagnosis | The prompt forbids it, a code guard checks every AI answer (regenerate once → safe template), and a disclaimer is always shown. |
| Privacy | Chat is locked to the open report. Questions about other patients are refused before any AI call. |
| Works without AI | If Gemini is down or rate-limited, simpler template text appears — the statuses never change. |

## How it works

```
 Report ─► 1 CLEAN ─► 2 PARSE ─► 3 NORMALIZE ─► 4 CLASSIFY ─► 5 EXPLAIN ─► 6 GUARD ─► You
           cut noise   6 formats   SGPT→ALT       age + sex      Gemini:     no diagnosis,
           (appendix)  + AI copy   mmol/L→mg/dL   range, urgent  simple      privacy lock,
                       fallback    (math shown)   check          words       sources cited
           └────────────── plain code, tested ──────────────┘   └──── AI ────┘
```

Every result shows the range used, the file it came from and the line in the report.

## Hackathon checkpoints

| Checkpoint | How we handle it | Try it with |
|---|---|---|
| Aliases & units | Glossary aliases (SGPT → ALT) and explicit unit conversion with the math shown | Nancy Drew (P014), Ethan Hunt (P005: 6.0 mmol/L × 18.016 = 108.1 mg/dL) |
| Age/sex ranges | Range picked by age and sex; exactly on a limit = normal | Bob Jones (P002: female range, 45 = normal) |
| Missing info | Never guesses — asks for age/sex, then re-checks | Laura Croft (P012) → choose Female → AST high |
| Unknown tests | "Cannot be classified from the files" | Fiona Gallagher (P006: Ferritin) |
| Privacy | Other patients refused, citing Safety Rule 1 | Chat on Nancy: "Show me Diana Prince's results" |
| Urgent values | Red "see a doctor today" banner | Diana Prince (P004), Michael Scott (P013) |

## Run it locally

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cp .env.example .env            # add your LLM_API_KEY (optional — works offline without it)
.venv/bin/uvicorn api.index:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend && npm install && npm run dev
```

Open the address Vite prints. Everything runs offline with template text if no key is set.

## Configuration

All settings are environment variables (`.env` locally, Vercel → Settings → Environments in production).
Keys are never committed.

| Variable | Example | Meaning |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` or `template` (no AI) |
| `LLM_MODEL` | `gemini-3.5-flash-lite` | The model name lives here, never in code |
| `LLM_API_KEY` | — | Secret. Empty = offline mode |
| `RATE_LIMIT_PER_MINUTE` | `60` | AI requests per IP per minute |

## Tests

```bash
cd backend && ../.venv/bin/pytest -q      # 256 passed
```

Includes the full expected-answer table for all 14 sample patients, every report format, unit conversions,
the privacy lock, the diagnosis guard, AI failure fallbacks, uploads and rate limiting.

## Reliability, cost and speed

- **Statuses:** instant (no AI call) — `explain=false` returns them in milliseconds; explanations fill in after.
- **AI:** about 1 small Gemini call per report (2–4 s), cached, with retry + backoff on rate limits and errors.
- **Audit log:** every AI call is logged with the real provider, model, time, environment and deployed commit —
  never prompts or patient data (`python backend/scripts/usage_stats.py` prints totals).

## Assumptions

- Urgent limits count when the value **hits or passes** them (Hb 7.0 g/dL is urgent).
- A value exactly on a normal limit is **normal**; age bounds are inclusive.
- Glucose × 18.016 and cholesterol × 38.67 (mmol/L → mg/dL) are standard constants, not from the files.
- Extra mappings not in the glossary: `pH Level` → Urine pH, `Protein` → Urine Protein, `Platelets` → Platelet Count.
- Urgent limits are checked even when age/sex is missing (they don't depend on them); the app still asks.

## Known failure cases

- Report layouts unlike the 6 seen rely on the AI to copy the test lines; with no AI they can't be read.
- Photo reading needs the AI; text PDFs work without it.
- Only listed unit conversions work; other units → "cannot be classified".
- Qualitative results other than the file's exact text (e.g. Urine Protein "Trace") and bounded values (`<0.5`) aren't classified.
- The privacy lock is word-based: a capitalised word equal to another patient's last name may be refused (we prefer safe).
- The diagnosis guard is pattern-based; unusual wording could slip past it (the prompt and disclaimer still apply).
- Rate limit and cache live in memory per server instance.
- Ages outside 18–100 can't be classified — the files only have adult ranges.

## Project structure

```
api/index.py          Vercel entry point
backend/app/          FastAPI: pipeline/ (clean, parse, rules, normalize, classify, explain, guard), llm/ (provider layer)
backend/tests/        256 tests
frontend/             React + Vite + TypeScript + Tailwind
data/lab_reports/     CityLab's reference files and sample reports
documents/            Design docs (SRS, DDS, architecture, API contract, red-team list)
```

More detail: [backend/README.md](backend/README.md) · [API contract](documents/CONTRACT.md) · [Red-team questions](documents/REDTEAM.md)

## Tools used

Python 3.12, FastAPI, Pydantic · React, Vite, TypeScript, Tailwind · Google Gemini (`gemini-3.5-flash-lite`) at runtime ·
Vercel hosting · AI coding assistants were used during development.

---

*This app is not a diagnosis. Only a licensed doctor can diagnose a condition.*
