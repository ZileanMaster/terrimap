import React from 'react'

/**
 * ErrorBoundary — prevent "blank screen" on render/runtime errors.
 * Keep it intentionally simple: no external deps, safe in offline mode.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack?: string }
> {
  state = { hasError: false, message: '', stack: undefined as string | undefined }

  static getDerivedStateFromError(err: any) {
    return {
      hasError: true,
      message: err?.message ? String(err.message) : 'Ứng dụng gặp lỗi không xác định.',
      stack: err?.stack ? String(err.stack) : undefined,
    }
  }

  componentDidCatch(error: any, info: any) {
    try {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info)
    } catch {
      // ignore
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>TerriMap gặp lỗi khi hiển thị</div>
          <div style={styles.msg}>{this.state.message}</div>
          <div style={styles.actions}>
            <button
              style={styles.primaryBtn}
              onClick={() => window.location.reload()}
            >
              Tải lại
            </button>
            <button
              style={styles.ghostBtn}
              onClick={() => this.setState({ hasError: false, message: '', stack: undefined })}
            >
              Thử tiếp
            </button>
          </div>
          {this.state.stack && (
            <pre style={styles.stack}>
              {this.state.stack}
            </pre>
          )}
        </div>
      </div>
    )
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    height: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--color-bg, #0b1220)',
    padding: 16,
  },
  card: {
    width: 'min(760px, 100%)',
    borderRadius: 12,
    border: '1px solid var(--color-border, rgba(148,163,184,.35))',
    background: 'var(--color-surface, rgba(255,255,255,.92))',
    boxShadow: '0 12px 30px rgba(0,0,0,.12)',
    padding: 16,
    color: 'var(--color-text, #0f172a)',
  },
  title: { fontSize: 16, fontWeight: 900, marginBottom: 6 },
  msg: { fontSize: 13, color: 'var(--color-text-2, #334155)' },
  actions: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  primaryBtn: {
    border: 0,
    borderRadius: 10,
    background: 'var(--color-accent, #2563eb)',
    color: '#fff',
    padding: '8px 12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  ghostBtn: {
    border: '1px solid var(--color-border, rgba(148,163,184,.45))',
    borderRadius: 10,
    background: '#fff',
    color: '#0f172a',
    padding: '8px 12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  stack: {
    marginTop: 12,
    padding: 12,
    background: 'rgba(15,23,42,.04)',
    borderRadius: 10,
    overflow: 'auto',
    maxHeight: 240,
    fontSize: 11,
    color: '#0f172a',
    border: '1px solid rgba(148,163,184,.35)',
  },
}

