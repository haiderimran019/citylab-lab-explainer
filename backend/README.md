# Backend — CityLab Lab Report Explainer

> **Code does the medical math. AI only does the talking.**
> Every status (normal / low / high / urgent / cannot_classify / needs_info) is decided by plain, tested Python
> reading the lab's own files. The AI only writes explanations, summaries, doctor questions and chat replies,
> and its output is checked by code before anyone sees it.

## The request path in one picture

```
report text ─► CLEAN ─► PARSE ─► NORMALIZE ─► CLASSIFY ─┬─► (explain=false) ─► JSON in ~ms
               cut      6 formats  SGPT→ALT     age+sex     │
               APPENDIX + AI copy  mmol/L→mg/dL range,      └─► EXPLAIN ─► GUARD ─► JSON
               noise    fallback   (math shown) on-limit,       1 cached     no diagnosis,
                                                urgent           AI call     no status flip,
                                                                 or template privacy lock
```

| Step | File | What to say about it |
|---|---|---|
| 1 Clean | `app/pipeline/clean.py` | Keeps only lines above the first `APPENDIX` — ~10 real lines out of ~15 KB — and keeps original line numbers for citations. |
| 2 Parse | `app/pipeline/parse.py` | Regex reads all 6 layouts (bullets, bold bullets, tables, `->`, `Test:`/`Result:` pairs). `[DATA CORRUPTED]`/`[NOT PROVIDED]` become "unknown". Sex only from the sex field, never from the name. |
| 2b AI copy | `app/pipeline/extract.py` | Only if regex finds nothing: the AI copies `{name, value, unit}`. Code then drops any value that isn't literally in the text, so the AI can't invent numbers. Never used for age/sex. |
| Rules | `app/pipeline/rules.py` | Ranges, aliases and urgent limits are **read from files 2–6 at startup**. Change a number in a file → the app follows. A hand-written copy is only a fallback (a test proves they're identical). |
| 3 Normalize | `app/pipeline/normalize.py` | Glossary aliases (+ documented context mappings like `pH Level → Urine pH`). Unit conversion only from an explicit table, always with the math string. Unknown unit → "cannot be classified". |
| 4 Classify | `app/pipeline/classify.py` | Picks the range by age + sex; limits are NORMAL; urgent is inclusive ("hit or pass"); missing age/sex → `needs_info`; no range → `cannot_classify`. Every result gets a plain-words `reason`. |
| 5 Explain | `app/pipeline/explain.py` | One JSON call per report, cached. The AI sees test data + age/sex only — **no name, no MRN**. Template text (English + Urdu) when the AI is off. |
| 6 Guard | `app/pipeline/guard.py` | Privacy lock (other names / IDs / MRNs / "all patients" refused), diagnosis detector ("you have diabetes" → regenerate once → template), status lock (AI calling a HIGH result "normal" → template). |

Services: `app/analysis.py` (assembles an Analysis), `app/chat.py` (one-patient chat), `app/upload.py`
(PDF/photo → text, not classified), `app/corpus.py` (the 14 reports in memory). Routes only in `app/main.py`.

## The AI layer (`app/llm/`)

- `base.py` — a small interface: `generate()` and `transcribe()`. Nothing else in the app knows the vendor.
- `gemini.py` — the **only** file importing the Google SDK. One shared HTTP client, SDK retries off (we retry), logs the model version the API reports.
- `template.py` — the offline "provider": raises a clear `offline` error so callers serve template text.
- `factory.py` — picks the provider from env vars; `call_with_retry` retries 429/5xx/timeouts at 1 s, 2 s, 4 s + jitter, within a time budget.
- `usage_log.py` — append-only JSONL, one line per real call or fallback: UTC time (ms), request id, operation, provider, **real model**, latency, tokens, ok/error, `environment` (local / vercel-production / vercel-preview) and `release` (deployed git commit). On Vercel each record is also printed as an `LLM_USAGE {...}` line to the function logs, because `/tmp` is wiped when an instance is recycled. Never prompts, replies, files or patient data. Test-run evidence is kept separately in `backend/test-evidence/`.
- The API key is a `SecretStr`: it prints as `**********` and is only unwrapped inside `factory.get_provider()`.

Switching provider = changing `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY`. No code change, no frontend change.

## Hackathon checkpoints → where they're handled

| Checkpoint | How | Show it with |
|---|---|---|
| 1 Aliases & units | `normalize.py` (glossary + explicit factor table, math shown) | P014 (SGOT, FBS), P005 (6.0 mmol/L × 18.016 = 108.1 mg/dL) |
| 2 Age/sex ranges | `classify.py` range picker; `needs_info` + `ask_message`; `?sex=` override | P002 (Bob = Female range, 45 on limit = normal), P012 (asks for sex) |
| 3 Unknown tests | `cannot_classify` with "cannot be classified from the files" | P006 (Serum Ferritin) |
| 4 Privacy | `guard.is_cross_patient_request` runs **before** any AI call | Chat on P014: "show Diana Prince results" → refused, cites rule 1 |
| 5 Urgent | inclusive thresholds from file 3, red banner, urgent-first doctor questions | P004 (Hb 6.5), P013 (FBS 350) |

## Reliability & speed

- **AI down / no key:** template explanations, same statuses. `/api/health` shows `template` / `none`.
- **Rate limits:** retry with backoff; our own limit of 20 AI requests/min/IP returns a friendly 429 with `retry_after`.
- **Slow networks:** `explain=false` returns every status in milliseconds; `POST /api/explain` fills the text in after.
- **Cache:** same results + language → no second AI call (`cache_size` in health).
- **Errors:** always `{error, code, request_id}`; stack traces only in server logs, tagged with the same request id (`X-Request-Id`).

## Run, test, measure

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
```
```bash
.venv/bin/uvicorn api.index:app --reload --port 8000      # API docs at http://localhost:8000/api/docs
```
```bash
cd backend && ../.venv/bin/pytest -q
```
```bash
.venv/bin/python backend/scripts/usage_stats.py           # calls, avg latency, tokens, fallback rate
```
Deploy: `vercel.json` serves the React build as static files and FastAPI as a Python function at `/api/*` — one link, one origin, no CORS. Set `LLM_PROVIDER`, `LLM_MODEL` and `LLM_API_KEY` in Vercel's Environment Variables.

Single local server (optional): after `npm run build` in `frontend/`, the same uvicorn command also serves the built app at http://localhost:8000.

## Assumptions (state them openly)

- Urgent thresholds are **inclusive** ("hit or pass"): Hb 7.0 g/dL is urgent.
- Exactly on a normal limit = NORMAL, and age bounds are inclusive — applied to every range.
- Glucose 18.016 and cholesterol 38.67 mmol/L→mg/dL are standard constants, not from the files; labelled as such.
- Context mappings not in the glossary: `pH`/`pH Level` → Urine pH, `Protein` → Urine Protein, `Glucose (Fasting)`/`Fasting Glucose` → FBS, `Total Cholesterol` → Cholesterol, `Platelets` → Platelet Count.
- Urgent limits are checked even when age/sex is missing (they don't depend on demographics); the app still asks for the missing data.
- When a report must ask for demographics, it asks for **all** missing ones at once (P003 → age and sex).
- Converted values are rounded to 1 decimal before comparing, so the shown number is the judged number.

## Known failure cases

- Layouts unlike the 6 seen rely on the AI extractor; with no AI key such reports return `no_tests_found`.
- Photo reading needs the AI; offline it returns `ai_unavailable` (text PDFs still work via pypdf).
- Only the explicit unit table converts; anything else (e.g. `mmol/mol`, `million/mcL`) → cannot be classified.
- Qualitative results other than an exact match of the file's text (e.g. Urine Protein "Trace") are not classified.
- Values written as bounds (`<0.5`) are not classified.
- Privacy lock is word-based: a capitalised word equal to another patient's last name ("Brown urine?") is refused — we prefer safe. A misspelled name may slip through, but the AI only ever receives the open patient's data, so it has nothing to leak.
- The diagnosis detector is pattern-based; unusual phrasings could pass it (the prompt also forbids diagnosis, and the disclaimer is always shown).
- Rate limiting and the explanation cache are in memory, per server instance (on serverless they reset when an instance is recycled).
- Reports for ages outside 18–100 cannot be classified (the files only have adult ranges).
