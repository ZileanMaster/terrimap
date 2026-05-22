/**
 * App.tsx — Root component with Auth Guard
 *
 * Flow:
 * 1. Loading → SplashScreen
 * 2. No user → LoginPage
 * 3. User but no project → ProjectSelectPage
 * 4. User + project → Dashboard (role-based page)
 *
 * Code splitting: Pages are lazy-loaded to reduce initial bundle (~40% smaller).
 * Role is determined by project_members.role (not user-selectable tabs)
 * Admin can use "view-as" mode to preview other roles.
 */

import React, { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FacadeProvider } from './context/FacadeContext.js'
import { useUIStore } from './store/uiStore.js'
import { useDataStore } from './store/dataStore.js'
import { useAuthStore } from './store/authStore.js'
import { isOnline } from './lib/supabase.js'
import TopBar from './components/layout/TopBar.js'

// ── Lazy-loaded pages (code splitting) ───────────────────────────────────────
const AdminPage       = React.lazy(() => import('./pages/AdminPage.js'))
const CoordinatorPage = React.lazy(() => import('./pages/CoordinatorPage.js'))
const SalesPage       = React.lazy(() => import('./pages/SalesPage.js'))
const LoginPage       = React.lazy(() => import('./pages/LoginPage.js'))
const ProjectSelectPage = React.lazy(() => import('./pages/ProjectSelectPage.js'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

/** Minimal fallback while lazy chunks load */
function PageLoader() {
  return (
    <div style={styles.pageLoader}>
      <div style={styles.splashSpinner} />
    </div>
  )
}

export default function App() {
  // Auth state
  const authUser       = useAuthStore((s) => s.user)
  const authLoading    = useAuthStore((s) => s.loading)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const membership     = useAuthStore((s) => s.membership)
  const initAuth       = useAuthStore((s) => s.initialize)

  // Role from membership (or view-as override)
  const viewAsRole     = useUIStore((s) => s.role)
  const effectiveRole  = membership?.role === 'admin' ? viewAsRole : (membership?.role ?? 'sales')

  // Data store
  const initData       = useDataStore((s) => s.init)

  // Initialize auth on mount
  React.useEffect(() => { initAuth() }, [initAuth])

  // Initialize data store when project is selected (scoped to project)
  React.useEffect(() => {
    if (authUser && currentProjectId) {
      initData(currentProjectId)
    }
  }, [authUser, currentProjectId, initData])

  // Sync effective role to uiStore (for components that read from uiStore)
  React.useEffect(() => {
    if (membership && membership.role !== 'admin') {
      useUIStore.getState().setRole(membership.role as any)
    }
  }, [membership])

  // ── Offline mode (no Supabase) — skip auth entirely ──────────────────────
  if (!isOnline()) {
    return <OfflineApp />
  }

  // ── Loading splash ──────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={styles.splash}>
        <div style={styles.splashContent}>
          <span style={styles.splashIcon}>⬡</span>
          <span style={styles.splashText}>TerriMap</span>
          <div style={styles.splashSpinner} />
        </div>
      </div>
    )
  }

  // ── Not logged in ─────────────────────────────────────────────────────
  if (!authUser) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    )
  }

  // ── Logged in but no project selected ─────────────────────────────────
  if (!currentProjectId) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ProjectSelectPage />
      </Suspense>
    )
  }

  // ── Dashboard (authenticated + project selected) ──────────────────────
  return (
    <QueryClientProvider client={queryClient}>
      <FacadeProvider>
        <div style={styles.root}>
          <TopBar />
          <main style={styles.main}>
            <Suspense fallback={<PageLoader />}>
              {effectiveRole === 'admin'       && <AdminPage />}
              {effectiveRole === 'coordinator' && <CoordinatorPage />}
              {effectiveRole === 'sales'       && <SalesPage />}
            </Suspense>
          </main>
        </div>
      </FacadeProvider>
    </QueryClientProvider>
  )
}

/**
 * OfflineApp — Used when Supabase is not configured (dev/mock mode)
 * Preserves original behavior with role tabs
 */
function OfflineApp() {
  const role = useUIStore((s) => s.role)
  const init = useDataStore((s) => s.init)

  React.useEffect(() => { init() }, [init])

  return (
    <QueryClientProvider client={queryClient}>
      <FacadeProvider>
        <div style={styles.root}>
          <TopBar />
          <main style={styles.main}>
            <Suspense fallback={<PageLoader />}>
              {role === 'admin'       && <AdminPage />}
              {role === 'coordinator' && <CoordinatorPage />}
              {role === 'sales'       && <SalesPage />}
            </Suspense>
          </main>
        </div>
      </FacadeProvider>
    </QueryClientProvider>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--color-bg)',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    marginTop: 'var(--topbar-h)',
  },

  // Splash
  splash: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  },
  splashContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  splashIcon: {
    fontSize: 48,
    color: '#818cf8',
    filter: 'drop-shadow(0 0 12px rgba(129,140,248,0.5))',
  },
  splashText: {
    fontSize: 28,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  splashSpinner: {
    width: 24,
    height: 24,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#818cf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  // Page-level loader (for lazy chunk loading)
  pageLoader: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg, #0f0c29)',
  },
}
