// Mock Analysis responses, built from the real report lines and reference files in data/lab_reports/.
import type { Analysis, GeneratedBy, Patient, RangeUsed, TestResult } from '../types'

const DISCLAIMER = 'This is not a diagnosis. Only a licensed doctor can diagnose a condition.'
const URGENT_BANNER = '⚠ One or more results are at a dangerous level. Please see a doctor today.'
const GEMINI: GeneratedBy = { provider: 'gemini', model: 'gemini-2.5-flash' }
const TEMPLATE: GeneratedBy = { provider: 'template', model: 'none' }

const HEMATOLOGY = '4_ranges_hematology.md'
const BIOCHEMISTRY = '5_ranges_biochemistry.md'

function range(low: number, high: number, unit: string, sex: string, source_file: string): RangeUsed {
  return { low, high, text: null, unit, sex, age_min: 18, age_max: 100, source_file }
}

function result(partial: Partial<TestResult> & Pick<TestResult, 'name_in_report' | 'value' | 'status' | 'reason' | 'source'>): TestResult {
  return {
    canonical_name: partial.name_in_report,
    alias_note: null,
    unit: null,
    converted: null,
    range: null,
    is_urgent: false,
    urgent_rule: null,
    explanation: null,
    extracted_by: 'regex',
    ...partial,
  }
}

const P004_PATIENT: Patient = {
  id: 'P004', name: 'Diana Prince', age: 42, sex: 'Female', mrn: 'CLD-P004-9942',
  file: 'report_P004_Diana_Prince_Hem_Urgent.md',
}

const P004: Analysis = {
  patient: P004_PATIENT,
  results: [
    result({
      name_in_report: 'Hemoglobin', value: 6.5, unit: 'g/dL',
      range: range(12.1, 15.1, 'g/dL', 'Female', HEMATOLOGY),
      status: 'urgent', is_urgent: true,
      urgent_rule: 'Hemoglobin less than 7.0 g/dL (3_dangerous_urgent_values.md)',
      reason: '6.5 is below 12.1 (LOW) and at/below the urgent limit 7.0 → URGENT',
      explanation:
        'Hemoglobin is the part of your blood that carries oxygen around your body. Your value is much lower than the lab’s normal range and below the lab’s danger limit. Low hemoglobin can have many causes, and only a doctor can find out why. Please see a doctor today.',
      source: { file: P004_PATIENT.file, line: 12 },
    }),
    result({
      name_in_report: 'Platelet Count', value: 120000, unit: 'cells/mcL',
      range: range(150000, 450000, 'cells/mcL', 'All', HEMATOLOGY),
      status: 'low',
      reason: '120000 is below 150000 → LOW (not below the urgent limit 50000)',
      explanation:
        'Platelets are tiny cells that help your blood clot when you get a cut. Your count is a little below the normal range, but not at the danger limit. A doctor can tell you what it means for you.',
      source: { file: P004_PATIENT.file, line: 13 },
    }),
  ],
  missing_info: [],
  ask_message: null,
  urgent_banner: URGENT_BANNER,
  doctor_questions: [
    'My hemoglobin is 6.5 g/dL, which the lab marks as urgent. Should I be seen today?',
    'What could be causing my low hemoglobin and low platelet count?',
    'Do I need repeat tests, and when?',
  ],
  summary:
    'Two results are below the normal range, and one of them (hemoglobin) is at a dangerous level. Please see a doctor today.',
  disclaimer: DISCLAIMER,
  generated_by: GEMINI,
}

const P005_PATIENT: Patient = {
  id: 'P005', name: 'Ethan Hunt', age: 50, sex: 'Male', mrn: 'CLD-P005-9942',
  file: 'report_P005_Ethan_Hunt_Sugar_UnitConv.md',
}

const P005: Analysis = {
  patient: P005_PATIENT,
  results: [
    result({
      name_in_report: 'Fasting Blood Sugar', value: 6.0, unit: 'mmol/L',
      converted: {
        value: 108.1, unit: 'mg/dL',
        steps: '6.0 mmol/L × 18.016 = 108.1 mg/dL (glucose molar mass 180.16 g/mol; standard constant)',
      },
      range: range(70, 99, 'mg/dL', 'All', BIOCHEMISTRY),
      status: 'high',
      reason: '108.1 mg/dL is above 99 → HIGH',
      explanation:
        'Fasting blood sugar is the amount of sugar in your blood after not eating for several hours. Your value was converted from mmol/L to mg/dL so it can be compared with the lab’s range, and it is above normal. A high value can have many causes. Please ask your doctor what it means for you.',
      source: { file: P005_PATIENT.file, line: 12 },
    }),
  ],
  missing_info: [],
  ask_message: null,
  urgent_banner: null,
  doctor_questions: [
    'My fasting blood sugar is 108.1 mg/dL, above the normal range. What could cause this?',
    'Do I need a repeat fasting blood sugar test?',
    'Is there anything I should change before my next test?',
  ],
  summary: 'Your fasting blood sugar is above the lab’s normal range. It is not at a dangerous level.',
  disclaimer: DISCLAIMER,
  generated_by: GEMINI,
}

const P006_PATIENT: Patient = {
  id: 'P006', name: 'Fiona Gallagher', age: 22, sex: 'Female', mrn: 'CLD-P006-9942',
  file: 'report_P006_Fiona_UnknownTest.md',
}

