# Game Plan — 14 Nov 2026, 10:30 → 2:30

## Before 10:30 (checklist)
- [ ] ETL account created (hh.etlonline.org) and logged in
- [ ] Logged in on your laptop: GitHub, Vercel (linked to GitHub)
- [ ] Gemini key ready (organizer tokens, or aistudio.google.com free key)
- [ ] Python 3.11+, Node 20+, git installed; `pip install fastapi uvicorn` works
- [ ] Two Claude windows ready (backend / frontend); this `documents/` folder handy
- [ ] **Do NOT create the repo or write code yet** (rule: fresh repo at kickoff, no templates)

## 10:30 — kickoff setup (10 min, you)
Run these yourself:
```bash
git clone https://github.com/techfusionmanagement-svg/City-Lab-AI-Hackathon.git organizer
```
```bash
mkdir citylab-lab-explainer && cd citylab-lab-explainer && git init
```
```bash
mkdir -p data backend frontend documents api && cp -r ../organizer/lab_reports data/
```
Copy this `documents/` folder in, create `.gitignore` (`.env`, `node_modules/`, `__pycache__/`, `dist/`, `.venv/`, `backend/logs/`), then create an empty GitHub repo `citylab-lab-explainer` and:
```bash
git add . && git commit -m "chore: add CityLab corpus and design docs" && git branch -M main
```
```bash
git remote add origin https://github.com/<your-username>/citylab-lab-explainer.git && git push -u origin main
```
Then paste `CLAUDE_BACKEND.md` into Claude #1 and `CLAUDE_FRONTEND.md` into Claude #2.

## Timeline
| Time | You | Claude BE | Claude FE |
|---|---|---|---|
| 10:40–11:00 | review, commit | step 1–2 skeleton, clean, parse | step 1 scaffold, mocks |
| 11:00–11:45 | commit after each step | step 3–4 rules, classify, **expected tests pass** | step 2–4 layout, results table, chips |
| 11:45–12:30 | wire FE to real API (`VITE_USE_MOCKS=false`) | step 5–7 routes, LLM layer, explain, guard, chat | step 5–6 chat, paste modal |
| 12:30–1:15 | **deploy to Vercel**, set env vars, run REDTEAM.md | step 8–9 fallback parser, deploy files | step 7–8 How-it-works, polish, mobile |
| 1:15–1:50 | bonus (in this order): print summary → Urdu labels → PDF upload | fixes | fixes |
| 1:50–2:15 | README (template below), record the demo video | | |
| 2:15–2:30 | **submit on ETL**: GitHub link, live link, video | | |

**Hard rule:** at 1:15, freeze features if the expected tests or the live link aren't green. Fix those first.

## Commit points (you run them; one logical change each, push every time)
1. `chore: add CityLab corpus and design docs`
2. `feat(backend): FastAPI skeleton with config and health endpoint`
3. `feat(frontend): Vite React Tailwind scaffold with typed API client`
4. `feat(backend): clean boilerplate and parse six report formats`
5. `feat(backend): load ranges, aliases and urgent rules from reference files`
6. `feat(backend): deterministic classification with unit conversion`
7. `test(backend): expected-answer suite for all corpus patients`
8. `feat(frontend): patient list and results table with status chips`
9. `feat(backend): patients, analysis and rules endpoints`
10. `feat(backend): provider-independent LLM layer with retry and usage log`
11. `feat(backend): explanations, doctor questions and privacy guard`
12. `feat(frontend): chat panel, urgent banner and missing-info form`
13. `feat(frontend): paste report modal and how-it-works view`
14. `chore: vercel and docker deployment config`
15. `fix: ...` (whatever red-teaming finds)
16. `docs: README with architecture, known failure cases and demo`

Message style: Conventional Commits (`feat`, `fix`, `test`, `docs`, `chore`, `refactor`), present tense, under 72 chars. Never commit `.env`.

## Vercel deploy (12:30)
1. Vercel → New Project → import the repo.
2. Settings:
   - Framework: Vite
   - Root: repo root
   - Build: `cd frontend && npm install && npm run build`
   - Output: `frontend/dist`
3. `vercel.json` routes `/api/(.*)` → `api/index.py`.
4. Env vars: `LLM_PROVIDER=gemini`, `LLM_MODEL=<model>`, `LLM_API_KEY=<key>`.
5. Deploy → open `/api/health` → open the app on your phone.

If Vercel's Python function fails after 15 minutes of trying, use Docker:

```bash
docker compose up --build
```

Then push the image to Docker Hub and submit `docker-compose.yml` instead.

## README template (paste into README.md and fill in)
```
# CityLab Lab Report Explainer
> Code does the medical math. AI only does the talking.
Live: <vercel link> · Demo video: <link>

## What it does            (3 bullets)
## How it works            (6-step diagram from ARCHITECTURE.md)
## Hackathon checkpoints   (table: checkpoint → how we handle it → example patient)
## Run locally             (backend: pip install -r requirements.txt && uvicorn ...; frontend: npm i && npm run dev; or docker compose up)
## Configuration           (.env.example variables; keys never committed)
## Tests                   (pytest -q → N passed; expected-answer table)
## Reliability             (retry/backoff on 429, template fallback, cache, usage log)
## Cost & speed            (≈1 LLM call/report; avg latency from llm_usage.jsonl)
## Assumptions             (urgent threshold inclusive "hit or pass"; glucose ×18.016 standard constant;
                            pH Level→Urine pH, Protein→Urine Protein context mapping; limits = normal)
## Known failure cases     (be honest — judges score this)
- Report formats very different from the 6 seen rely on the LLM extractor (less reliable).
- Unit conversions only for the explicit table; others → "cannot be classified".
- A name that exactly matches another patient's first name in a normal sentence may trigger a refusal (we prefer safe).
- Qualitative values other than "Negative" are not classified.
- Explanations depend on the LLM; when it is down, simpler template text is shown.
## Tools used             (state honestly: Python/FastAPI, React, Gemini <model> at runtime; coding assistants used)
```

## Demo video (2–3 min, screen + voice)
Follow `PRESENTATION.md` demo order. Record with QuickTime (File → New Screen Recording) and upload unlisted to YouTube or Drive.
