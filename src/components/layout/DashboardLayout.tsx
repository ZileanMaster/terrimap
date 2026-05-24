/**
 * DashboardLayout.tsx — Classic administrative dashboard shell
 * 
 * Layout:
 * - Left Sidebar (Dark, Collapsible): brand logo, user profile, search bar, navigation menu
 * - Top Bar (Light): hamburger toggle, breadcrumbs, mock actions, user settings
 * - Center Panel: content area rendering the selected component (e.g., Algorithm Center)
 */

import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore.js';
import { useAuthStore } from '../../store/authStore.js';

interface DashboardLayoutProps {
  children: (activeTab: string) => React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const theme = useUIStore((s) => s.theme);
  const role = useUIStore((s) => s.role);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  // Collapsible menu items list with role restrictions
  const menuItems = [
    { id: 'overview', label: 'Tổng quan', icon: '📊', roles: ['admin', 'coordinator', 'sales'] },
    { id: 'regions', label: 'Quản lý khu vực', icon: '📍', roles: ['admin', 'coordinator'] },
    { id: 'users', label: 'Quản lý User', icon: '👥', roles: ['admin'] },
    { id: 'assignments', label: 'Quản lý phân công', icon: '📋', roles: ['admin', 'coordinator', 'sales'] },
    { id: 'algorithms', label: 'Chạy thuật toán', icon: '⚡', roles: ['admin', 'coordinator'] },
    { id: 'settings', label: 'Cài đặt hệ thống', icon: '⚙️', roles: ['admin', 'coordinator', 'sales'] },
  ];