const P006: Analysis = {
  patient: P006_PATIENT,
  results: [
    result({
      name_in_report: 'Serum Ferritin', canonical_name: null, value: 25, unit: 'ng/mL',
      status: 'cannot_classify',
      reason: 'Serum Ferritin has no matching range in the reference files — cannot be classified from the files',
      explanation:
        'Ferritin shows how much iron your body has stored. The lab’s reference files do not include a normal range for this test, so we cannot say whether your value is normal. Your doctor can explain it.',
      source: { file: P006_PATIENT.file, line: 12 },
    }),
  ],
  missing_info: [],
  ask_message: null,
  urgent_banner: null,
  doctor_questions: [
    'My serum ferritin is 25 ng/mL. Is that in a healthy range for me?',
    'Do I need any other iron tests?',
    'When should I have my next check-up?',
  ],
  summary: 'Your report has one test (serum ferritin) that the lab’s files do not cover, so it cannot be classified.',
  disclaimer: DISCLAIMER,
  generated_by: TEMPLATE,
}

const P012_PATIENT: Patient = {
  id: 'P012', name: 'Laura Croft', age: 32, sex: null, mrn: 'CLD-P012-9942',
  file: 'report_P012_Laura_AST_MissingSex.md',
}

const P012_SOURCE = { file: P012_PATIENT.file, line: 12 }

const P012: Analysis = {
  patient: P012_PATIENT,
  results: [
    result({
      name_in_report: 'AST', value: 44, unit: 'U/L',
      status: 'needs_info',
      reason: 'AST ranges differ by sex and sex is missing',
      explanation:
        'AST is an enzyme found mostly in the liver and muscles. The lab uses different normal ranges for men and women, and your report does not say which applies, so we cannot judge this value yet.',
      source: P012_SOURCE,
    }),
  ],
  missing_info: ['sex'],
  ask_message:
    "I can't choose the right normal range for AST because the report doesn't state the patient's biological sex. Please tell me Male or Female.",
  urgent_banner: null,
  doctor_questions: [
    'My AST is 44 U/L. Which normal range applies to me?',
    'Do I need a repeat AST test?',
    'Is there anything I should change before my next test?',
  ],
  summary: 'One result (AST) cannot be judged yet because the report does not state biological sex.',
  disclaimer: DISCLAIMER,
  generated_by: GEMINI,
}

/** P012 after the user supplies sex — the backend's answers from the DDS expected-answer table. */
function p012WithSex(sex: 'Male' | 'Female'): Analysis {
  const isFemale = sex === 'Female'
  const high = isFemale ? 43 : 48
  return {
    ...P012,
    patient: { ...P012_PATIENT, sex },
    results: [
      result({
        name_in_report: 'AST', value: 44, unit: 'U/L',
        range: range(8, high, 'U/L', sex, BIOCHEMISTRY),
        status: isFemale ? 'high' : 'normal',
        reason: isFemale ? `44 is above ${high} → HIGH` : `44 is within 8–${high} → NORMAL`,
        explanation: isFemale
          ? 'AST is an enzyme found mostly in the liver and muscles. Your value is slightly above the lab’s normal range for women. A high value can have many causes. Please ask your doctor what it means for you.'
          : 'AST is an enzyme found mostly in the liver and muscles. Your value is inside the lab’s normal range for men.',
        source: P012_SOURCE,
      }),
    ],
    missing_info: [],
    ask_message: null,
    summary: isFemale
      ? 'Your AST is slightly above the lab’s normal range for women.'
      : 'Your AST is inside the lab’s normal range for men.',
  }
}

const P014_PATIENT: Patient = {
  id: 'P014', name: 'Nancy Drew', age: 29, sex: 'Female', mrn: 'CLD-P014-9942',
  file: 'report_P014_Nancy_Multiple.md',
}

const P014: Analysis = {
  patient: P014_PATIENT,
  results: [
    result({
      name_in_report: 'FBS', canonical_name: 'Fasting Blood Sugar', alias_note: 'FBS = Fasting Blood Sugar',
      value: 85, unit: 'mg/dL',
      range: range(70, 99, 'mg/dL', 'All', BIOCHEMISTRY),
      status: 'normal',
      reason: '85 is within 70–99 → NORMAL',
      explanation:
        'Fasting blood sugar is the amount of sugar in your blood after not eating for several hours. Your value is inside the lab’s normal range.',
      source: { file: P014_PATIENT.file, line: 12 },
    }),
    result({
      name_in_report: 'SGOT', canonical_name: 'AST', alias_note: 'SGOT = AST',
      value: 22, unit: 'U/L',
      range: range(8, 43, 'U/L', 'Female', BIOCHEMISTRY),
      status: 'normal',
      reason: '22 is within 8–43 → NORMAL',
      explanation:
        'SGOT is another name for AST, an enzyme found mostly in the liver and muscles. Your value is inside the lab’s normal range for women.',
      source: { file: P014_PATIENT.file, line: 13 },
    }),
  ],
  missing_info: [],
  ask_message: null,
  urgent_banner: null,
  doctor_questions: [
    'All my results are in the normal range. When should I test again?',
    'Is there anything I should keep doing to stay healthy?',
    'Should I have any other routine tests?',
  ],
  summary: 'Both of your results are inside the lab’s normal ranges.',
  disclaimer: DISCLAIMER,
  generated_by: GEMINI,
}

const ANALYSES: Record<string, Analysis> = { P004, P005, P006, P012, P014 }

/** The mock analysis for a patient, applying a sex override where the mocks support one. */
export function mockAnalysis(id: string, sex: 'Male' | 'Female' | null): Analysis | null {
  const key = id.toUpperCase()
  if (key === 'P012' && sex) return p012WithSex(sex)
  return ANALYSES[key] ?? null
}

/** A pasted report: reuse P014's results under the `custom` id. */
export function mockCustomAnalysis(): Analysis {
  return {
    ...P014,
    patient: { id: 'custom', name: null, age: null, sex: null, mrn: null, file: 'pasted_report' },
    results: P014.results.map((r) => ({ ...r, source: { ...r.source, file: 'pasted_report' } })),
  }
}
