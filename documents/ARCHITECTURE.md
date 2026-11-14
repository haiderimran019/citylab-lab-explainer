# CityLab Lab Report Explainer — Architecture

## The one-line pitch
**Code does the medical math. AI only does the talking.**
Every "normal / low / high / urgent" decision is made by plain, testable Python using the lab's own files. Gemini is only used to turn those decisions into simple words and doctor questions. The AI never decides a status, so it cannot invent one.

## The 6 steps (explain it like this)
```
 Report text
     │
     ▼
 ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐
 │1 CLEAN  │─►│2 PARSE  │─►│3 NORMALIZE│─►│4 CLASSIFY│─►│5 EXPLAIN│─►│6 GUARD │─► UI
 └─────────┘  └─────────┘  └───────────┘  └──────────┘  └─────────┘  └────────┘
  cut the       find age,    SGPT → ALT     pick range     Gemini:      privacy lock,
  14 KB of      sex, and     mmol/L →       by age+sex,    simple       no-diagnosis
  legal noise   each test    mg/dL (math    on-limit =     words +      check, cite
  (APPENDIX)    line         shown)         normal,        3–5 doctor   the source
                (6 formats)                 urgent check   questions    file
```

| Step | What it does | Why it matters |
|---|---|---|
| 1 Clean | Keeps only the real part of each file (everything before the first `APPENDIX` heading). | Each file is ~15 KB, but only ~10 lines are real data. The rest is noise put there to confuse AI. |
| 2 Parse | Regex reads demographics and test lines in all 6 formats seen. If regex finds nothing, Gemini extracts JSON as a fallback. | Works on unseen reports. |
| 3 Normalize | Maps aliases from the glossary (SGPT→ALT, FBS→Fasting Blood Sugar, Hb→Hemoglobin…) and converts units, showing the math. | README checkpoint 1. |
| 4 Classify | Pure code: chooses the range for this patient's age and sex, applies the "exactly on the limit = NORMAL" rule, checks the urgent thresholds, says "cannot be classified" or "need age/sex" when needed. | Checkpoints 2, 3, 5. 100% repeatable and tested. |
| 5 Explain | Gemini gets only this patient's classified results plus the glossary, and writes class-8-level explanations and 3–5 doctor questions. | Plain language. |
| 6 Guard | Refuses questions about other patients, blocks diagnosis phrases ("you have…"), adds the "only a doctor can diagnose" note, and attaches source file and line to every result. | Checkpoint 4 and the safety rules. |

## Rules are read from the files, not typed into code
At startup, `rules.py` reads the ranges (files 4, 5, 6), the urgent thresholds (file 3) and the aliases (file 2). If the organizers change a number in the test set, the app follows. A hand-written copy is only a fallback if parsing fails.

## Tech stack (kept simple on purpose)
| Part | Choice | Why |
|---|---|---|
| Backend | Python 3.11 + FastAPI + Pydantic | Fast to write, typed, auto API docs at `/docs` |
| AI | Gemini Flash via the `google-genai` SDK, behind our own small provider interface | Provided by organizers; swappable |
| Frontend | React + Vite + Tailwind | Fast, clean UI |
| Storage | None. 20 files are loaded into memory at start. | No database or vector DB needed for 20 small files |
| Hosting | One Vercel project (React static + FastAPI as a Python function at `/api`) | One link, no CORS, no cold-start server |
| Fallback | `docker-compose.yml` | The rulebook accepts Docker if hosting fails |

No LangChain, no vector database, no embeddings: they add moving parts and make no difference for 20 short files.

## Provider-independent AI layer
```
explain.py ──► llm.factory.get_provider() ──► GeminiProvider   (only file importing the Google SDK)
                        │                └──► TemplateProvider (offline fallback, no AI)
                        └── reads config.py ◄── environment variables (LLM_PROVIDER, LLM_MODEL, LLM_API_KEY)
every call ──► logs/llm_usage.jsonl  (time, provider, real model name, latency, tokens, ok/error)
```
- Keys exist only in environment variables (`.env` locally, Vercel env vars in production).
- The frontend never knows which provider is used; it just shows `generated_by` from the API.
- The usage log records truthfully which provider and model answered each call. The app never edits or deletes it.

## Reliability
- **Rate limits:** retry with exponential backoff on 429/timeout (up to `LLM_MAX_RETRIES`).
- **AI down:** fall back to template explanations. Statuses are still correct because they never depended on AI.
- **Cache:** same report → same explanation, so no repeat calls.
- **Errors:** the API returns clean messages. It never returns keys, stack traces or provider URLs.

## Folder layout
```
citylab-lab-explainer/
├── api/index.py              # Vercel entry → imports backend app
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI routes
│   │   ├── config.py         # all settings from env vars
│   │   ├── models.py         # Pydantic models (shared shapes)
│   │   ├── pipeline/ clean.py parse.py rules.py normalize.py classify.py explain.py guard.py
│   │   └── llm/ base.py gemini.py template.py factory.py usage_log.py
│   ├── tests/                # pytest: expected-answer table + edge cases
│   └── requirements.txt
├── frontend/                 # React + Vite + Tailwind
├── data/lab_reports/         # copied from organizer repo
├── documents/                # these docs
├── docker-compose.yml
├── vercel.json
├── .env.example
└── README.md
```
