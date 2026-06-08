import React, { useMemo } from 'react'
import { useAuthStore } from '../store/authStore.js'
import { useDataStore } from '../store/dataStore.js'
import { useFacade } from '../context/FacadeContext.js'
import MyClusterReports from '../components/reports/MyClusterReports.js'
import { getUserIdentityCandidates, resolveUserKey } from '../utils/userIdentity.js'

export default function SalesReportView() {
  const zones = useDataStore((s) => s.zones)
  const assignments = useDataStore((s) => s.assignments)
  const loading = useDataStore((s) => s.loading)
  const currentRegionId = useDataStore((s) => s.currentRegionId)
  const regions = useDataStore((s) => s.regions)

  const authUser = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const agents = useDataStore((s) => s.agents)
  const currentUserKey = resolveUserKey(authUser, profile, agents)

  const ctx = useFacade()

  const identityCandidates = useMemo(
    () => getUserIdentityCandidates(authUser, profile),
    [authUser, profile],
  )

  const reportTargets = useMemo(() => {
    const matchedDistrictIds = new Set<number>()
    const matchedZoneIds = new Set<string>()

    for (const assignment of assignments) {
      const isMine =
        identityCandidates.includes(assignment.salesAgentId)
        || (currentUserKey !== '' && assignment.salesAgentId === currentUserKey)
      if (!isMine) continue
      matchedDistrictIds.add(assignment.districtId)
      matchedZoneIds.add(assignment.zoneId)
    }

    if (matchedDistrictIds.size === 0) {
      try {
        const district = ctx.facade.getMyDistrict()
        const zoneIds = new Set(district.zones.map((zone) => zone.id))
        for (const assignment of assignments) {
          if (zoneIds.has(assignment.zoneId)) {
            matchedDistrictIds.add(assignment.districtId)
            matchedZoneIds.add(assignment.zoneId)
          }
        }
      } catch {
        // Giữ trạng thái rỗng để hiển thị hướng dẫn bên dưới.
      }
    }

    const districtIds = Array.from(matchedDistrictIds).sort((a, b) => a - b)
    const targetZones = zones.filter((zone) => matchedZoneIds.has(zone.id))
    const targetAssignments = assignments.filter((assignment) => matchedZoneIds.has(assignment.zoneId))

    const targetRegionId =
      currentRegionId
      ?? targetZones.find((zone) => (zone as any).regionId ?? (zone as any).region_id ?? null)?.regionId
      ?? targetZones.find((zone) => (zone as any).regionId ?? (zone as any).region_id ?? null)?.region_id
      ?? null

    const regionLabel = targetRegionId
      ? regions.find((region) => region.id === targetRegionId)?.name ?? targetRegionId
      : 'Chưa xác định'

    return {
      districtIds,
      zones: targetZones,
      assignments: targetAssignments,
      regionId: targetRegionId,
      regionLabel,
    }
  }, [assignments, ctx.facade, currentRegionId, currentUserKey, identityCandidates, regions, zones])

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Đang tải dữ liệu...</p>
      </div>
    )
  }

  const hasTargets = reportTargets.districtIds.length > 0 && reportTargets.regionId !== null

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.kicker}>BÁO CÁO DOANH SỐ</div>
        <h1 style={styles.title}>Nhập báo cáo doanh số</h1>
        <p style={styles.subtitle}>
          Nhân sự nhập số khách hàng, số đơn hàng, doanh thu và ghi chú cho các cụm được giao.
          Điều phối và admin sẽ xem được các báo cáo này trong Vận hành và Tổng quan.
        </p>

        <div style={styles.summaryRow}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Khu vực báo cáo</div>
            <div style={styles.summaryValue}>
              {reportTargets.regionId ? String(reportTargets.regionLabel) : 'Chưa xác định'}
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Cụm được giao</div>
            <div style={styles.summaryValue}>{reportTargets.districtIds.length}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Trạng thái</div>
            <div style={styles.summaryValue}>
              {hasTargets ? 'Sẵn sàng nhập báo cáo' : 'Chưa gán cụm cho nhân sự này'}
            </div>
          </div>
        </div>
      </div>

      {!hasTargets ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>Chưa tìm thấy cụm/vùng được giao</div>
          <div style={styles.emptyText}>
            Hệ thống chưa xác định được cụm của tài khoản này trong dự án hiện tại.
            Hãy kiểm tra lại salesAgentId của nhân sự hoặc gán lại cụm trong màn Phân chia lãnh thổ.
          </div>
        </div>
      ) : (
        <MyClusterReports
          variant="page"
          currentUserKey={currentUserKey}
          currentProjectId={currentProjectId}
          currentRegionId={reportTargets.regionId}
          zones={reportTargets.zones}
          assignments={reportTargets.assignments}
          districtIds={reportTargets.districtIds}
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
  summaryRow: {
    marginTop: 18,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  },
  summaryCard: {
    padding: '14px 16px',
    borderRadius: 18,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--color-text)',
    lineHeight: 1.4,
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
