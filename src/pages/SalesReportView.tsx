import React, { useMemo } from 'react'
import { useAuthStore } from '../store/authStore.js'
import { useDataStore } from '../store/dataStore.js'
import { useFacade } from '../context/FacadeContext.js'
import MyClusterReports from '../components/reports/MyClusterReports.js'
import { resolveUserKey } from '../utils/userIdentity.js'
import type { Assignment, Zone } from '../../facades/viewmodels.js'

export default function SalesReportView() {
  const zones = useDataStore((s) => s.zones)
  const assignments = useDataStore((s) => s.assignments)
  const loading = useDataStore((s) => s.loading)
  const currentRegionId = useDataStore((s) => s.currentRegionId)

  const authUser = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const agents = useDataStore((s) => s.agents)
  const currentUserKey = resolveUserKey(authUser, profile, agents)

  const ctx = useFacade()

  const { myZones, myAssignments } = useMemo<{
    myZones: Zone[]
    myAssignments: Assignment[]
  }>(() => {
    if (ctx.role !== 'sales' || zones.length === 0) return { myZones: [], myAssignments: [] }
    try {
      const district = ctx.facade.getMyDistrict()
      const zoneIds = new Set(district.zones.map((z) => z.id))
      return {
        myZones: district.zones,
        myAssignments: assignments.filter((a) => zoneIds.has(a.zoneId)),
      }
    } catch {
      return { myZones: [], myAssignments: [] }
    }
  }, [ctx, zones, assignments])

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>⏳ Đang tải dữ liệu...</p>
      </div>
    )
  }

  const hasDistrict = myZones.length > 0 && myAssignments.length > 0

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.kicker}>BÁO CÁO DOANH SỐ</div>
        <h1 style={styles.title}>Nhập báo cáo doanh số</h1>
        <p style={styles.subtitle}>
          Nhân sự chỉ nhập số khách hàng, đơn hàng, doanh thu và ghi chú cho cụm được giao.
          Phần tổng quan dự án không hiển thị với vai trò này.
        </p>
      </div>

      {!hasDistrict ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>Chưa tìm thấy vùng được giao</div>
          <div style={styles.emptyText}>
            Hệ thống chưa xác định được cụm/vùng của tài khoản này trong dự án hiện tại.
            Vui lòng kiểm tra lại salesAgentId hoặc gán vùng cho nhân sự trước khi nhập báo cáo.
          </div>
        </div>
      ) : (
        <MyClusterReports
          variant="page"
          currentUserKey={currentUserKey}
          currentProjectId={currentProjectId}
          currentRegionId={currentRegionId}
          zones={myZones}
          assignments={myAssignments}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100%',
    overflow: 'auto',
    padding: 24,
    background: 'var(--color-bg)',
  },
  hero: {
    maxWidth: 960,
    margin: '0 auto 20px',
    padding: '24px 26px',
    border: '1px solid var(--color-border)',
    borderRadius: 24,
    background: 'var(--color-surface)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
  },
  kicker: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.12em',
    color: 'var(--color-text-muted)',
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
    color: 'var(--color-text)',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    margin: '10px 0 0',
    fontSize: 14,
    lineHeight: 1.7,
    color: 'var(--color-text-muted)',
    maxWidth: 760,
  },
  emptyState: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '18px 20px',
    borderRadius: 20,
    border: '1px dashed var(--color-border)',
    background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: 'var(--color-text)',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--color-text-muted)',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
    background: 'var(--color-surface)',
  },
  loadingSpinner: {
    width: 36,
    height: 36,
    border: '3px solid var(--color-border)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'var(--color-text-muted)',
    fontSize: 14,
    margin: 0,
  },
}
