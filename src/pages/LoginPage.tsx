import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore.js'
import Button from '../components/ui/Button.js'
import Input from '../components/ui/Input.js'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const authError = useAuthStore((s) => s.authError)
  const clearError = useAuthStore((s) => s.clearError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setSubmitting(true)
    try {
      if (mode === 'signin') await signIn(email, password)
      else await signUp(email, password, fullName)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowA} />
      <div style={styles.glowB} />
      <div style={styles.shell}>
        <section style={styles.brandPanel}>
          <div style={styles.brandBadge}>TM</div>
          <div style={styles.brandKicker}>TerriMap</div>
          <h1 style={styles.brandTitle}>Quản lý lãnh thổ, báo cáo cụm và phân chia khu vực trong một luồng duy nhất.</h1>
          <p style={styles.brandText}>
            Giao diện được tối ưu cho vận hành hằng ngày: rõ ràng, ít nhiễu, tập trung vào việc chọn dự án và đi thẳng vào màn làm việc.
          </p>

          <div style={styles.statRow}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>01</div>
              <div style={styles.statLabel}>Đăng nhập</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>02</div>
              <div style={styles.statLabel}>Chọn dự án</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>03</div>
              <div style={styles.statLabel}>Bắt đầu vận hành</div>
            </div>
          </div>
        </section>

        <section style={styles.formPanel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelKicker}>{mode === 'signin' ? 'Đăng nhập hệ thống' : 'Tạo tài khoản mới'}</div>
              <div style={styles.panelTitle}>TerriMap</div>
            </div>
          </div>

          <div style={styles.tabs}>
            <button
              type="button"
              onClick={() => { setMode('signin'); clearError() }}
              style={{ ...styles.tab, ...(mode === 'signin' ? styles.tabActive : {}) }}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); clearError() }}
              style={{ ...styles.tab, ...(mode === 'signup' ? styles.tabActive : {}) }}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {mode === 'signup' && (
              <div style={styles.field}>
                <label style={styles.label}>Họ và tên</label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                  autoComplete="name"
                />
                <div style={styles.helper}>Tên hiển thị trong khu vực làm việc và báo cáo.</div>
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Mật khẩu</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <div style={styles.helper}>Mật khẩu tối thiểu 6 ký tự.</div>
            </div>

            {authError && (
              <div style={styles.error} role="alert">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              style={styles.submit}
            >
              {submitting ? 'Đang xử lý...' : (mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản')}
            </Button>
          </form>

          <div style={styles.footer}>
            {mode === 'signin' ? (
              <span>
                Chưa có tài khoản?{' '}
                <button type="button" onClick={() => setMode('signup')} style={styles.link}>Đăng ký</button>
              </span>
            ) : (
              <span>
                Đã có tài khoản?{' '}
                <button type="button" onClick={() => setMode('signin')} style={styles.link}>Đăng nhập</button>
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    position: 'relative',
    overflow: 'hidden',
    background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent) 16%, transparent) 0, transparent 34%), linear-gradient(180deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 85%, #000) 100%)',
    padding: '24px',
  },
  glowA: {
    position: 'absolute',
    inset: 'auto auto -140px -120px',
    width: 340,
    height: 340,
    borderRadius: '50%',
    background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 20%, transparent) 0%, transparent 72%)',
    pointerEvents: 'none',
  },
  glowB: {
    position: 'absolute',
    inset: '-120px -80px auto auto',
    width: 380,
    height: 380,
    borderRadius: '50%',
    background: 'radial-gradient(circle, color-mix(in srgb, var(--color-info) 18%, transparent) 0%, transparent 72%)',
    pointerEvents: 'none',
  },
  shell: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1180,
    minHeight: 'calc(100dvh - 48px)',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 24,
    alignItems: 'stretch',
  },
  brandPanel: {
    border: '1px solid var(--color-border)',
    borderRadius: 28,
    background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
    boxShadow: '0 24px 56px rgba(0,0,0,.18)',
    padding: 32,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 0,
  },
  brandBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--color-accent)',
    color: '#fff',
    fontWeight: 900,
    letterSpacing: '.06em',
    marginBottom: 18,
  },
  brandKicker: {
    textTransform: 'uppercase',
    letterSpacing: '.12em',
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--color-text-2)',
  },
  brandTitle: {
    marginTop: 12,
    fontSize: 'clamp(2.1rem, 4vw, 4rem)',
    lineHeight: 1.02,
    letterSpacing: '-0.05em',
    color: 'var(--color-text)',
    maxWidth: '12ch',
  },
  brandText: {
    marginTop: 18,
    maxWidth: 560,
    color: 'var(--color-text-2)',
    lineHeight: 1.7,
    fontSize: 15,
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginTop: 32,
  },
  statCard: {
    border: '1px solid var(--color-border)',
    borderRadius: 20,
    background: 'var(--color-surface)',
    padding: 16,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 900,
    color: 'var(--color-accent)',
    letterSpacing: '.08em',
  },
  statLabel: {
    marginTop: 10,
    color: 'var(--color-text)',
    fontWeight: 800,
    fontSize: 14,
  },
  formPanel: {
    border: '1px solid var(--color-border)',
    borderRadius: 28,
    background: 'color-mix(in srgb, var(--color-surface) 96%, transparent)',
    boxShadow: '0 24px 56px rgba(0,0,0,.18)',
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },
  panelKicker: {
    color: 'var(--color-text-2)',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  panelTitle: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: '-0.04em',
    color: 'var(--color-text)',
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
    padding: 6,
    borderRadius: 18,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    marginBottom: 22,
  },
  tab: {
    border: 0,
    background: 'transparent',
    color: 'var(--color-text-2)',
    fontWeight: 800,
    fontSize: 14,
    borderRadius: 12,
    padding: '12px 14px',
    cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    boxShadow: '0 10px 28px rgba(0,0,0,.08)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text-2)',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  helper: {
    fontSize: 12,
    color: 'var(--color-text-3)',
    lineHeight: 1.4,
  },
  error: {
    border: '1px solid rgba(220,38,38,.25)',
    background: 'rgba(220,38,38,.10)',
    color: 'var(--color-danger)',
    borderRadius: 14,
    padding: '11px 12px',
    fontSize: 13,
  },
  submit: {
    marginTop: 4,
    width: '100%',
    height: 46,
  },
  footer: {
    marginTop: 18,
    color: 'var(--color-text-2)',
    fontSize: 13,
  },
  link: {
    border: 0,
    background: 'transparent',
    color: 'var(--color-accent)',
    fontWeight: 900,
    cursor: 'pointer',
    padding: 0,
  },
}
