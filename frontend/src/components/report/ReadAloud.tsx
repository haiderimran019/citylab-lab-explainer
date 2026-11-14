// Reads the summary and explanations aloud with the browser's built-in speech (no network).
import { Square, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLang, useT } from '../../lib/i18n'

export function ReadAloud({ text }: { text: string }) {
  const t = useT()
  const lang = useLang()
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Stop when the text changes (another report) or the component goes away.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [text, supported])

  if (!supported || !text) return null

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'ur' ? 'ur-PK' : 'en-US'
    utterance.rate = 0.95
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-accent-700 hover:bg-accent-50 print:hidden"
    >
      {speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}
      {speaking ? t('read.stop') : t('read.aloud')}
    </button>
  )
}
