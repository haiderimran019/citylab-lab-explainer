// App shell: dark sidebar on desktop, dark top bar + bottom tabs on phones; report loading and chat.
import { House, Printer, Settings, WifiOff, Workflow } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { toApiError, type ApiError } from './apiError'
import { ChatPanel } from './components/chat/ChatPanel'
import { BottomNav, type MobileTab } from './components/layout/BottomNav'
import { Menu } from './components/layout/Menu'
import { PatientList, type PatientListProps } from './components/layout/PatientList'
import { SettingsSheet } from './components/layout/SettingsSheet'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { ReportSkeleton, ReportView } from './components/report/ReportView'
import { ErrorState, Home } from './components/report/States'
import { Sheet } from './components/ui/Sheet'
import { Tour } from './components/ui/Tour'
import { useToast } from './components/ui/toastContext'
import { AddReportSheet } from './components/upload/AddReportSheet'
import { patientLine } from './lib/format'
import { useMediaQuery, useOnline, useStoredState } from './lib/hooks'
import { useLang, useT } from './lib/i18n'
import { navigate, useHashRoute } from './lib/route'
import { useChat } from './lib/useChat'
import { useReport, type ReportTarget } from './lib/useReport'
import type { Analysis, Demographics, Health, PatientSummary } from './types'

const NO_OVERRIDES: Demographics = { age: null, sex: null }

