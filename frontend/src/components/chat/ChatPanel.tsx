// Chat about the open report only. Refusals show a lock and the safety-rule citation.
import { useT, type LabelKey } from '../../lib/i18n'
import { ArrowUp, FileText, Lock, MessageCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { formatSource } from '../../lib/format'
import type { ChatMessage } from '../../lib/useChat'
import type { ChatResponse } from '../../types'

const QUICK_REPLIES: LabelKey[] = ['chat.q1', 'chat.q2', 'chat.q3']

interface ChatPanelProps {
  messages: ChatMessage[]
  sending: boolean
  onSend: (text: string) => void
  /** Who the chat is about, shown in the header. */
  subject: string | null
  showHeader?: boolean
}

function Sources({ response }: { response: ChatResponse }) {
  if (response.sources.length === 0) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources">
      {response.sources.map((s) => (
        <li
          key={`${s.file}:${s.line}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500"
        >
          <FileText aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{formatSource(s)}</span>
        </li>
      ))}
    </ul>
  )
}

function AssistantBubble({ response }: { response: ChatResponse }) {
  const t = useT()
  if (response.refused) {
    return (
      <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 ring-1 ring-slate-200">
        <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Lock aria-hidden className="size-3.5" /> {t('chat.refused')}
        </p>
        <p dir="auto" className="text-[15px] leading-relaxed text-slate-700">{response.reply}</p>
        <Sources response={response} />
      </div>
    )
  }
  const offline = response.generated_by?.provider === 'template'
  return (
    <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-white px-4 py-3 ring-1 ring-slate-200">
      <p dir="auto" className="text-[15px] leading-relaxed whitespace-pre-line text-slate-800">{response.reply}</p>
      <Sources response={response} />
      {response.generated_by && (
        <p className="mt-1.5 text-[11px] text-slate-400">{offline ? t('explained.offline') : `${t('explained.by')} ${response.generated_by.model}`}</p>
      )}
    </div>
  )
}

export function ChatPanel({ messages, sending, onSend, subject, showHeader = true }: ChatPanelProps) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, sending])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!draft.trim() || sending) return
    onSend(draft)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader && (
        <header className="shrink-0 border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{t('ask.about')}</h2>
          <p className="truncate text-sm text-slate-500">{subject ? `${t('chat.only')} ${subject}` : t('choose.patient')}</p>
        </header>
      )}

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-4 pt-6 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-700">
              <MessageCircle aria-hidden className="size-6" />
            </span>
            <p className="mt-3 text-[15px] font-medium text-slate-800">{t('chat.empty.title')}</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              {t('chat.empty.text')}
            </p>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p dir="auto" className="max-w-[85%] rounded-2xl rounded-tr-md bg-accent-600 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-white">
                {m.text}
              </p>
            </div>
          ) : m.role === 'assistant' ? (
            <div key={m.id} className="flex animate-fade-up">
              <AssistantBubble response={m.response} />
            </div>
          ) : (
            <div key={m.id} role="alert" className="flex">
              <div className="max-w-[90%] rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <p className="flex items-start gap-2">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {m.text}
                </p>
                {m.requestId && <p className="mt-1 font-mono text-[11px] text-amber-700/70">Ref: {m.requestId}</p>}
              </div>
            </div>
          ),
        )}
        {sending && (
          <div className="flex" aria-label="Writing an answer">
            <div className="flex gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3.5 ring-1 ring-slate-200">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-3 pt-2.5 pb-3">
        <div className="scrollbar-none -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending || !subject}
              onClick={() => onSend(t(q))}
              className="min-h-9 shrink-0 rounded-full bg-accent-50 px-3.5 text-sm font-medium text-accent-800 ring-1 ring-accent-100 hover:bg-accent-100 disabled:opacity-50"
            >
              {t(q)}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Your question</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={2000}
              disabled={!subject}
              placeholder={t('chat.placeholder')}
              className="field-sizing-content block max-h-32 min-h-11 w-full resize-none rounded-2xl border-0 bg-slate-100 px-4 py-2.5 text-[16px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-accent-600 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || sending}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-600 text-white hover:bg-accent-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <ArrowUp className="size-5" strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  )
}
