/**
 * DashboardLayout.tsx - workflow shell for TerriMap.
 *
 * The shell keeps navigation role-aware, fixes mobile behavior, and avoids
 * fake controls that do not lead to real work.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useUIStore } from '../../store/uiStore.js'
import { useAuthStore } from '../../store/authStore.js'

interface DashboardLayoutProps {
  children: (activeTab: string) => React.ReactNode
}

const navItems = [
  { id: 'overview', label: 'Tổng quan', icon: 'OV', roles: ['admin', 'coordinator', 'sales'] },
  { id: 'regions', label: 'Khu vực & bản đồ', icon: 'MP', roles: ['admin', 'coordinator'] },
  { id: 'users', label: 'Nhân sự Sales', icon: 'US', roles: ['admin'] },
  { id: 'assignments', label: 'Phân chia lãnh thổ', icon: 'TR', roles: ['admin', 'coordinator', 'sales'] },
  { id: 'ops', label: 'Vận hành', icon: 'OP', roles: ['admin', 'coordinator'] },
  { id: 'algorithms', label: 'So sánh thuật toán', icon: 'CP', roles: ['admin', 'coordinator'] },
  { id: 'settings', label: 'Cài đặt', icon: 'ST', roles: ['admin', 'coordinator', 'sales'] },
]

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 760)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 760)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const isMobile = useIsMobile()
  const role = useUIStore((s) => s.role)
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)

  const visibleItems = useMemo(() => (
    navItems.filter((item) =>
      item.roles.includes(role)
      && item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    )
  ), [role, searchQuery])

  const activeItem = navItems.find((item) => item.id === activeTab) ?? navItems[0]!
  const currentRoleLabel = role === 'admin'
    ? 'Quản trị viên'
    : role === 'coordinator'
      ? 'Điều phối viên'
      : 'Nhân viên Sales'

  const expanded = isMobile ? sidebarOpen : !sidebarCollapsed
  const sidebarWidth = expanded ? 280 : 72

  const selectTab = (id: string) => {
    setActiveTab(id)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <div style={styles.container}>
      {isMobile && sidebarOpen && (
        <button
          aria-label="Đóng menu"
          onClick={() => setSidebarOpen(false)}
          style={styles.backdrop}
        />
      )}

      <aside
        style={{
          ...styles.sidebar,
          width: sidebarWidth,
          transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          position: isMobile ? 'fixed' : 'relative',
        }}
      >
        <div style={styles.brand}>
          <span style={styles.brandMark}>TM</span>
          {expanded && <span style={styles.brandText}>TerriMap</span>}
        </div>

        <div style={styles.profileSection}>
          <div style={styles.avatar}>{profile?.email?.[0]?.toUpperCase() || 'A'}</div>
          {expanded && (
            <div style={styles.profileInfo}>
              <span style={styles.profileName}>{profile?.email?.split('@')[0] || 'Admin Account'}</span>
              <span style={styles.profileRole}>{currentRoleLabel}</span>
            </div>
          )}
        </div>

        {expanded && (
          <div style={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Lọc mục điều hướng"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        )}

        <nav style={styles.menu} aria-label="Điều hướng chính">
          {visibleItems.map((item) => {
            const active = item.id === activeTab
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                title={item.label}
                style={{
                  ...styles.menuItem,
                  justifyContent: expanded ? 'flex-start' : 'center',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#fff' : '#9ca3af',
                }}
              >
                <span style={{
                  ...styles.menuIcon,
                  background: active ? 'rgba(255,255,255,.18)' : '#111827',
                  color: active ? '#fff' : '#93c5fd',
                  marginRight: expanded ? 12 : 0,
                }}>
                  {item.icon}
                </span>
                {expanded && <span style={styles.menuText}>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          {!isMobile && (
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              style={styles.footerBtn}
              title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu nhỏ menu'}
            >
              {sidebarCollapsed ? '>' : '<'}
            </button>
          )}
          {expanded && (
            <button onClick={signOut} style={{ ...styles.footerBtn, color: '#f87171' }}>
              Đăng xuất
            </button>
          )}
        </div>
      </aside>

      <div style={styles.mainWrapper}>
        <header style={styles.topBar}>
          <div style={styles.headerLeft}>
            <button
              onClick={() => isMobile ? setSidebarOpen(true) : setSidebarCollapsed((v) => !v)}
              style={styles.hamburger}
              aria-label="Mở menu"
            >
              ☰
            </button>
            <div style={styles.breadcrumbs}>
              <span style={styles.breadcrumbMuted}>TerriMap</span>
              <span style={styles.breadcrumbSeparator}>&gt;</span>
              <strong style={styles.breadcrumbActive}>{activeItem.label}</strong>
            </div>
          </div>

          <div style={styles.headerRight}>
            <span style={styles.statusPill}>Dữ liệu mock/offline</span>
            {!isMobile && (
              <div style={styles.userPill}>
                <span style={styles.onlineDot} />
                <span>{profile?.email || 'admin@terrimap.vn'}</span>
              </div>
            )}
          </div>
        </header>

        <main style={styles.content}>
          {children(activeTab)}
        </main>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: 'var(--color-bg)',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 19,
    border: 0,
    background: 'rgba(15,23,42,.45)',
  },
  sidebar: {
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flexShrink: 0,
    background: '#111827',
    borderRight: '1px solid #263244',
    transition: 'width 180ms ease, transform 180ms ease',
  },
  brand: {
    height: 60,
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    gap: 12,
    borderBottom: '1px solid #263244',
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: '#2563eb',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
  },
  brandText: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: 800,
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid #1f2937',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: '#1d4ed8',
    color: '#fff',
    fontWeight: 800,
  },
  profileInfo: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  profileName: {
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  profileRole: {
    color: '#9ca3af',
    fontSize: 12,
  },
  searchWrapper: {
    padding: '14px 16px 6px',
  },
  searchInput: {
    width: '100%',
    height: 34,
    borderRadius: 7,
    border: '1px solid #374151',
    background: '#0b1220',
    color: '#e5e7eb',
    padding: '0 10px',
    outline: 'none',
  },
  menu: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 10,
    overflowY: 'auto',
  },
  menuItem: {
    minHeight: 42,
    border: 0,
    borderRadius: 8,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 650,
    textAlign: 'left',
  },
  menuIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    display: 'grid',
    placeItems: 'center',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: .2,
    flexShrink: 0,
  },
  menuText: {
    whiteSpace: 'nowrap',
  },
  sidebarFooter: {
    minHeight: 56,
    padding: '10px 16px',
    borderTop: '1px solid #263244',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerBtn: {
    border: 0,
    background: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '8px 6px',
  },
  mainWrapper: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  topBar: {
    height: 60,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  hamburger: {
    border: 0,
    background: 'transparent',
    color: 'var(--color-text)',
    fontSize: 20,
    cursor: 'pointer',
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    fontSize: 13,
  },
  breadcrumbMuted: {
    color: 'var(--color-text-2)',
  },
  breadcrumbSeparator: {
    color: 'var(--color-text-3)',
  },
  breadcrumbActive: {
    color: 'var(--color-text)',
    whiteSpace: 'nowrap',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    border: '1px solid var(--color-border)',
    borderRadius: 999,
    padding: '5px 10px',
    color: 'var(--color-text-2)',
    fontSize: 12,
  },
  userPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--color-border)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    background: '#22c55e',
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
    position: 'relative',
  },
}
