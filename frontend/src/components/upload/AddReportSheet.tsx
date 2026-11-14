// Add a report: paste text, open a .txt/.md file, or take a photo / choose a PDF (read by POST /api/upload).
// Uploaded text is never classified straight away: the user checks it, then confirms.
import { useLang } from '../../lib/i18n'
import { Camera, FileUp, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../../api'
import { toApiError, type ApiError } from '../../apiError'
import type { Analysis } from '../../types'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

const MAX_IMAGE_SIDE = 1600
const TEXT_FILE = /\.(md|txt|markdown)$/i

interface AddReportSheetProps {
  open: boolean
  onClose: () => void
  onAnalyzed: (reportText: string, analysis: Analysis) => void
}

/** Shrink a photo to at most 1600px on its long side, as JPEG, before uploading. */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/jpeg', 0.85),
  )
}

export function AddReportSheet({ open, onClose, onAnalyzed }: AddReportSheetProps) {
  const lang = useLang()
  const [text, setText] = useState('')
  const [readBy, setReadBy] = useState<{ by: string; warnings: string[] } | null>(null)
  const [busy, setBusy] = useState<'reading' | 'analyzing' | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setText('')
    setReadBy(null)
    setError(null)
    setBusy(null)
  }

  const close = () => {
    if (busy) return
    onClose()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setReadBy(null)
    if (TEXT_FILE.test(file.name) || file.type === 'text/plain' || file.type === 'text/markdown') {
      setText(await file.text())
      return
    }
    setBusy('reading')
    try {
      const isImage = file.type.startsWith('image/')
      const blob = isImage ? await shrinkImage(file).catch(() => file) : file
      const name = isImage ? file.name.replace(/\.\w+$/, '') + '.jpg' : file.name
      const result = await api.upload(blob, name)
      setText(result.report_text)
      setReadBy({ by: result.extracted_by, warnings: result.warnings })
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(null)
    }
  }

  const analyze = async () => {
    const reportText = text.trim()
    if (!reportText) return
    setBusy('analyzing')
    setError(null)
    try {
      const analysis = await api.analyze({ report_text: reportText, age: null, sex: null }, { explain: false, lang })
      onAnalyzed(reportText, analysis)
      reset()
    } catch (e) {
      setError(toApiError(e))
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Add a report" description="Paste the text, open a file, or take a photo of a paper report.">
      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => photoInput.current?.click()} disabled={busy !== null}>
            <Camera className="size-5" /> Take photo
          </Button>
          <Button onClick={() => fileInput.current?.click()} disabled={busy !== null}>
            <FileUp className="size-5" /> Choose file
          </Button>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <input
            ref={fileInput}
            type="file"
            accept=".md,.txt,text/plain,text/markdown,image/*,application/pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        <p className="text-center text-xs text-slate-400">Photos and PDFs up to 4 MB · .txt and .md files</p>

        {busy === 'reading' ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-sm text-slate-600 ring-1 ring-slate-200" role="status">
            <LoaderCircle className="size-6 animate-spin text-accent-600" /> Reading your report…
          </div>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{readBy ? 'Check the text we read' : 'Or paste the report text'}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder={'Recorded Age: 30\nBiological Sex: Female\nHemoglobin: 13.5 g/dL'}
              className="mt-1.5 block w-full resize-y rounded-2xl border-0 bg-slate-50 p-3.5 font-mono text-[14px] leading-relaxed text-slate-800 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-accent-600 focus:outline-none"
            />
          </label>
        )}

        {readBy && (
          <div className="rounded-2xl bg-fuchsia-50 p-3.5 text-sm text-fuchsia-900 ring-1 ring-fuchsia-100">
            <p className="flex items-center gap-1.5 font-medium">
              <Sparkles aria-hidden className="size-4" /> Read by {readBy.by}
            </p>
            <p className="mt-1">Please check the values match your report before you continue.</p>
            {readBy.warnings.length > 0 && (
              <ul className="mt-1.5 list-disc pl-5 text-fuchsia-800">
                {readBy.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="flex gap-2 rounded-2xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div>
              <p>{error.message}</p>
              {error.requestId && <p className="mt-1 font-mono text-[11px] text-amber-700/70">Ref: {error.requestId}</p>}
            </div>
          </div>
        )}

        <Button variant="primary" className="w-full" disabled={!text.trim() || busy !== null} onClick={analyze}>
          {busy === 'analyzing' ? (
            <>
              <LoaderCircle className="size-5 animate-spin" /> Checking ranges…
            </>
          ) : readBy ? (
            'Confirm and analyze'
          ) : (
            'Analyze report'
          )}
        </Button>
      </div>
    </Sheet>
  )
}
