# LLM test-call evidence — 14 Nov 2026

This folder documents every real AI call made **while testing** the backend, kept apart from the
application's own usage log (`backend/logs/llm_usage.jsonl`), which records real app use only.

Nothing here was edited. The `.jsonl` files are byte-for-byte copies of the logs the app wrote
during the test runs (originals were in the test session's temporary folder). Verify with:

```bash
cd backend/test-evidence/2026-11-14 && shasum -a 256 -c SHA256SUMS
```

The project log was **not** modified by this work
(`sha256 7f523886ba002a9b0a2852371b15a0b5d7d773ff6675f056a7e78cf1c0219cea`, 1 record, before and after).

## A. Application test calls — 61 Gemini requests, logged by the app

Made through the app's normal path (`factory.call_with_retry`), so each one has a usage record with the
real provider and model. Server: local `uvicorn api.index:app`, `LLM_MODEL=gemini-3.5-flash-lite`.

| File | Test run | Records (UTC) | OK | Failed | Operations |
|---|---|---|---|---|---|
| `e2e.jsonl` | End-to-end check (explain, Urdu, chat) | 6 · 07:30:22–07:30:30 | 5 | 1 (Gemini 5xx, retried OK) | explain 3, chat 3 |
| `final.jsonl` | Every-endpoint live check | 5 · 07:33:09–07:33:20 | 4 | 1 (Gemini 5xx, retried OK) | explain 4, chat 1 |
| `rt.jsonl` | REDTEAM.md 20 cases + first fuzz run | 31 · 07:36:02–07:37:39 | 30 | 1 (400 on a garbage "JPEG") | chat 16, extract 9, explain 4, transcribe 2 |
| `rt2.jsonl` | Fuzz re-run after the blank-photo fix | 18 · 07:38:06–07:38:31 | 15 | 3 (2× Gemini 429, 1× 400 garbage "JPEG") | extract 7, explain 6, chat 3, transcribe 2 |
| `rt3.jsonl` | Real photo upload | 1 · 07:39:41 | 1 | 0 | transcribe 1 |
| **Total** | | **61** | **55** | **6** | |

Also kept: `u.jsonl` — 4 **template fallback** records (07:20:50) from an offline smoke test with no key.
These are not AI calls (`provider: template, model: none, fallback_used: true`).

No record contains a prompt, reply, file content or patient name (checked with a text search).

## B. Direct SDK diagnostic calls — about 10 requests, NOT in any usage log

Made directly with the Google SDK (or the provider class outside the app's logged path) to find a working,
fast model after `gemini-2.5-flash` was rejected for this key. Because they bypassed `call_with_retry`, the app
did not log them; they appear only in the Google AI Studio usage for this key. Times are approximate
(14 Nov 2026, about 07:22–07:29 UTC).

| # | Call | Model | Result |
|---|---|---|---|
| 1 | `GeminiProvider.generate` ("Say OK") | gemini-2.5-flash | 404 — model not available to new users |
| 2 | `GeminiProvider.generate` ("Say OK") | gemini-3.8-flash | 504 — deadline exceeded (20 s timeout) |
| 3 | SDK, thinking level MINIMAL | gemini-3.8-flash | 400 — level not supported |
| 4 | SDK, thinking level LOW | gemini-3.8-flash | OK, 33.8 s |
| 5 | `models.list` (not a generation) | — | listed available flash models |
| 6–11 | SDK latency comparison, one short prompt each, in parallel | 2.5-flash-lite, 3.1-flash-lite, 3.5-flash-lite, 3.5-flash, 3.7-flash, 3.8-flash | 404, OK 4.1 s, **OK 3.1 s**, 504, OK 33.3 s, OK 32.7 s |

| 12 | `models.get` pre-deploy check (metadata only, 08:10:10 UTC) | gemini-3.5-flash-lite | exists, version `3.5-flash-lite-07-2026`, supports `generateContent` |

Total: **10 generation requests** (#1–4, #6–11) plus **2 metadata requests** (#5, #12) that generate no text.
Outcome: `gemini-3.5-flash-lite` became the default model.

## C. Post-change verification — 1 Gemini request, logged by the app

After the credential change (#3), one call confirmed the hidden key still works:
`verify-secretstr.jsonl` · 08:06:17.552 UTC · `gemini/gemini-3.5-flash-lite` · OK, 1582 ms ·
`environment: local-test`. It also shows the new record fields.

**Grand total of real Gemini requests during testing: 62 logged (A + C) + 10 unlogged diagnostic generations + 2 unlogged metadata lookups (B).**

## D. Frontend + backend integration check — 0 AI calls

Built frontend served by the backend on port 8770 with the key blanked (offline), clicked through in a browser
(P004 urgent, P012 missing sex → Female → high, phone and laptop layouts). `integration-offline.jsonl`:
3 **template fallback** records, 08:26:34–08:27:04 UTC, `environment: local-test`. No AI request was made.

## E. Live production check — 0 AI calls

Deployment `citylab-lab-explainer-fyprjnn9f` (CLI deploy of main + pending changes), checked 08:29 UTC on
`https://citylab-lab-explainer.vercel.app` before `LLM_API_KEY` was set. It produced 1 usage record, visible only in
Vercel's function logs: `LLM_USAGE` · explain · `template/none` · `fallback_used: true` · `environment: vercel-production`
· `release: null` (CLI deploys carry no git commit; git deploys will).

## From now on
Every app call is logged with `ts` (UTC, milliseconds), `provider`, `model` (the version the API reports),
`environment` (`local`, `test`, `vercel-production`, `vercel-preview`…) and `release` (the deployed git commit,
on Vercel). On Vercel each record is also printed to the function logs as a `LLM_USAGE {...}` line, so it
survives instance restarts. Test runs use `environment: test` and a temporary log, so they never mix with real use.
