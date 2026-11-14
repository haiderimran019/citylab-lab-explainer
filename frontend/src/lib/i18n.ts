// Static UI labels in English and Urdu. AI/template text comes translated from the API (lang=ur).
// Test names, numbers, units and reasons stay in English, as the contract says.
import { useSyncExternalStore } from 'react'
import type { Lang } from '../types'

const en = {
  'nav.report': 'Report',
  'nav.ask': 'Ask',
  'nav.add': 'Add report',
  'nav.overview': 'Overview',
  'nav.patients': 'Patients',
  'nav.settings': 'Settings',
  'nav.home': 'Home',
  'search.placeholder': 'Search name or ID',
  'choose.patient': 'Choose a patient',
  'add.report': 'Add a report',
  'how.it.works': 'How it works',
  'download.summary': 'Download summary',
  'ask.about': 'Ask about this report',
  'report.for': 'Lab report for',
  'report.yours': 'Your report',
  age: 'Age',
  sex: 'Sex',
  'not.given': 'not given',
  years: 'years',
  Male: 'Male',
  Female: 'Female',
  'stat.tests': 'Tests',
  'stat.normal': 'Normal',
  'stat.outside': 'Outside range',
  'stat.notjudged': 'Not judged',
  'simple.words': 'In simple words',
  'summary.missing': 'A summary isn’t available right now. Your results below are still correct.',
  'read.aloud': 'Read aloud',
  'read.stop': 'Stop',
  questions: 'Questions for your doctor',
  copy: 'Copy',
  copied: 'Copied',
  'results.title': 'Test results',
  'results.hint': 'Tap a test for details',
  'col.test': 'Test',
  'col.result': 'Result',
  'col.range': 'Normal range',
  'col.status': 'Status',
  'status.normal': 'Normal',
  'status.low': 'Low',
  'status.high': 'High',
  'status.urgent': 'Urgent',
  'status.cannot_classify': 'Cannot be classified from the files',
  'status.cannot_classify.short': 'Can’t classify',
  'status.needs_info': 'Need age or sex',
  'detail.range': 'Normal range used',
  'detail.norange': 'No range applied',
  'detail.urgent': 'Urgent limit',
  'detail.conversion': 'Unit conversion',
  'detail.source': 'Source in report',
  'explain.missing': 'A simple explanation isn’t available right now.',
  'urgent.note': 'This does not mean something is wrong for sure, but a doctor should check today.',
  'needs.title': 'We need a little more information',
  'needs.note': 'Normal ranges differ by age and for men and women, so we need this to be accurate. We never guess.',
  'needs.sex': 'Biological sex',
  'needs.recheck': 'Re-check',
  'needs.saved': 'Use my saved details',
  'explained.by': 'Explained by',
  'explained.offline': 'Offline explanation',
  'chat.placeholder': 'Ask a question…',
  'chat.q1': 'Explain my results simply',
  'chat.q2': 'What should I ask my doctor?',
  'chat.q3': 'Is anything urgent?',
  'chat.refused': 'Not allowed',
  'chat.empty.title': 'Questions about these results?',
  'chat.empty.text': 'Answers come only from this report and the lab’s files. No diagnosis — only a doctor can diagnose.',
  'chat.only': 'Only about',
  'home.lead': 'Understand your',
  'home.title': 'lab report',
  'home.text': 'Every value is checked against the lab’s own ranges, then explained in simple words.',
  'home.pick.desktop': 'Choose a patient on the left or paste a report.',
  'home.pick.phone': 'Choose a patient below or add your own report.',
  'patient.list': 'Patient list',
  'try.again': 'Try again',
  'saved.copy': 'You’re offline, so this is the copy saved on this device.',
}

export type LabelKey = keyof typeof en

