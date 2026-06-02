import React from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  kind: ToastKind
  title: string
  message?: string
  createdAt: number
}

interface ToastStore {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id' | 'createdAt'>, opts?: { ttlMs?: number }) => void
  dismiss: (id: string) => void
  clear: () => void
}

const useToastStore = create<ToastStore>((set, get) => ({
  items: [],
  push: (t, opts) => {
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : String(Date.now() + Math.random())
    const item: ToastItem = { ...t, id, createdAt: Date.now() }
    set((s) => ({ items: [item, ...s.items].slice(0, 4) }))
    const ttlMs = opts?.ttlMs ?? 3500
    window.setTimeout(() => get().dismiss(id), ttlMs)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  clear: () => set({ items: [] }),
}))

export function useToast() {
  const push = useToastStore((s) => s.push)
  return React.useMemo(() => ({ push }), [push])
}

export default function ToastViewport() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  if (items.length === 0) return null

  return createPortal(
    <div style={styles.viewport} aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            ...styles.toast,
            ...(t.kind === 'success'
              ? styles.success
              : t.kind === 'error'
                ? styles.error
                : t.kind === 'warning'
                  ? styles.warning
                  : styles.info),
          }}
          title="Bấm để đóng"
        >
          <div style={styles.titleRow}>
            <span style={styles.title}>{t.title}</span>
            <span style={styles.meta}>×</span>
          </div>
          {t.message && <div style={styles.msg}>{t.message}</div>}
        </button>
      ))}
    </div>,
    document.body,
  )
}

const styles: Record<string, React.CSSProperties> = {
  viewport: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 9500,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
    pointerEvents: 'none',
  },
  toast: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRadius: 16,
    padding: '12px 14px',
    boxShadow: '0 18px 36px rgba(0,0,0,.18)',
    textAlign: 'left',
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontWeight: 900, fontSize: 13 },
  meta: { color: 'var(--color-text-muted)', fontWeight: 900 },
  msg: { marginTop: 6, color: 'var(--color-text-muted)', fontSize: 12, lineHeight: 1.35 },

  success: { borderColor: 'rgba(22,163,74,.35)' },
  error: { borderColor: 'rgba(220,38,38,.35)' },
  warning: { borderColor: 'rgba(217,119,6,.35)' },
  info: { borderColor: 'rgba(8,145,178,.35)' },
}
