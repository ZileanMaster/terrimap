/**
 * LoginPage — Authentication
 *
 * - Glass card on dark gradient background
 * - Tabs: Sign In / Sign Up
 * - Locale toggle via uiStore (i18next sync)
 */

import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore.js'
import { useUIStore } from '../store/uiStore.js'
import Input from '../components/ui/Input.js'
import Button, { IconButton } from '../components/ui/Button.js'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const locale = useUIStore((s) => s.locale)
  const toggleLocale = useUIStore((s) => s.toggleLocale)

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
      <div style={styles.topRight}>
        <IconButton onClick={toggleLocale} style={styles.topBtn} title="Đổi ngôn ngữ">
          {locale.toUpperCase()}
        </IconButton>
      </div>

      <div style={styles.bgShape1} />
      <div style={styles.bgShape2} />
      <div style={styles.bgShape3} />

      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>⬡</span>
          <span style={styles.logoText}>TerriMap</span>
        </div>
        <p style={styles.subtitle}>
          {mode === 'signin'
            ? 'Đăng nhập vào hệ thống quản lý vùng thương mại'
            : 'Tạo tài khoản mới'}
        </p>

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
                style={styles.input}
              />
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
              style={styles.input}
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
              style={styles.input}
            />
          </div>

          {authError && (
            <div style={styles.error} role="alert">
              <span style={styles.errorIcon}>⚠</span>
              <span>{authError}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            style={{ ...styles.submit, ...(submitting ? styles.submitDisabled : {}) }}
          >
            {submitting ? '⏳ Đang xử lý…' : (mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản')}
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
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', Roboto, system-ui, sans-serif",
  },

  topRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    display: 'flex',
    gap: 10,
  },
  topBtn: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    color: 'rgba(255,255,255,0.85)',
    fontWeight: 900,
    width: 48,
  },

  bgShape1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
    top: -100,
    left: -100,
    animation: 'float 8s ease-in-out infinite',
  },
  bgShape2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
    bottom: -50,
    right: -50,
    animation: 'float 10s ease-in-out infinite reverse',
  },
  bgShape3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)',
    top: '50%',
    right: '20%',
    animation: 'float 12s ease-in-out infinite',
  },

  card: {
    position: 'relative',
    zIndex: 10,
    width: 420,
    maxWidth: '92vw',
    padding: '40px 36px 28px',
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset',
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  logoIcon: {
    fontSize: 32,
    color: '#818cf8',
    filter: 'drop-shadow(0 0 8px rgba(129,140,248,0.5))',
  },
  logoText: {
    fontSize: 26,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 1.5,
  },

  tabs: {
    display: 'flex',
    gap: 4,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(99,102,241,0.25)',
    color: '#c7d2fe',
    boxShadow: '0 2px 8px rgba(99,102,241,0.2)',
  },

  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
  },

  error: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    fontSize: 13,
  },
  errorIcon: { fontSize: 14, flexShrink: 0 },

  submit: {
    marginTop: 6,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderColor: 'transparent',
    boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
    height: 44,
  },
  submitDisabled: { opacity: 0.7 },

  footer: {
    marginTop: 18,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#c7d2fe',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: 13,
  },
}

