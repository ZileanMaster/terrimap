/**
 * App.tsx — Root component with Auth Guard
 *
 * Flow:
 * 1. Loading → SplashScreen
 * 2. No user → LoginPage
 * 3. User but no project → ProjectSelectPage
 * 4. User + project → Dashboard (role-based page)
 *
 * Admin can use "view-as" mode to preview other roles.
 */

import React, { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FacadeProvider } from './context/FacadeContext.js'
import { useUIStore } from './store/uiStore.js'
import { useDataStore } from './store/dataStore.js'
import { useAuthStore } from './store/authStore.js'
import { isOnline } from './lib/supabase.js'
import DashboardLayout from './components/layout/DashboardLayout.js'
import { OverviewView, RegionsView, UsersView, OperationsView, SettingsView } from './pages/DashboardViews.js'
import AlgorithmComparator from './components/algorithm/AlgorithmComparator.js'
import RegionSelector from './components/layout/RegionSelector.js'
import ToastViewport from './components/ui/Toast.js'

function lazyRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
) {
  return React.lazy(async () => {
    try {
      return await importer()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message)

      if (isChunkLoadError && typeof window !== 'undefined') {
        const flag = 'terrimap_chunk_reload_once'
        if (sessionStorage.getItem(flag) !== '1') {
          sessionStorage.setItem(flag, '1')
          window.location.reload()
        }
      }

      throw error
    }
  })
}

// ── Lazy-loaded pages (code splitting) ───────────────────────────────────────
const AdminPage       = lazyRetry(() => import('./pages/AdminPage.js'))
const CoordinatorPage = lazyRetry(() => import('./pages/CoordinatorPage.js'))
const SalesPage       = lazyRetry(() => import('./pages/SalesPage.js'))
const LoginPage       = lazyRetry(() => import('./pages/LoginPage.js'))
const ProjectSelectPage = lazyRetry(() => import('./pages/ProjectSelectPage.js'))

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
  const authSession    = useAuthStore((s) => s.session)
  const authLoading    = useAuthStore((s) => s.loading)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const membership     = useAuthStore((s) => s.membership)
  const initAuth       = useAuthStore((s) => s.initialize)

  // Role from membership (or view-as override)
  const viewAsRole     = useUIStore((s) => s.role)
  const effectiveRole  = membership?.role === 'admin' ? viewAsRole : (membership?.role ?? 'sales')

  // Data store
  const initData       = useDataStore((s) => s.init)
  const currentRegionId = useDataStore((s) => s.currentRegionId)

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
    // Auto-select assigned region for non-admin roles
    if (membership?.role && membership.role !== 'admin' && membership.region_id) {
      useDataStore.getState().setCurrentRegion(membership.region_id)
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

  // ── Not logged in or no valid session ───────────────────────────────────
  if (!authUser || !authSession) {
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
        <ToastViewport />
        <DashboardLayout>
          {(activeTab) => (
            <Suspense fallback={<PageLoader />}>
              {activeTab === 'overview' && <OverviewView />}
              {activeTab === 'regions' && (
                currentRegionId === null ? <RegionSelector /> :
                effectiveRole === 'admin' ? <AdminPage mode="regions" /> :
                effectiveRole === 'coordinator' ? <CoordinatorPage mode="regions" /> :
                <OverviewView />
              )}
              {activeTab === 'users' && <UsersView />}
              {activeTab === 'ops' && <OperationsView />}
              {activeTab === 'assignments' && (
                currentRegionId === null ? <RegionSelector /> :
                effectiveRole === 'admin' ? <AdminPage mode="assignments" /> :
                effectiveRole === 'coordinator' ? <CoordinatorPage mode="assignments" /> :
                <SalesPage />
              )}
              {activeTab === 'algorithms' && <AlgorithmComparator />}
              {activeTab === 'settings' && <SettingsView />}
            </Suspense>
          )}
        </DashboardLayout>
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
  const currentRegionId = useDataStore((s) => s.currentRegionId)

  React.useEffect(() => { init() }, [init])

  return (
    <QueryClientProvider client={queryClient}>
      <FacadeProvider>
        <ToastViewport />
        <DashboardLayout>
          {(activeTab) => (
            <Suspense fallback={<PageLoader />}>
              {activeTab === 'overview' && <OverviewView />}
              {activeTab === 'regions' && (
                currentRegionId === null ? <RegionSelector /> :
                role === 'admin' ? <AdminPage mode="regions" /> :
                role === 'coordinator' ? <CoordinatorPage mode="regions" /> :
                <OverviewView />
              )}
              {activeTab === 'users' && <UsersView />}
              {activeTab === 'ops' && <OperationsView />}
              {activeTab === 'assignments' && (
                currentRegionId === null ? <RegionSelector /> :
                role === 'admin' ? <AdminPage mode="assignments" /> :
                role === 'coordinator' ? <CoordinatorPage mode="assignments" /> :
                <SalesPage />
              )}
              {activeTab === 'algorithms' && <AlgorithmComparator />}
              {activeTab === 'settings' && <SettingsView />}
            </Suspense>
          )}
        </DashboardLayout>
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
