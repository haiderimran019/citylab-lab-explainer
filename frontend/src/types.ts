// API types — copied from documents/CONTRACT.md. Change only when the contract changes.

export type Status = 'normal' | 'low' | 'high' | 'urgent' | 'cannot_classify' | 'needs_info'

export type Sex = 'Male' | 'Female'

export type MissingField = 'age' | 'sex'

/** Language of AI/template text (`lang` query param). */
export type Lang = 'en' | 'ur'

/** GET /api/health */
export interface Health {
  status: 'ok'
  provider: string
  model: string
  rules_loaded: boolean
  patients: number
  cache_size: number
  llm_calls_today: number
  fallbacks_today: number
  avg_latency_ms: number | null
}

export interface Patient {
  id: string
  name: string | null
  age: number | null
  sex: Sex | null
  mrn: string | null
  file: string
}

/** A row of GET /api/patients */
export interface PatientSummary extends Patient {
  test_count: number
}

/** A file and 1-based line number (0 = not line-based). */
export interface Source {
  file: string
  line: number
}

export interface Conversion {
  value: number
  unit: string
  steps: string
}

export interface RangeUsed {
  low: number | null
  high: number | null
  /** Set only for qualitative ranges such as "Negative" (then low/high are null). */
  text: string | null
  unit: string | null
  sex: string
  age_min: number
  age_max: number
  source_file: string
}

export interface TestResult {
  name_in_report: string
  canonical_name: string | null
  alias_note: string | null
  value: number | string
  unit: string | null
  converted: Conversion | null
  range: RangeUsed | null
  status: Status
  is_urgent: boolean
  urgent_rule: string | null
  reason: string
  explanation: string | null
  source: Source
  /** "llm" = the layout wasn't recognised and the AI copied the line (then source.line = 0). */
  extracted_by: 'regex' | 'llm'
}

export interface GeneratedBy {
  provider: string
  model: string
}

/** GET /api/patients/{id}/analysis and POST /api/analyze */
export interface Analysis {
  patient: Patient
  results: TestResult[]
  missing_info: MissingField[]
  ask_message: string | null
  urgent_banner: string | null
  // null when requested with explain=false (statuses only); fill them via POST /api/explain.
  doctor_questions: string[] | null
  summary: string | null
  disclaimer: string
  generated_by: GeneratedBy | null
}

/** Optional overrides for missing demographics. */
export interface Demographics {
  age: number | null
  sex: Sex | null
}

/** POST /api/analyze body */
export interface AnalyzeRequest extends Demographics {
  report_text: string
}

/** Options for the analysis endpoints. */
export interface AnalysisOptions {
  explain?: boolean
  lang?: Lang
}

/** POST /api/explain response. `explanations` is keyed by canonical_name (or name_in_report). */
export interface ExplainResponse {
  summary: string
  explanations: Record<string, string>
  doctor_questions: string[]
  generated_by: GeneratedBy
}

/** POST /api/upload response. The text is not classified yet. */
export interface UploadResponse {
  report_text: string
  extracted_by: string
  warnings: string[]
}

/** POST /api/chat body. Either patient_id or report_text identifies the report. */
export interface ChatRequest extends Demographics {
  patient_id: string | null
  report_text: string | null
  message: string
}

export interface ChatResponse {
  reply: string
  refused: boolean
  sources: Source[]
  generated_by: GeneratedBy | null
}

/** GET /api/rules */
export interface RuleRange {
  test: string
  sex: string
  age_min: number
  age_max: number
  low: number | null
  high: number | null
  text: string | null
  unit: string | null
  source_file: string
}

export interface RuleUrgent {
  test: string
  op: '<=' | '>='
  value: number
  unit: string
}

export interface Rules {
  aliases: Record<string, string>
  ranges: RuleRange[]
  urgent: RuleUrgent[]
  edge_rule: string
}

/** Every error body the API returns. */
export interface ApiErrorBody {
  error: string
  code: string
  request_id?: string | null
  /** Seconds to wait, only on 429 rate_limited. */
  retry_after?: number | null
}