export default function App() {
  const route = useHashRoute()
  const toast = useToast()
  const lang = useLang()
  const t = useT()
  const online = useOnline()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Patients and backend status
  const [patients, setPatients] = useState<PatientSummary[] | null>(null)
  const [patientsError, setPatientsError] = useState<ApiError | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const loadPatients = useCallback(() => {
    setPatientsError(null)
    api
      .patients()
      .then(setPatients)
      .catch((e: unknown) => setPatientsError(toApiError(e)))
  }, [])
  useEffect(() => {
    api
      .patients()
      .then(setPatients)
      .catch((e: unknown) => setPatientsError(toApiError(e)))
    api
      .health()
      .then(setHealth)
      .catch(() => undefined) // Only decorative; the app works without it.
  }, [])

  // Pasted report (kept in memory only)
  const [custom, setCustom] = useState<{ text: string; version: number } | null>(null)

  const target: ReportTarget | null = useMemo(() => {
    if (route.kind === 'patient') return { kind: 'patient', id: route.id }
    if (route.kind === 'custom' && custom) return { kind: 'custom', text: custom.text, version: custom.version }
    return null
  }, [route, custom])
  const targetKey = target ? (target.kind === 'patient' ? target.id : `custom#${target.version}`) : null

  // Age/sex the user typed for the open report (never applied to another report).
  const [overrides, setOverrides] = useState<{ key: string | null; values: Demographics }>({ key: null, values: NO_OVERRIDES })
  const activeOverrides = overrides.key === targetKey ? overrides.values : NO_OVERRIDES

  const { state, retry, retryExplain, prime } = useReport(target, activeOverrides, lang)

  // UI state
  const [showPipeline, setShowPipeline] = useStoredState('citylab.howItWorks', false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('report')
  const [patientSheet, setPatientSheet] = useState(false)
  const [addSheet, setAddSheet] = useState(false)
  const [chatSheet, setChatSheet] = useState(false)
  const [settingsSheet, setSettingsSheet] = useState(false)
  const [largeText, setLargeText] = useStoredState('citylab.largeText', false)
  const [profile, setProfile] = useStoredState<Demographics>('citylab.profile', NO_OVERRIDES)
  const [tourOpen, setTourOpen] = useState(false)

  const [shownKey, setShownKey] = useState(targetKey)
  if (shownKey !== targetKey) {
    setShownKey(targetKey)
    setMobileTab('report')
    setPatientSheet(false)
    setChatSheet(false)
  }
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [targetKey])

  // Explanations failed: statuses are still shown, so a gentle toast is enough.
  const lastExplainError = useRef<ApiError | null>(null)
  useEffect(() => {
    if (state.phase === 'ready' && state.explainError && state.explainError !== lastExplainError.current) {
      lastExplainError.current = state.explainError
      toast.error(state.explainError)
    }
  }, [state, toast])

  // Chat
  const chat = useChat(
    target
      ? {
          key: targetKey!,
          patientId: target.kind === 'patient' ? target.id : null,
          reportText: target.kind === 'custom' ? target.text : null,
          overrides: activeOverrides,
          lang,
        }
      : null,
  )

  const analysis: Analysis | null = state.phase === 'ready' ? state.analysis : null
  const listed = route.kind === 'patient' ? (patients?.find((p) => p.id === route.id) ?? null) : null
  const title = analysis?.patient.name ?? listed?.name ?? (route.kind === 'custom' && custom ? t('report.yours') : t('choose.patient'))
  const subjectPatient = analysis?.patient ?? listed
  const testCount = analysis ? analysis.results.length : (listed?.test_count ?? null)
  const subtitle = subjectPatient
    ? `${patientLine(subjectPatient)}${testCount === null ? '' : ` · ${testCount} ${lang === 'en' ? (testCount === 1 ? 'test' : 'tests') : t('stat.tests')}`}`
    : null
  const chatSubject = target ? (analysis?.patient.name ?? (target.kind === 'custom' ? 'your pasted report' : title)) : null

  const selectPatient = (id: string) => {
    setPatientSheet(false)
    navigate({ kind: 'patient', id })
  }

  const onAnalyzed = (text: string, result: Analysis) => {
    const version = (custom?.version ?? 0) + 1
    prime({ kind: 'custom', text, version }, result, lang)
    setCustom({ text, version })
    setAddSheet(false)
    navigate({ kind: 'custom' })
    toast.show('Report analyzed', 'success')
  }

  const recheck = (values: Demographics) => setOverrides({ key: targetKey, values: { ...activeOverrides, ...values } })

  const listProps: PatientListProps = {
    patients,
    error: patientsError,
    onRetry: loadPatients,
    selectedId: route.kind === 'patient' ? route.id : null,
    onSelect: selectPatient,
  }

  const chatPanel = <ChatPanel messages={chat.messages} sending={chat.sending} onSend={chat.send} subject={chatSubject} showHeader={false} />

  let content: React.ReactNode
  if (!target) {
    content = <Home list={listProps} health={health} onAddReport={() => setAddSheet(true)} />
  } else if (state.phase === 'error') {
    content = <ErrorState error={state.error} onRetry={retry} />
  } else if (state.phase === 'ready') {
    content = (
      <ReportView
        analysis={state.analysis}
        explaining={state.explaining}
        showPipeline={showPipeline}
        onTogglePipeline={setShowPipeline}
        onRecheck={recheck}
        onAsk={() => setChatSheet(true)}
        explainError={state.explainError}
        onRetryExplain={retryExplain}
        fromCache={state.fromCache}
        profile={profile}
      />
    )
  } else {
    content = <ReportSkeleton slow={state.phase === 'loading' && state.slow} onRetry={retry} />
  }

  const mobileChat = !isDesktop && mobileTab === 'ask' && target

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[300px_minmax(0,1fr)] print:block">
      <Sidebar
        {...listProps}
        isHome={route.kind === 'home'}
        explainer={health ? { provider: health.provider, model: health.model } : null}
        onAddReport={() => setAddSheet(true)}
        onSettings={() => setSettingsSheet(true)}
      />

      <div className="flex min-w-0 flex-col">
        <TopBar
          title={title}
          subtitle={subtitle}
          onSwitch={() => setPatientSheet(true)}
          menu={
            <Menu
              items={[
                { label: t('nav.home'), icon: <House className="size-5" />, onSelect: () => navigate({ kind: 'home' }) },
                { label: t('how.it.works'), icon: <Workflow className="size-5" />, onSelect: () => setShowPipeline(!showPipeline), checked: showPipeline },
                { label: t('download.summary'), icon: <Printer className="size-5" />, onSelect: () => window.print() },
                { label: t('nav.settings'), icon: <Settings className="size-5" />, onSelect: () => setSettingsSheet(true) },
              ]}
            />
          }
        />

        {!online && (
          <div role="status" className="flex items-center justify-center gap-2 bg-slate-700 px-4 py-2 text-sm text-white print:hidden">
            <WifiOff aria-hidden className="size-4" /> You’re offline. Results you already opened still work.
          </div>
        )}

        {mobileChat ? (
          <div className="fixed inset-x-0 top-16 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-20 bg-[#f5f5fa]">{chatPanel}</div>
        ) : (
          <main
            style={largeText ? { zoom: 1.15 } : undefined}
            className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-16 print:max-w-none print:p-0"
          >
            {content}
          </main>
        )}
      </div>

      <BottomNav tab={mobileTab} onTab={setMobileTab} onAddReport={() => setAddSheet(true)} canAsk={target !== null} />

      <Sheet open={patientSheet} onClose={() => setPatientSheet(false)} title={t('choose.patient')}>
        <PatientList {...listProps} />
      </Sheet>

      <AddReportSheet open={addSheet} onClose={() => setAddSheet(false)} onAnalyzed={onAnalyzed} />

      <SettingsSheet
        open={settingsSheet}
        onClose={() => setSettingsSheet(false)}
        largeText={largeText}
        onLargeText={setLargeText}
        profile={profile}
        onProfile={setProfile}
        onReplayTour={() => {
          setSettingsSheet(false)
          setTourOpen(true)
        }}
      />

      <Tour open={tourOpen} onDone={() => setTourOpen(false)} />

      {isDesktop && (
        <Sheet
          open={chatSheet}
          onClose={() => setChatSheet(false)}
          title={t('ask.about')}
          description={chatSubject ? `${t('chat.only')} ${chatSubject}` : undefined}
          variant="side"
        >
          <div className="-mx-6 -mb-6 h-[calc(100dvh-6.5rem)] bg-[#f5f5fa]">{chatPanel}</div>
        </Sheet>
      )}
    </div>
  )
}
