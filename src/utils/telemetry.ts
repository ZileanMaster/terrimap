type TelemetryEvent =
  | { kind: 'error'; message: string; stack?: string | undefined; when: string; href?: string | undefined }
  | { kind: 'rejection'; message: string; stack?: string | undefined; when: string; href?: string | undefined }

const STORAGE_KEY = 'terrimap_last_errors_v1'
const MAX_EVENTS = 20

function safeString(v: unknown): string {
  try {
    if (typeof v === 'string') return v
    if (v instanceof Error) return v.message
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function pushEvent(ev: TelemetryEvent) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr: TelemetryEvent[] = raw ? JSON.parse(raw) : []
    arr.unshift(ev)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_EVENTS)))
  } catch {

  }
}

export function initTelemetry() {

  window.addEventListener('error', (e) => {
    const err = (e as any).error as Error | undefined
    const message = err?.message || (e as any).message || 'Unknown error'
    const stack = err?.stack
    pushEvent({ kind: 'error', message: safeString(message), stack, when: new Date().toISOString(), href: location.href })
    try { console.error('[telemetry:error]', e) } catch {}
  })


  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason
    const message = safeString(reason?.message ?? reason)
    const stack = reason?.stack ? String(reason.stack) : undefined
    pushEvent({ kind: 'rejection', message, stack, when: new Date().toISOString(), href: location.href })
    try { console.error('[telemetry:rejection]', e) } catch {}
  })
}

export function readLastErrors(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TelemetryEvent[]) : []
  } catch {
    return []
  }
}
