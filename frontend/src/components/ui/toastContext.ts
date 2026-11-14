import { createContext, useContext } from 'react'
import type { ApiError } from '../../apiError'

export type Tone = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  tone: Tone
  message: string
  requestId?: string | null
}

export interface ToastApi {
  show: (message: string, tone?: Tone) => void
  error: (error: ApiError) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
