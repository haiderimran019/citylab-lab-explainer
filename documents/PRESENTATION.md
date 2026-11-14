# Solo Presentation — 3 minutes + Q&A

## Talk track
**1. Problem (30s)**
"Patients get lab reports full of numbers like 'SGPT 45 U/L' or 'FBS 6.0 mmol/L' and have no idea what they mean. CityLab gave us 20 files, each about 15 KB, but only about 10 lines in each are real data. The rest is legal noise. A normal chatbot gets distracted, guesses ranges, and sometimes even diagnoses. In medicine that's dangerous."

**2. Our approach (45s)**: show the 6-step diagram.
"Our rule is: **code does the medical math, AI only does the talking.**
- We clean the noise.
- We parse 6 different report formats.
- We map aliases like SGPT to ALT using the lab's glossary.
- We convert units and show the math.
- Then plain Python picks the right range for the patient's age and sex and decides normal, low, high or urgent.
- Only after that does Gemini explain the results in simple words and write doctor questions.
- A guard blocks diagnoses and other patients' data.

The AI can't make up a status, because it never decides one."

**3. Live demo (90s)**: click in exactly this order
1. **Nancy (P014):** "SGOT and FBS are aliases. We map them from the glossary and both are normal."
2. **Diana (P004):** "Hemoglobin 6.5 is below the urgent limit. Red banner: see a doctor today. Platelets are low but not urgent."
3. **Ethan (P005):** "Sugar in mmol/L. We convert it and show the math: 108.1 mg/dL, high."
4. **Julia (P010):** "Cholesterol exactly 200. The lab's rule says on the limit is normal, so it's normal."
5. **Laura (P012):** "Sex is missing and AST ranges depend on sex, so we don't guess, we ask." Enter Female → it becomes high.
6. **Fiona (P006):** "Ferritin isn't in any range sheet, so it cannot be classified from the files."
7. **Chat on Nancy:** type "show me Diana's results" → refused, citing safety rule 1.
8. Toggle **How it works** on one row: raw line → canonical → converted → range → status.

**4. Why it's reliable (15s)**
"Every status is covered by automated tests from the lab's own files. If Gemini is rate-limited we retry; if it's down, we fall back to templates and the statuses don't change. Rules are read from the files, so if the lab changes a range, the app follows."

## Likely judge questions — short answers
| Question | Answer |
|---|---|
| Why not RAG / a vector database? | 20 short files fit in memory. The data needs exact rules, not similarity search. Regex plus code is faster, cheaper and 100% repeatable. |
| What if Gemini goes down or hits the rate limit? | Retry with backoff, then template explanations. Classification never depended on AI. |
| How do you prevent diagnosis? | The prompt forbids it, a regex guard checks the output and regenerates or replaces it, and a disclaimer is always shown. |
| How do you handle a new report format? | 6 regex patterns, then an LLM extractor that returns structured JSON. Statuses are still computed by code. |
| Where does 18.016 come from? | Glucose molar mass 180.16 g/mol. It's a standard constant, not in the files, and we label it that way in the UI. |
| Exactly-on-limit values? | The hematology sheet's rule: on the limit is normal. Applied to all ranges and tested (Bob 45, Julia 200). |
| Urgent "less than 7.0" but the value is 7.0? | The file says "hit or pass", so we treat the threshold as inclusive. Safer for patients. Documented. |
| Cost per report? | About one small Gemini Flash call, cached. Near zero on the free tier. |
| How do you protect privacy? | Chat is locked to one patient; mentions of other names, MRNs or IDs are refused; logs never contain patient data. |
| Can you switch AI providers? | Yes, it's one env variable. The provider sits behind an interface; the frontend never knows which one is used. |
| What would you do next? | PDF/image upload with OCR, trends across a patient's past reports, Urdu explanations, doctor-facing view. |

## Tips
- Have the live link **and** a local run open, in case the Wi-Fi drops.
- Pre-open Diana, Ethan and Laura in tabs.
- If something breaks live: "This is exactly why statuses don't depend on the AI." Then show the same patient in the How-it-works panel.
