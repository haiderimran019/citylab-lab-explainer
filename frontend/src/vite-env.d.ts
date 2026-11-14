/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API. Defaults to `/api`. */
  readonly VITE_API_BASE?: string
  /** `true` serves canned responses from `src/mocks/` instead of calling the backend. */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
