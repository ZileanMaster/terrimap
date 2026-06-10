import React, { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FacadeProvider } from './context/FacadeContext.js'
import { useUIStore } from './store/uiStore.js'
import { useDataStore } from './store/dataStore.js'
import { useAuthStore } from './store/authStore.js'
import { isOnline } from './lib/supabase.js'
import DashboardLayout from './components/layout/DashboardLayout.js'
import { OverviewView, UsersView, OperationsView, SettingsView } from './pages/DashboardViews.js'
import AlgorithmComparator from './components/algorithm/AlgorithmComparator.js'
import RegionSelector from './components/layout/RegionSelector.js'
import ToastViewport from './components/ui/Toast.js'
import SalesReportView from './pages/SalesReportView.js'

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

// Không tải các page ngay khi mở
const AdminPage       = lazyRetry(() => import('./pages/AdminPage.js'))
const CoordinatorPage = lazyRetry(() => import('./pages/CoordinatorPage.js'))
const SalesPage       = lazyRetry(() => import('./pages/SalesPage.js'))
const LoginPage       = lazyRetry(() => import('./pages/LoginPage.js'))
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})


function PageLoader() {
  return (
    <div style={styles.pageLoader}>
      <div style={styles.splashSpinner} />
    </div>
  )
}

export default function App() {
  // Lấy state
  const authUser       = useAuthStore((s) => s.user)
  const authSession    = useAuthStore((s) => s.session)
  const authLoading    = useAuthStore((s) => s.loading)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const membership     = useAuthStore((s) => s.membership)
  const projects       = useAuthStore((s) => s.projects)
  const initAuth       = useAuthStore((s) => s.initialize)

  // Lấy vai trò đang dùng
  const viewAsRole     = useUIStore((s) => s.role)
  const currentProject  = projects.find((project) => project.id === currentProjectId)
  const activeMembership = membership?.project_id === currentProjectId ? membership : null
  const effectiveRole  = activeMembership?.role === 'admin'
    ? viewAsRole
    : (activeMembership?.role ?? (currentProject?.owner_id === authUser?.id ? 'admin' : 'sales'))

  // lấy dữ liệu bản đồ
  const initData       = useDataStore((s) => s.init)
  const currentRegionId = useDataStore((s) => s.currentRegionId)

  // Khởi tạo auth khi app load
  React.useEffect(() => { initAuth() }, [initAuth])

  // Tải dữ liệu khi đã có project
  React.useEffect(() => {
    if (authUser && currentProjectId) {
      initData(currentProjectId)
    }
  }, [authUser, currentProjectId, initData])

  React.useEffect(() => {
    const firstProjectId = projects[0]?.id
    if (authUser && authSession && !currentProjectId && firstProjectId) {
      void useAuthStore.getState().selectProject(firstProjectId)
    }
  }, [authUser, authSession, currentProjectId, projects])

  // Lấy vai trò đang dùng
  React.useEffect(() => {
    const nextRole = activeMembership?.role === 'admin'
      ? viewAsRole
      : (activeMembership?.role ?? (currentProject?.owner_id === authUser?.id ? 'admin' : 'sales'))

    if (activeMembership?.role === 'admin') {
    } else {
      useUIStore.getState().setRole(nextRole as any)
    }
    if (activeMembership?.role && activeMembership.role !== 'admin' && activeMembership.region_id) {
      useDataStore.getState().setCurrentRegion(activeMembership.region_id)
    }
  }, [activeMembership, authUser?.id, currentProject?.owner_id, viewAsRole])

  //chuyển sang mode offline
  if (!isOnline()) {
    return <OfflineApp />
  }

  // Đang tải
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

  // Chưa đăng nhập thì show login
  if (!authUser || !authSession) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    )
  }

  // Tải dữ liệu khi đã có project
  if (!currentProjectId) {
    return <PageLoader />
  }


  return (
    <QueryClientProvider client={queryClient}>
      <FacadeProvider>
        <ToastViewport />
        <DashboardLayout>
          {(activeTab) => (
            <Suspense fallback={<PageLoader />}>
              {activeTab === 'overview' && (
                effectiveRole === 'sales' ? <SalesReportView /> : <OverviewView />
              )}
              {activeTab === 'users' && <UsersView />}
              {activeTab === 'ops' && <OperationsView />}
              {activeTab === 'assignments' && (
                currentRegionId === null ? <RegionSelector /> :
                effectiveRole === 'admin' ? <AdminPage /> :
                effectiveRole === 'coordinator' ? <CoordinatorPage /> :
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
              {activeTab === 'overview' && (
                role === 'sales' ? <SalesReportView /> : <OverviewView />
              )}
              {activeTab === 'users' && <UsersView />}
              {activeTab === 'ops' && <OperationsView />}
              {activeTab === 'assignments' && (
                currentRegionId === null ? <RegionSelector /> :
                role === 'admin' ? <AdminPage /> :
                role === 'coordinator' ? <CoordinatorPage /> :
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
  pageLoader: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg, #0f0c29)',
  },
}
