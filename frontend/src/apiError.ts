/** A failed API call, carrying a message that is safe to show the user. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly requestId: string | null
  /** Seconds to wait before retrying (only for `rate_limited`). */
  readonly retryAfter: number | null

  constructor(message: string, code: string, status: number, requestId: string | null, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.retryAfter = retryAfter
  }
}

/** Turn anything thrown into an ApiError with a friendly message. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError('Something went wrong. Please try again.', 'unknown', 0, null)
}