const ur: Record<LabelKey, string> = {
  'nav.report': 'رپورٹ',
  'nav.ask': 'پوچھیں',
  'nav.add': 'رپورٹ شامل کریں',
  'nav.overview': 'جائزہ',
  'nav.patients': 'مریض',
  'nav.settings': 'ترتیبات',
  'nav.home': 'ہوم',
  'search.placeholder': 'نام یا آئی ڈی تلاش کریں',
  'choose.patient': 'مریض منتخب کریں',
  'add.report': 'رپورٹ شامل کریں',
  'how.it.works': 'یہ کیسے کام کرتا ہے',
  'download.summary': 'خلاصہ ڈاؤن لوڈ کریں',
  'ask.about': 'اس رپورٹ کے بارے میں پوچھیں',
  'report.for': 'لیب رپورٹ:',
  'report.yours': 'آپ کی رپورٹ',
  age: 'عمر',
  sex: 'جنس',
  'not.given': 'درج نہیں',
  years: 'سال',
  Male: 'مرد',
  Female: 'عورت',
  'stat.tests': 'ٹیسٹ',
  'stat.normal': 'نارمل',
  'stat.outside': 'حد سے باہر',
  'stat.notjudged': 'فیصلہ نہیں ہوا',
  'simple.words': 'آسان الفاظ میں',
  'summary.missing': 'خلاصہ ابھی دستیاب نہیں۔ نیچے دیے گئے نتائج پھر بھی درست ہیں۔',
  'read.aloud': 'پڑھ کر سنائیں',
  'read.stop': 'روکیں',
  questions: 'ڈاکٹر سے پوچھنے کے سوالات',
  copy: 'کاپی',
  copied: 'کاپی ہو گیا',
  'results.title': 'ٹیسٹ کے نتائج',
  'results.hint': 'تفصیل کے لیے ٹیسٹ پر ٹیپ کریں',
  'col.test': 'ٹیسٹ',
  'col.result': 'نتیجہ',
  'col.range': 'نارمل حد',
  'col.status': 'حالت',
  'status.normal': 'نارمل',
  'status.low': 'کم',
  'status.high': 'زیادہ',
  'status.urgent': 'فوری',
  'status.cannot_classify': 'فائلوں سے درجہ بندی ممکن نہیں',
  'status.cannot_classify.short': 'درجہ بندی ممکن نہیں',
  'status.needs_info': 'عمر یا جنس درکار ہے',
  'detail.range': 'استعمال شدہ نارمل حد',
  'detail.norange': 'کوئی حد لاگو نہیں',
  'detail.urgent': 'فوری حد',
  'detail.conversion': 'اکائی کی تبدیلی',
  'detail.source': 'رپورٹ میں ماخذ',
  'explain.missing': 'آسان وضاحت ابھی دستیاب نہیں۔',
  'urgent.note': 'اس کا مطلب یہ نہیں کہ ضرور کچھ غلط ہے، لیکن ڈاکٹر کو آج ہی دکھائیں۔',
  'needs.title': 'ہمیں تھوڑی مزید معلومات چاہیے',
  'needs.note': 'نارمل حد عمر اور مرد و عورت کے لیے مختلف ہوتی ہے، اس لیے درست جواب کے لیے یہ ضروری ہے۔ ہم کبھی اندازہ نہیں لگاتے۔',
  'needs.sex': 'حیاتیاتی جنس',
  'needs.recheck': 'دوبارہ چیک کریں',
  'needs.saved': 'میری محفوظ معلومات استعمال کریں',
  'explained.by': 'وضاحت از',
  'explained.offline': 'آف لائن وضاحت',
  'chat.placeholder': 'سوال لکھیں…',
  'chat.q1': 'میرے نتائج آسان الفاظ میں سمجھائیں',
  'chat.q2': 'مجھے ڈاکٹر سے کیا پوچھنا چاہیے؟',
  'chat.q3': 'کیا کچھ فوری ہے؟',
  'chat.refused': 'اجازت نہیں',
  'chat.empty.title': 'ان نتائج کے بارے میں سوال؟',
  'chat.empty.text': 'جوابات صرف اسی رپورٹ اور لیب کی فائلوں سے آتے ہیں۔ تشخیص نہیں — صرف ڈاکٹر تشخیص کر سکتا ہے۔',
  'chat.only': 'صرف اس بارے میں:',
  'home.lead': 'اپنی',
  'home.title': 'لیب رپورٹ سمجھیں',
  'home.text': 'ہر قدر لیب کی اپنی حدود سے جانچی جاتی ہے، پھر آسان الفاظ میں سمجھائی جاتی ہے۔',
  'home.pick.desktop': 'بائیں طرف سے مریض منتخب کریں یا رپورٹ پیسٹ کریں۔',
  'home.pick.phone': 'نیچے سے مریض منتخب کریں یا اپنی رپورٹ شامل کریں۔',
  'patient.list': 'مریضوں کی فہرست',
  'try.again': 'دوبارہ کوشش کریں',
  'saved.copy': 'آپ آف لائن ہیں، اس لیے یہ اس ڈیوائس پر محفوظ کاپی ہے۔',
}

const LABELS: Record<Lang, Record<LabelKey, string>> = { en, ur }
const STORAGE_KEY = 'citylab.lang'

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ur' ? 'ur' : 'en'
  } catch {
    return 'en'
  }
}

let current: Lang = readStored()
document.documentElement.lang = current
const listeners = new Set<() => void>()

export function setLang(lang: Lang): void {
  current = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
  document.documentElement.lang = lang
  listeners.forEach((notify) => notify())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => current)
}

/** Returns a function that looks up a label in the current language. */
export function useT(): (key: LabelKey) => string {
  const lang = useLang()
  return (key) => LABELS[lang][key]
}
