const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams()

export type AppMode = 'normal' | 'viewer' | 'dashboard'

export const APP_MODE: AppMode = (params.get('mode') as AppMode) ?? 'normal'
export const WS_URL: string | null = params.get('ws')
