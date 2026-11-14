// Canned API used when VITE_USE_MOCKS=true, so the UI can be built without the backend.
import { ApiError } from '../apiError'
import type {
  Analysis,
  AnalysisOptions,
  ChatResponse,
  Demographics,
  ExplainResponse,
  Health,
  PatientSummary,
  Rules,
  UploadResponse,
} from '../types'
import { mockAnalysis, mockCustomAnalysis } from './analyses'
import { MOCK_PATIENTS } from './patients'

const DELAY_MS = 600

function delay<T>(value: T, ms = DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))
}

function fail(message: string, code: string, status: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new ApiError(message, code, status, `mock-${Date.now().toString(16)}`)), DELAY_MS),
  )
}

/** Mirror the backend's explain=false response: statuses only, text fields null. */
function statusesOnly(analysis: Analysis): Analysis {
  return {
    ...analysis,
    summary: null,
    doctor_questions: null,
    generated_by: null,
    results: analysis.results.map((r) => ({ ...r, explanation: null })),
  }
}

const OTHER_PATIENTS_PATTERN = /\b(other|all|every(one|body)'?s?)\s+patients?\b|everyone'?s results/i

function mentionsAnotherPatient(message: string, currentId: string | null): boolean {
  if (OTHER_PATIENTS_PATTERN.test(message)) return true
  const text = message.toLowerCase()
  return MOCK_PATIENTS.some((p) => {
    if (p.id === currentId) return false
    const names = (p.name ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    const tokens = [p.id.toLowerCase(), (p.mrn ?? '').toLowerCase(), ...names].filter(Boolean)
    return tokens.some((token) => new RegExp(`\\b${token}\\b`).test(text))
  })
}

export const mockApi = {
  health: (): Promise<Health> =>
    delay({
      status: 'ok', provider: 'mock', model: 'mock', rules_loaded: true, patients: MOCK_PATIENTS.length,
      cache_size: 0, llm_calls_today: 0, fallbacks_today: 0, avg_latency_ms: null,
    }),

  patients: (): Promise<PatientSummary[]> => delay(MOCK_PATIENTS),

  analysis: (id: string, overrides: Partial<Demographics> = {}, { explain = true }: AnalysisOptions = {}): Promise<Analysis> => {
    const analysis = mockAnalysis(id, overrides.sex ?? null)
    if (!analysis) return fail('Mock data exists only for P004, P005, P006, P012 and P014.', 'not_found', 404)
    return delay(explain ? analysis : statusesOnly(analysis))
  },

  analyze: ({ report_text }: { report_text: string }, { explain = true }: AnalysisOptions = {}): Promise<Analysis> => {
    if (!/\d/.test(report_text)) {
      return fail('No test results were found in the pasted text.', 'no_tests_found', 422)
    }
    const analysis = mockCustomAnalysis()
    return delay(explain ? analysis : statusesOnly(analysis))
  },

  explain: (analysis: Analysis, _lang?: string): Promise<ExplainResponse> => {
    const full = analysis.patient.id === 'custom' ? mockCustomAnalysis() : mockAnalysis(analysis.patient.id, analysis.patient.sex)
    if (!full) return fail('Mock explanation not found.', 'not_found', 404)
    const explanations: Record<string, string> = {}
    for (const r of full.results) explanations[r.canonical_name ?? r.name_in_report] = r.explanation ?? ''
    return delay(
      {
        summary: full.summary ?? '',
        explanations,
        doctor_questions: full.doctor_questions ?? [],
        generated_by: full.generated_by ?? { provider: 'template', model: 'none' },
      },
      1200,
    )
  },

  chat: ({ patient_id, message }: { patient_id: string | null; message: string }, _lang?: string): Promise<ChatResponse> => {
    if (mentionsAnotherPatient(message, patient_id)) {
      return delay({
        reply:
          "I can only discuss the report currently open. Sharing another patient's results is not allowed (CityLab Safety Rule 1: Privacy).",
        refused: true,
        sources: [{ file: '1_lab_safety_rules.md', line: 3 }],
        generated_by: null,
      })
    }
    return delay({
      reply:
        'This is a mock reply. With the real backend, I would explain your results in simple words. Only a licensed doctor can diagnose a condition.',
      refused: false,
      sources: [{ file: '1_lab_safety_rules.md', line: 4 }],
      generated_by: { provider: 'mock', model: 'mock' },
    })
  },

  upload: (_file: Blob, _filename: string): Promise<UploadResponse> =>
    delay({
      report_text: 'Patient Full Name: Sam Lee\nRecorded Age: 30\nBiological Sex: Female\nHemoglobin: 13.2 g/dL\nPlatelet Count: [UNREADABLE] cells/mcL',
      extracted_by: 'mock/mock',
      warnings: ['1 part unreadable'],
    }),

  rules: (): Promise<Rules> =>
    delay({
      aliases: { SGPT: 'ALT', SGOT: 'AST', FBS: 'Fasting Blood Sugar', Hb: 'Hemoglobin', PLT: 'Platelet Count' },
      ranges: [],
      urgent: [{ test: 'Hemoglobin', op: '<=', value: 7.0, unit: 'g/dL' }],
      edge_rule: 'Value exactly on a limit = NORMAL; age bounds are inclusive',
    }),
}
