import React, { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { useUIStore } from '../../store/uiStore.js'
import { isOnline } from '../../lib/supabase.js'
import { IconButton } from '../ui/Button.js'

interface DashboardLayoutProps {
  children: (activeTab: string) => React.ReactNode
}

type NavIconKey =
  | 'overview'
  | 'regions'
  | 'users'
  | 'assignments'
  | 'ops'
  | 'algorithms'
  | 'settings'

function NavIcon({ name, active }: { name: NavIconKey; active: boolean }) {
  const common: React.SVGProps<SVGSVGElement> = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  // Simple inline icons to avoid adding dependencies.
  if (name === 'overview') {
    return (
      <svg {...common}>
        <path d="M3 13h8V3H3v10Z" />
        <path d="M13 21h8V11h-8v10Z" />
        <path d="M13 3h8v6h-8V3Z" />
        <path d="M3 17h8v4H3v-4Z" />
      </svg>
    )
  }
  if (name === 'regions') {
    return (
      <svg {...common}>
        <path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1 1 18 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }
  if (name === 'assignments') {
    return (
      <svg {...common}>
        <path d="M3 7h6" />
        <path d="M3 12h10" />
        <path d="M3 17h6" />
        <path d="M14 7l3 3 5-5" />
        <path d="M14 17l3 3 5-5" />
      </svg>
    )
  }
  if (name === 'ops') {
    return (
      <svg {...common}>
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" />
        <path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M4.93 19.07l2.83-2.83" />
        <path d="M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  if (name === 'algorithms') {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M8 19V9" />
        <path d="M12 19V3" />
        <path d="M16 19v-7" />
        <path d="M20 19v-4" />
      </svg>
    )
  }
  // settings
  return (
    <svg {...common}>
      <path d="M12 1v2" />
      <path d="M12 21v2" />
      <path d="M4.22 4.22l1.42 1.42" />
      <path d="M18.36 18.36l1.42 1.42" />
      <path d="M1 12h2" />
      <path d="M21 12h2" />
      <path d="M4.22 19.78l1.42-1.42" />
      <path d="M18.36 5.64l1.42-1.42" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

function ThemeIcon({ theme }: { theme: 'light' | 'dark' | 'system' }) {
  const common: React.SVGProps<SVGSVGElement> = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (theme === 'dark') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    )
  }

  if (theme === 'light') {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="M4.93 4.93l1.41 1.41" />
        <path d="M17.66 17.66l1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="M4.93 19.07l1.41-1.41" />
        <path d="M17.66 6.34l1.41-1.41" />
      </svg>
    )
  }

  return (
    <svg {...common} aria-hidden="true">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 18v2" />
    </svg>
  )
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const projects = useAuthStore((s) => s.projects)
  const membership = useAuthStore((s) => s.membership)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const deselectProject = useAuthStore((s) => s.deselectProject)
  const signOut = useAuthStore((s) => s.signOut)
  const role = useUIStore((s) => s.role)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const currentProject = projects.find((project) => project.id === currentProjectId)
  const activeMembership = membership?.project_id === currentProjectId ? membership : null
  const effectiveRole = isOnline()
    ? (activeMembership?.role ?? (currentProject?.owner_id === user?.id ? 'admin' : 'sales'))
    : role
  const currentRoleLabel =
    effectiveRole === 'admin' ? 'Quản trị viên' : effectiveRole === 'coordinator' ? 'Điều phối viên' : 'Nhân sự'

  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
  }

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const navItems = useMemo(
    () =>
      ([
        { id: 'overview', label: 'Tổng quan', icon: 'overview' as const, roles: ['admin', 'coordinator', 'sales'] },
        { id: 'regions', label: 'Khu vực & bản đồ', icon: 'regions' as const, roles: ['admin', 'coordinator'] },
        { id: 'users', label: 'Nhân sự', icon: 'users' as const, roles: ['admin'] },
        { id: 'assignments', label: 'Phân chia lãnh thổ', icon: 'assignments' as const, roles: ['admin', 'coordinator', 'sales'] },
        { id: 'ops', label: 'Vận hành', icon: 'ops' as const, roles: ['admin', 'coordinator'] },
        { id: 'algorithms', label: 'Phân chia tự động', icon: 'algorithms' as const, roles: ['admin', 'coordinator'] },
        { id: 'settings', label: 'Cài đặt', icon: 'settings' as const, roles: ['admin', 'coordinator', 'sales'] },
      ] as const).filter((x) => (x.roles as any).includes(effectiveRole)),
    [effectiveRole],
  )

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return navItems as any[]
    return (navItems as any[]).filter((i) => i.label.toLowerCase().includes(q))
  }, [navItems, searchQuery])

  const activeItem = (navItems as any[]).find((item) => item.id === activeTab) ?? (navItems as any[])[0]


  const expanded = isMobile ? sidebarOpen : !sidebarCollapsed
  const sidebarWidth = expanded ? 280 : 72

  const selectTab = (id: string) => {
    setActiveTab(id)
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <div style={styles.container}>
      {isMobile && sidebarOpen && (
        <button aria-label="Đóng menu" onClick={() => setSidebarOpen(false)} style={styles.backdrop} />
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
              <span style={styles.profileName}>{profile?.email?.split('@')[0] || 'Tài khoản'}</span>
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
                  background: active ? 'var(--color-nav-item-bg-active)' : 'var(--color-nav-item-bg)',
                  color: active ? 'var(--color-nav-item-text-active)' : 'var(--color-nav-item-text)',
                }}
              >
                <span
                  style={{
                    ...styles.menuIcon,
                    background: active ? 'rgba(255,255,255,0.92)' : 'var(--color-nav-icon-bg)',
                    color: active ? 'var(--color-accent)' : 'var(--color-nav-item-icon)',
                    marginRight: expanded ? 12 : 0,
                  }}
                >
                  <NavIcon name={item.icon} active={active} />
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
            <button onClick={signOut} style={{ ...styles.footerBtn, color: 'var(--color-danger)' }}>
              Đăng xuất
            </button>
          )}
        </div>
      </aside>

      <div style={styles.mainWrapper}>
        <header style={styles.topBar}>
          <div style={styles.headerLeft}>
            <button
              onClick={() => (isMobile ? setSidebarOpen(true) : setSidebarCollapsed((v) => !v))}
              style={styles.hamburger}
              aria-label="Mở menu"
            >
              ☰
            </button>
            <div style={styles.breadcrumbs}>
              <span style={styles.breadcrumbMuted}>TerriMap</span>
              <span style={styles.breadcrumbSeparator}>&gt;</span>
              <strong style={styles.breadcrumbActive}>{activeItem?.label ?? ''}</strong>
            </div>
          </div>

          <div style={styles.headerRight}>
            {!isOnline() && <span style={styles.statusPill}>Dữ liệu mock/offline</span>}
            <button onClick={deselectProject} style={styles.projectSwitchBtn} title="Đổi dự án">
              Đổi dự án
            </button>
            <div style={styles.controls}>
              <IconButton onClick={cycleTheme} title="Giao diện (Light/Dark/System)" style={styles.controlBtn}>
                <ThemeIcon theme={theme} />
              </IconButton>
            </div>
            {!isMobile && (
              <div style={styles.userPill}>
                <span style={styles.onlineDot} />
                <span>{profile?.email || 'admin@terrimap.vn'}</span>
              </div>
            )}
          </div>
        </header>

        <main style={styles.content}>{children(activeTab)}</main>
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
    background: 'var(--color-nav-bg)',
    borderRight: '1px solid var(--color-nav-border)',
    transition: 'width 180ms ease, transform 180ms ease',
  },
  brand: {
    height: 60,
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    gap: 10,
    borderBottom: '1px solid var(--color-nav-border)',
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'var(--color-accent)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    letterSpacing: 0,
  },
  brandText: {
    color: 'var(--color-text)',
    fontWeight: 600,
    fontSize: 16,
  },
  profileSection: {
    display: 'flex',
    gap: 12,
    padding: '14px 18px',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: 'var(--color-surface-2)',
    color: 'var(--color-accent)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 900,
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  profileName: {
    color: 'var(--color-text)',
    fontWeight: 600,
    fontSize: 14,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  profileRole: {
    color: 'var(--color-text-2)',
    fontSize: 12,
    fontWeight: 600,
  },
  searchWrapper: {
    padding: '0 18px 10px',
  },
  searchInput: {
    width: '100%',
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--color-nav-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    padding: '0 10px',
    outline: 'none',
  },
  menu: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflow: 'auto',
  },
  menuItem: {
    border: 0,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    textAlign: 'left',
    transition: 'background 120ms ease',
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  menuText: {
    fontWeight: 500,
    fontSize: 14,
  },
  sidebarFooter: {
    marginTop: 'auto',
    padding: 10,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  footerBtn: {
    border: '1px solid var(--color-nav-border)',
    borderRadius: 10,
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  mainWrapper: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    height: 'var(--topbar-h)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  hamburger: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    fontWeight: 700,
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  breadcrumbMuted: { color: 'var(--color-text-2)', fontWeight: 700 },
  breadcrumbSeparator: { color: 'var(--color-text-2)' },
  breadcrumbActive: {
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  projectSwitchBtn: {
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  statusPill: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    padding: '6px 10px',
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 12,
    color: 'var(--color-text-2)',
  },
  userPill: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    padding: '6px 10px',
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: 'var(--color-success)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
}
