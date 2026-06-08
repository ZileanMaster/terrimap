/**
 * TopBar — Navigation & Controls
 *
 * Online mode: User info + role badge + view-as (admin only) + logout
 * Ch? ?? offline: tab vai tr? (h?nh vi g?c)
 * Both: Theme toggle
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore, type Role, type Theme } from '../../store/uiStore.js'
import { useAuthStore } from '../../store/authStore.js'
import { isOnline } from '../../lib/supabase.js'

const ROLES: { id: Role; icon: string }[] = [
  { id: 'admin',       icon: '🛡️' },
  { id: 'coordinator', icon: '📋' },
  { id: 'sales',       icon: '👤' },
]

const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'light',  label: 'theme.light',  icon: '☀️' },
  { id: 'dark',   label: 'theme.dark',   icon: '🌙' },
  { id: 'system', label: 'theme.system', icon: '💻' },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Điều phối',
  sales: 'Nhân viên',
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#818cf8',
  coordinator: '#34d399',
  sales: '#fbbf24',
}

export default function TopBar() {
  const { t } = useTranslation()
  const role   = useUIStore((s) => s.role)
  const theme  = useUIStore((s) => s.theme)
  const setRole       = useUIStore((s) => s.setRole)
  const setTheme      = useUIStore((s) => s.setTheme)

  // Auth state (for online mode)
  const profile    = useAuthStore((s) => s.profile)
  const membership = useAuthStore((s) => s.membership)
  const signOut    = useAuthStore((s) => s.signOut)

  const online     = isOnline()
  const isAdmin    = membership?.role === 'admin'
  const actualRole = membership?.role ?? 'admin'

  function handleBackToProjects() {
    // Clear current project → go back to project selection
    useAuthStore.setState({ currentProjectId: null, membership: null })
  }

  return (
    <header style={styles.bar}>
      {/* Logo */}
      <div style={styles.logo} data-testid="logo">
        <span style={styles.logoHex}>⬡</span>
        <span style={styles.logoText}>{t('nav.title')}</span>
      </div>

      {/* Online: View-as tabs (admin only) / Role badge */}
      {online ? (
        <nav style={styles.nav}>
          {isAdmin ? (
            // Admin can switch view
            ROLES.map(({ id, icon }) => (
              <button
                key={id}
                id={`role-tab-${id}`}
                data-active={String(role === id)}
                onClick={() => setRole(id)}
                style={{
                  ...styles.tab,
                  ...(role === id ? styles.tabActive : {}),
                }}
              >
                <span style={styles.tabIcon}>{icon}</span>
                {t(`nav.${id}`)}
                {role === id && id !== actualRole && (
                  <span style={styles.viewAsBadge}>xem</span>
                )}
              </button>
            ))
          ) : (
            // V?i non-admin: ch? hi?n th? badge vai tr?
            <div style={styles.roleBadge}>
              <span>{ROLES.find(r => r.id === actualRole)?.icon}</span>
              <span>{ROLE_LABELS[actualRole]}</span>
            </div>
          )}
        </nav>
      ) : (
        // Offline: original role tabs
        <nav style={styles.nav}>
          {ROLES.map(({ id, icon }) => (
            <button
              key={id}
              id={`role-tab-${id}`}
              data-active={String(role === id)}
              onClick={() => setRole(id)}
              style={{
                ...styles.tab,
                ...(role === id ? styles.tabActive : {}),
              }}
            >
              <span style={styles.tabIcon}>{icon}</span>
              {t(`nav.${id}`)}
            </button>
          ))}
        </nav>
      )}

      {/* Right controls */}
      <div style={styles.controls}>
        {/* Theme selector */}
        <div style={styles.themeRow}>
          {THEMES.map(({ id, label, icon }) => (
            <button
              key={id}
              id={`theme-btn-${id}`}
              onClick={() => setTheme(id)}
              title={t(label)}
              style={{
                ...styles.iconBtn,
                ...(theme === id ? styles.iconBtnActive : {}),
              }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* User menu (online only) */}
        {online && profile && (
          <div style={styles.userSection}>
            {/* Back to projects */}
            <button
              onClick={handleBackToProjects}
              style={styles.projectBtn}
              title="Đổi dự án"
            >
              📁
            </button>

            {/* User avatar + name */}
            <div style={styles.userInfo}>
              <div style={{
                ...styles.avatar,
                background: ROLE_COLORS[actualRole] || '#818cf8',
              }}>
                {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div style={styles.userText}>
                <div style={styles.userName}>{profile.full_name}</div>
                <div style={styles.userRole}>
                  {ROLE_LABELS[actualRole]}
                </div>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={() => { void signOut() }}
              style={styles.signOutBtn}
              title="Đăng xuất"
            >
              ⏻ Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: 'var(--topbar-h)',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 16,
    zIndex: 1000,
    boxShadow: 'var(--shadow-sm)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  logoHex: {
    fontSize: 22,
    color: 'var(--color-accent)',
    lineHeight: 1,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text)',
    letterSpacing: '-0.02em',
  },
  nav: {
    display: 'flex',
    gap: 4,
    flex: 1,
    alignItems: 'center',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 16px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-2)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    position: 'relative',
  },
  tabActive: {
    background: 'var(--color-accent-light)',
    color: 'var(--color-accent)',
    fontWeight: 600,
  },
  tabIcon: {
    fontSize: 14,
  },
  viewAsBadge: {
    fontSize: 9,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'rgba(251,191,36,0.2)',
    color: '#fbbf24',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginLeft: 4,
  },
  roleBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-accent-light)',
    color: 'var(--color-accent)',
    fontSize: 13,
    fontWeight: 600,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  themeRow: {
    display: 'flex',
    gap: 2,
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-sm)',
    padding: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    border: 'none',
    background: 'transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
  },
  // User section
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 4,
    borderLeft: '1px solid var(--color-border)',
    paddingLeft: 12,
  },
  projectBtn: {
    width: 32,
    height: 32,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
  },
  userText: {
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text)',
    lineHeight: 1.2,
  },
  userRole: {
    fontSize: 10,
    color: 'var(--color-text-muted)',
    fontWeight: 500,
  },
  signOutBtn: {
    padding: '5px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: 'var(--color-text-muted)',
    whiteSpace: 'nowrap' as const,
    transition: 'all 150ms',
  },
}