  // Filter menu items based on search query and user role
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !item.roles || item.roles.includes(role);
    return matchesSearch && matchesRole;
  });

  // Compute breadcrumbs title based on active tab
  const getBreadcrumbs = () => {
    const item = menuItems.find((m) => m.id === activeTab);
    return ['Tổng quan', item ? item.label : ''];
  };

  const currentRoleLabel = role === 'admin' ? 'Quản trị viên' : role === 'coordinator' ? 'Điều phối viên' : 'Nhân viên';

  return (
    <div style={styles.container}>
      {/* ── LEFT SIDEBAR (Dark Theme) ────────────────────────────────────────── */}
      <aside style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? 70 : 'var(--sidebar-w, 280px)',
      }}>
        {/* Brand/Logo */}
        <div style={styles.brand}>
          <span style={styles.brandIcon}>⬡</span>
          {!sidebarCollapsed && <span style={styles.brandText}>TerriMap</span>}
        </div>

        {/* User profile section */}
        <div style={styles.profileSection}>
          <div style={styles.avatar}>
            {profile?.email?.[0]?.toUpperCase() || 'A'}
          </div>
          {!sidebarCollapsed && (
            <div style={styles.profileInfo}>
              <span style={styles.profileName}>{profile?.email?.split('@')[0] || 'Admin Account'}</span>
              <span style={styles.profileRole}>{currentRoleLabel}</span>
            </div>
          )}
        </div>

        {/* Sidebar Search Bar */}
        {!sidebarCollapsed && (
          <div style={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Tìm kiếm mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            <span style={styles.searchIcon}>🔍</span>
          </div>
        )}

        {/* Navigation Menu */}
        <nav style={styles.menu}>
          {filteredMenuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                style={{
                  ...styles.menuItem,
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  color: isActive ? '#fff' : '#8b949e',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                }}
              >
                <span style={styles.menuIcon}>{item.icon}</span>
                {!sidebarCollapsed && <span style={styles.menuText}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer (Collapse toggle & Logout) */}
        <div style={styles.sidebarFooter}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={styles.footerBtn}
            title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu nhỏ menu'}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
          {!sidebarCollapsed && (
            <button
              onClick={signOut}
              style={{ ...styles.footerBtn, color: 'var(--color-danger, #f06060)' }}
              title="Đăng xuất"
            >
              🚪 Đăng xuất
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA (Light / Dark Adaptive) ────────────────────────── */}
      <div style={styles.mainWrapper}>
        {/* Top Header Bar */}
        <header style={styles.topBar}>
          <div style={styles.headerLeft}>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={styles.hamburger}
            >
              ☰
            </button>

            {/* Breadcrumbs */}
            <div style={styles.breadcrumbs}>
              {getBreadcrumbs().map((crumb, idx) => (
                <React.Fragment key={crumb}>
                  {idx > 0 && <span style={styles.breadcrumbSeparator}>&gt;</span>}
                  <span style={{
                    ...styles.breadcrumbItem,
                    color: idx === getBreadcrumbs().length - 1 ? 'var(--color-text)' : 'var(--color-text-2)',
                    fontWeight: idx === getBreadcrumbs().length - 1 ? 600 : 400
                  }}>
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Header Right Actions */}
          <div style={styles.headerRight}>
            <button style={styles.headerIconBtn} title="Thông báo">
              🔔 <span style={styles.badge}>3</span>
            </button>
            <button style={styles.headerIconBtn} title="Hòm thư">
              ✉️ <span style={styles.badge}>2</span>
            </button>
            <div style={styles.userDropdownTrigger}>
              <div style={styles.userIndicator}>🟢</div>
              <span style={styles.userName}>{profile?.email || 'admin@terrimap.vn'}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <main style={styles.content}>
          {children(activeTab)}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    backgroundColor: 'var(--color-bg, #0d1117)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#161b22', // Sleek dark sidebar surface
    borderRight: '1px solid #30363d',
    transition: 'width 200ms ease',
    flexShrink: 0,
    zIndex: 10,
  },
  brand: {
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: '12px',
    borderBottom: '1px solid #30363d',
  },
  brandIcon: {
    fontSize: '24px',
    color: '#58a6ff',
    fontWeight: 'bold',
  },
  brandText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#f0f6fc',
    letterSpacing: '-0.5px',
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    gap: '12px',
    borderBottom: '1px solid #21262d',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#1f6feb',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '16px',
    boxShadow: '0 0 8px rgba(31, 111, 235, 0.4)',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  profileName: {
    color: '#c9d1d9',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  profileRole: {
    color: '#8b949e',
    fontSize: '11px',
    marginTop: '2px',
  },
  searchWrapper: {
    position: 'relative',
    margin: '14px 16px 8px',
  },
  searchInput: {
    width: '100%',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '8px 12px 8px 30px',
    color: '#c9d1d9',
    fontSize: '12px',
    outline: 'none',
  },
  searchIcon: {
    position: 'absolute',
    left: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '12px',
    color: '#8b949e',
  },
  menu: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 10px',
    gap: '4px',
    overflowY: 'auto',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'left',
    transition: 'all 150ms ease',
    width: '100%',
  },
  menuIcon: {
    fontSize: '16px',
    marginRight: '12px',
    display: 'flex',
    alignItems: 'center',
  },
  menuText: {
    whiteSpace: 'nowrap',
  },
  sidebarFooter: {
    padding: '12px 16px',
    borderTop: '1px solid #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  footerBtn: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: '4px',
    transition: 'color 150ms ease',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--color-bg, #0d1117)',
  },
  topBar: {
    height: '60px',
    backgroundColor: 'var(--color-surface, #161b22)',
    borderBottom: '1px solid var(--color-border, #30363d)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  breadcrumbSeparator: {
    color: 'var(--color-text-3)',
  },
  breadcrumbItem: {
    color: 'var(--color-text-2)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerIconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text)',
    fontSize: '18px',
    cursor: 'pointer',
    position: 'relative',
    padding: '4px',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: 'var(--color-danger, #f06060)',
    color: '#fff',
    borderRadius: '50%',
    width: '14px',
    height: '14px',
    fontSize: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  userDropdownTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1px solid var(--color-border, #30363d)',
    backgroundColor: 'var(--color-surface-2, #1f2937)',
  },
  userIndicator: {
    fontSize: '8px',
  },
  userName: {
    fontSize: '12px',
    color: 'var(--color-text)',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
  },
};
