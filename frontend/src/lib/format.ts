// Small text helpers for showing API values. No medical logic here.
import type { Patient, RangeUsed, Source, TestResult } from '../types'

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function formatValue(value: number | string): string {
  return typeof value === 'number' ? formatNumber(value) : value
}

export function formatRange(range: RangeUsed): string {
  if (range.text) return range.text
  const unit = range.unit ? ` ${range.unit}` : ''
  if (range.low !== null && range.high !== null) return `${formatNumber(range.low)}–${formatNumber(range.high)}${unit}`
  if (range.low !== null) return `≥ ${formatNumber(range.low)}${unit}`
  if (range.high !== null) return `≤ ${formatNumber(range.high)}${unit}`
  return '—'
}

export function formatRangeScope(range: RangeUsed): string {
  const who = range.sex === 'All' ? 'All sexes' : range.sex
  return `${who}, ${range.age_min}–${range.age_max} yrs`
}

export function formatSource(source: Source): string {
  return source.line > 0 ? `${source.file}:${source.line}` : `${source.file} (read by AI)`
}

export function sexShort(sex: Patient['sex']): string {
  return sex === 'Male' ? 'M' : sex === 'Female' ? 'F' : '—'
}

export function patientLine(p: Pick<Patient, 'age' | 'sex'>): string {
  return `${p.age ?? '—'} · ${sexShort(p.sex)}`
}

export function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** The display name of a test: canonical when known, else as written in the report. */
export function testName(result: TestResult): string {
  return result.canonical_name ?? result.name_in_report
}
