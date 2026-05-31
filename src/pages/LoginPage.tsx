/**
 * LoginPage — Premium authentication page
 *
 * Glassmorphism card with gradient background.
 * Tabs: Sign In / Sign Up
 * Inline error display.
 */

import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore.js'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const [mode, setMode]         = useState<Mode>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const signIn     = useAuthStore((s) => s.signIn)
  const signUp     = useAuthStore((s) => s.signUp)
  const authError  = useAuthStore((s) => s.authError)
  const clearError = useAuthStore((s) => s.clearError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setSubmitting(true)

    if (mode === 'signin') {
      await signIn(email, password)
    } else {
      await signUp(email, password, fullName)
    }

    setSubmitting(false)
  }

  const switchMode = (newMode: Mode) => {
    setMode(newMode)
    clearError()
  }

  return (
    <div style={styles.page}>
      {/* Language toggle — visible before login */}
      <button
        onClick={() => {
          const html = document.documentElement
          const isVi = html.lang === 'vi'
          html.lang = isVi ? 'en' : 'vi'
        }}
        style={styles.langToggle}
        title="Switch language"
      >
        🌐
      </button>

      {/* Background animated shapes */}
      <div style={styles.bgShape1} />
      <div style={styles.bgShape2} />
      <div style={styles.bgShape3} />

      {/* Login card */}
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>⬡</span>
          <span style={styles.logoText}>TerriMap</span>
        </div>
        <p style={styles.subtitle}>
          {mode === 'signin'
            ? 'Đăng nhập vào hệ thống quản lý vùng thương mại'
            : 'Tạo tài khoản mới'}
        </p>

        {/* Mode tabs */}
        <div style={styles.tabs}>
          <button
            onClick={() => switchMode('signin')}
            style={{
              ...styles.tab,
              ...(mode === 'signin' ? styles.tabActive : {}),
            }}
          >
            Đăng nhập
          </button>
          <button
            onClick={() => switchMode('signup')}
            style={{
              ...styles.tab,
              ...(mode === 'signup' ? styles.tabActive : {}),
            }}
          >
            Đăng ký
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'signup' && (
            <div style={styles.field}>
              <label style={styles.label}>Họ và tên</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                style={styles.input}
                autoComplete="name"
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              style={styles.input}
              autoComplete="email"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={styles.input}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* Error */}
          {authError && (
            <div style={styles.error}>
              <span style={styles.errorIcon}>⚠️</span>
              {authError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.submit,
              ...(submitting ? styles.submitDisabled : {}),
            }}
          >
            {submitting
              ? '⏳ Đang xử lý...'
              : mode === 'signin'
                ? '🔐 Đăng nhập'
                : '✨ Tạo tài khoản'}
          </button>
        </form>

        {/* Footer */}
        <p style={styles.footer}>
          {mode === 'signin' ? (
            <>Chưa có tài khoản?{' '}
              <button onClick={() => switchMode('signup')} style={styles.link}>
                Đăng ký ngay
              </button>
            </>
          ) : (
            <>Đã có tài khoản?{' '}
              <button onClick={() => switchMode('signin')} style={styles.link}>
                Đăng nhập
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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

  langToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 200ms',
  },

  // Animated background shapes
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

  // Card
  card: {
    position: 'relative',
    zIndex: 10,
    width: 400,
    maxWidth: '92vw',
    padding: '40px 36px 32px',
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset',
  },

  // Logo
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

  // Tabs
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
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 200ms',
  },
  tabActive: {
    background: 'rgba(99,102,241,0.25)',
    color: '#c7d2fe',
    boxShadow: '0 2px 8px rgba(99,102,241,0.2)',
  },

  // Form
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 200ms, box-shadow 200ms',
  },

  // Error
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
  errorIcon: {
    fontSize: 14,
    flexShrink: 0,
  },

  // Submit button
  submit: {
    marginTop: 4,
    padding: '14px 0',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 150ms, box-shadow 150ms',
    boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
  },
  submitDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  // Footer
  footer: {
    marginTop: 20,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#818cf8',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: 13,
  },
}
