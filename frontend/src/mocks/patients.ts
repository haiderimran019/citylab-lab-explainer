// Mock GET /api/patients, matching the demographics in data/lab_reports/.
import type { PatientSummary } from '../types'

function patient(
  id: string, name: string, age: number | null, sex: 'Male' | 'Female' | null, file: string, test_count: number,
): PatientSummary {
  return { id, name, age, sex, mrn: `CLD-${id}-9942`, file, test_count }
}

export const MOCK_PATIENTS: PatientSummary[] = [
  patient('P001', 'Alice Smith', 28, 'Female', 'report_P001_Alice_Smith_CBC.md', 2),
  patient('P002', 'Bob Jones', 35, 'Female', 'report_P002_Bob_Jones_Liver.md', 1),
  patient('P003', 'Charlie Brown', null, null, 'report_P003_Charlie_Brown_Sugar_NoDemo.md', 1),
  patient('P004', 'Diana Prince', 42, 'Female', 'report_P004_Diana_Prince_Hem_Urgent.md', 2),
  patient('P005', 'Ethan Hunt', 50, 'Male', 'report_P005_Ethan_Hunt_Sugar_UnitConv.md', 1),
  patient('P006', 'Fiona Gallagher', 22, 'Female', 'report_P006_Fiona_UnknownTest.md', 1),
  patient('P007', 'George Costanza', 65, 'Male', 'report_P007_George_Thyroid.md', 1),
  patient('P008', 'Haley Dunphy', 19, 'Female', 'report_P008_Haley_Urine.md', 2),
  patient('P009', 'Ian Malcolm', 48, 'Male', 'report_P009_Ian_Liver_High.md', 2),
  patient('P010', 'Julia Child', 55, 'Female', 'report_P010_Julia_Cholesterol.md', 1),
  patient('P011', 'Kevin Hart', 40, 'Male', 'report_P011_Kevin_CBC.md', 2),
  patient('P012', 'Laura Croft', 32, null, 'report_P012_Laura_AST_MissingSex.md', 1),
  patient('P013', 'Michael Scott', 45, 'Male', 'report_P013_Michael_Sugar_Urgent.md', 1),
  patient('P014', 'Nancy Drew', 29, 'Female', 'report_P014_Nancy_Multiple.md', 2),
]
