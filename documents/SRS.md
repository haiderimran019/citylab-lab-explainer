# Software Requirements Specification (SRS)
**Product:** CityLab Lab Report Explainer · **Event:** Tech Fusion '26 AI Hackathon, Challenge B · **Author:** Haider Imran

## 1. Purpose
Patients get lab reports full of numbers they can't understand. This assistant reads a CityLab report, compares every value to the correct normal range from the lab's own files, explains the results in simple words, and gives questions to ask the doctor. It never diagnoses. It admits when the files don't have the answer.

## 2. Scope
- **In scope:** the 6 reference files and the patient reports in `data/lab_reports/`, plus new reports pasted or uploaded in the same style; a web UI; a JSON API.
- **Out of scope:** diagnosis, treatment advice, reference ranges not in the files, storing patient data, user accounts.

## 3. Users
| User | Need |
|---|---|
| Patient | "What do my numbers mean, and should I worry?" |
| Lab staff / judge | Correct, sourced, safe answers they can verify |

## 4. Functional requirements
| ID | Requirement | README checkpoint |
|---|---|---|
| FR1 | Load all files and strip the boilerplate (everything from the first `APPENDIX` heading). | Messy data |
| FR2 | Parse demographics (name, age, sex, MRN) and test lines in all formats: `- Name: v unit`, `* **Name**: v unit`, markdown table, `Test Conducted:`/`Value Recorded:`, `Test:`/`Result:`, `Name -> v`. Use the Gemini extraction fallback if nothing matches. | Messy data |
| FR3 | Map test names to canonical names using `2_medical_glossary.md` (SGPT→ALT, SGOT→AST, FBS→Fasting Blood Sugar, Hb→Hemoglobin, PLT→Platelet Count, RBC, WBC), plus safe context mappings (`pH Level`→Urine pH, `Protein`→Urine Protein). Show the mapping. | 1 |
| FR4 | Convert units before comparing, and show the conversion steps (e.g. glucose 6.0 mmol/L × 18.016 = 108.1 mg/dL). If a unit can't be converted, the status is `cannot_classify`. | 1 |
| FR5 | Choose the range by the patient's age and sex. A value exactly on a limit is NORMAL. Age bounds are inclusive. | 2 |
| FR6 | If age or sex is missing and the range depends on it, do not guess: status is `needs_info` and the app asks for it. Never infer sex from the name. | 2 |
| FR7 | A test with no matching range (e.g. Serum Ferritin) gets status `cannot_classify` and the text "cannot be classified from the files". | 3 |
| FR8 | Flag urgent values from `3_dangerous_urgent_values.md` (threshold hit or passed) and show a "see a doctor today" banner. | 5 |
| FR9 | Explain each test in class-8 language: what it measures and what low or high can mean, without naming a disease as the patient's condition. | – |
| FR10 | Generate 3–5 doctor questions based on the abnormal results. If everything is normal, give general follow-up questions. | 5 |
| FR11 | Chat is locked to one patient. Questions about any other patient (by name, MRN or ID) are refused, citing safety rule 1. | 4 |
| FR12 | Every result shows its source (file and line) and the range file used. | Trust |
| FR13 | Let the user supply a missing age or sex in the UI and re-run the analysis. | 2 |
| FR14 | "How it works" view: raw line → canonical name → converted value → range used → status. | Innovation |

## 5. Non-functional requirements
| ID | Requirement |
|---|---|
| NFR1 | Correctness: statuses come from code only; all expected-answer tests pass. |
| NFR2 | Reliability: if the AI fails or is rate-limited, retry with backoff, then fall back to templates. The app never crashes. |
| NFR3 | Speed: under 3 s per report with AI, under 200 ms without. |
| NFR4 | Cost: at most about one small LLM call per report; cached. |
| NFR5 | Security: keys only in env vars; no keys, stack traces or internal URLs in responses; `.env` never committed. |
| NFR6 | Auditability: every LLM call is logged with the real provider and model; the log is append-only. |
| NFR7 | Privacy: no prompts or patient data in logs; no cross-patient answers. |
| NFR8 | Usability: works on mobile; color plus text labels (not color alone); plain words. |
| NFR9 | Portability: one-command run via Docker Compose. |

## 6. Safety rules (from `1_lab_safety_rules.md`, must always hold)
1. Never disclose another patient's records.
2. Never say the patient has a disease. Repeatedly state that only a licensed doctor can diagnose.
3. Missing age or sex → don't guess; ask.
4. Unknown test or unit → "cannot be classified from the files".

## 7. Acceptance criteria
- The 15-row expected-answer table in `DDS.md` passes as pytest.
- A pasted report in a new format parses correctly.
- With `LLM_API_KEY` removed, the app still works (template text, correct statuses).
- A cross-patient question is refused.
- The live link works on a phone.
