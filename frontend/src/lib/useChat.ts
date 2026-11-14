// Chat state for the open report. Resets whenever the report changes.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { toApiError } from '../apiError'
import type { ChatResponse, Demographics, Lang } from '../types'

export type ChatMessage =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; response: ChatResponse }
  | { id: number; role: 'error'; text: string; requestId: string | null }

export interface ChatContext {
  /** Changes whenever a different report is opened. */
  key: string
  patientId: string | null
  reportText: string | null
  overrides: Demographics
  lang: Lang
}

export function useChat(context: ChatContext | null) {
  const contextKey = context?.key ?? null
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [shownKey, setShownKey] = useState(contextKey)
  const nextId = useRef(1)
  const latest = useRef(context)

  useEffect(() => {
    latest.current = context
  })

  // A different report was opened: start a fresh conversation.
  if (shownKey !== contextKey) {
    setShownKey(contextKey)
    setMessages([])
    setSending(false)
  }

  const send = useCallback(async (text: string) => {
    const ctx = latest.current
    const message = text.trim()
    if (!ctx || !message) return
    const sentFor = ctx.key
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text: message }])
    setSending(true)
    try {
      const response = await api.chat(
        { patient_id: ctx.patientId, report_text: ctx.reportText, message, age: ctx.overrides.age, sex: ctx.overrides.sex },
        ctx.lang,
      )
      if (latest.current?.key !== sentFor) return
      setMessages((m) => [...m, { id: nextId.current++, role: 'assistant', response }])
    } catch (error) {
      if (latest.current?.key !== sentFor) return
      const apiError = toApiError(error)
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: 'error', text: apiError.message, requestId: apiError.requestId },
      ])
    } finally {
      if (latest.current?.key === sentFor) setSending(false)
    }
  }, [])

  return { messages, sending, send }
}
