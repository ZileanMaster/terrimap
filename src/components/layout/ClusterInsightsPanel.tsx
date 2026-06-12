import React, { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { useDataStore } from '../../store/dataStore.js'
import { useFacade } from '../../context/FacadeContext.js'
import { currentPeriod as getCurrentPeriod, loadDistrictReports } from '../../services/districtReportsDb.js'
import { getDistrictFillColor } from '../../data/district-colors.js'
import { buildDistrictSummaries } from '../../utils/districtAssignments.js'
import type { Assignment, DistrictReport, SalesAgent, Zone } from '../../../facades/viewmodels.js'

interface PeriodSummary {
  period: string
  customers: number
  orders: number
  revenue: number
  reportCount: number
  updatedAt: string | undefined
}

interface ClusterInsightsPanelProps {
  zones: Zone[]
  assignments: Assignment[]
  agents: SalesAgent[]
  compact?: boolean
}

interface TeamOverviewSales {
  salesId: string
  salesName: string
  assignedZones: Array<{ customers: number; orders: number }>
}

interface TeamOverviewVM {
  sales: TeamOverviewSales[]
  totalKH: number
  totalOrders: number
}

function shiftMonth(period: string, delta: number): string {
  const [yearPart, monthPart] = period.split('-').map((value) => Number(value))
  const year = Number.isFinite(yearPart) ? Number(yearPart) : new Date().getFullYear()
  const month = Number.isFinite(monthPart) ? Number(monthPart) : new Date().getMonth() + 1
  const next = new Date(year, month - 1 + delta, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function sumDistrictReports(reports: DistrictReport[]): PeriodSummary {
  return {
    period: reports[0]?.period ?? '',
    customers: reports.reduce((sum, report) => sum + (Number(report.customers) || 0), 0),
    orders: reports.reduce((sum, report) => sum + (Number(report.orders) || 0), 0),
    revenue: reports.reduce((sum, report) => sum + (Number(report.revenue) || 0), 0),
    reportCount: reports.length,
    updatedAt: reports[0]?.updatedAt,
  }
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricLabel}>{label}</div>
    </div>
  )
}

export default function ClusterInsightsPanel({
  zones,
  assignments,
  agents,
  compact = false,
}: ClusterInsightsPanelProps) {
  const ctx = useFacade()
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const currentRegionId = useDataStore((s) => s.currentRegionId)
  const [loading, setLoading] = useState(false)
  const [periodReports, setPeriodReports] = useState<Record<string, DistrictReport[]>>({})

  const anchorPeriod = useMemo(() => getCurrentPeriod(), [])
  const periods = useMemo(
    () => [anchorPeriod, shiftMonth(anchorPeriod, -1), shiftMonth(anchorPeriod, -2)],
    [anchorPeriod],
  )

  const visibleAssignments = useMemo(() => {
    if (!currentRegionId) return assignments
    const zoneIds = new Set(zones.map((zone) => zone.id))
    return assignments.filter((assignment) => zoneIds.has(assignment.zoneId))
  }, [assignments, currentRegionId, zones])

  const districtSummaries = useMemo(
    () => buildDistrictSummaries(visibleAssignments, zones),
    [visibleAssignments, zones],
  )
  const districtIds = useMemo(
    () => districtSummaries.map((summary) => summary.districtId),
    [districtSummaries],
  )

  const assignmentByDistrict = useMemo(() => {
    const map = new Map<number, Assignment>()
    for (const assignment of visibleAssignments) {
      if (!map.has(assignment.districtId)) map.set(assignment.districtId, assignment)
    }
    return map
  }, [visibleAssignments])

  const overview = useMemo(() => {
    const facade = ctx.facade as any
    if (typeof facade?.getTeamOverview === 'function') {
      return facade.getTeamOverview(zones, visibleAssignments, agents) as TeamOverviewVM
    }
    return { sales: [], totalKH: 0, totalOrders: 0 } as TeamOverviewVM
  }, [ctx.facade, zones, visibleAssignments, agents])
  const overviewBySalesId = useMemo(
    () => new Map<string, TeamOverviewSales>(overview.sales.map((sales) => [sales.salesId, sales])),
    [overview.sales],
  )

  useEffect(() => {
    let mounted = true
    setLoading(true)

    Promise.all(
      periods.map(async (period) => ({
        period,
        reports: await loadDistrictReports(period, currentProjectId ?? undefined),
      })),
    )
      .then((entries) => {
        if (!mounted) return
        const next: Record<string, DistrictReport[]> = {}
        for (const entry of entries) {
          next[entry.period] = entry.reports
        }
        setPeriodReports(next)
      })
      .catch(() => {
        if (mounted) setPeriodReports({})
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [currentProjectId, periods])

  const districtInsights = useMemo(() => {
    return districtIds.map((districtId) => {
      const districtAssignment = assignmentByDistrict.get(districtId)
      const districtZones = zones.filter((zone) =>
        visibleAssignments.some(
          (assignment) => assignment.districtId === districtId && assignment.zoneId === zone.id,
        ),
      )

      const districtHistory = periods.map((period) => {
        const reports = (periodReports[period] ?? []).filter(
          (report) =>
            report.districtId === districtId
            && (!currentRegionId || report.regionId === currentRegionId)
        )
        return sumDistrictReports(reports)
      })

      const latestHistory = districtHistory.find((entry) => entry.reportCount > 0) ?? districtHistory[0]
      const previousHistory = districtHistory.find((entry) => entry.period !== latestHistory?.period && entry.reportCount > 0) ?? null
      const assignedSalesId = districtAssignment?.salesAgentId ?? ''
      const assignedSales = assignedSalesId ? overviewBySalesId.get(assignedSalesId) : undefined
      const assignedAgent = agents.find((agent) => agent.id === assignedSalesId)

      const districtCustomers = districtZones.reduce(
        (sum, zone) =>
          sum + zone.activities
            .filter((activity) => activity.type === 'CUSTOMER')
            .reduce((acc, activity) => acc + activity.value, 0),
        0,
      )
      const districtOrders = districtZones.reduce(
        (sum, zone) =>
          sum + zone.activities
            .filter((activity) => activity.type === 'ORDER')
            .reduce((acc, activity) => acc + activity.value, 0),
        0,
      )

      return {
        districtId,
        districtZones,
        districtAssignment,
        assignedSales,
        assignedAgent,
        districtCustomers,
        districtOrders,
        districtHistory,
        latestHistory,
        previousHistory,
      }
    })
  }, [assignmentByDistrict, agents, currentRegionId, districtIds, overviewBySalesId, periods, periodReports, visibleAssignments, zones])

  const totalCurrentCustomers = districtInsights.reduce((sum, item) => sum + item.districtCustomers, 0)
  const totalCurrentOrders = districtInsights.reduce((sum, item) => sum + item.districtOrders, 0)
  const totalReports = districtInsights.reduce((sum, item) => sum + (item.latestHistory?.reportCount ?? 0), 0)

  if (districtInsights.length === 0) return null

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>CHỈ SỐ CỤM & NHÂN SỰ</div>
          <div style={styles.title}>Lịch sử khu vực và người phụ trách</div>
          <div style={styles.subtitle}>
            Xem nhanh số liệu quá khứ của từng cụm, cùng thống kê của nhân viên đang được gán cho cụm đó.
          </div>
        </div>
        <div style={styles.badge}>{periods[0]}</div>
      </div>

      <div style={styles.summaryGrid}>
        <Metric label="Cụm đang theo dõi" value={districtInsights.length} />
        <Metric label="Khách hàng hiện tại" value={totalCurrentCustomers.toLocaleString('vi-VN')} />
        <Metric label="Đơn hàng hiện tại" value={totalCurrentOrders.toLocaleString('vi-VN')} />
        <Metric label="Dòng báo cáo gần nhất" value={totalReports.toLocaleString('vi-VN')} />
      </div>

      <div style={styles.list}>
        {districtInsights.map((item) => {
          const fill = getDistrictFillColor(item.districtId)
          const districtZonesLabel = item.districtZones.length > 0
            ? `${item.districtZones.length} vùng`
            : 'Chưa có vùng'
          const assignedLabel = item.assignedAgent?.name ?? item.assignedSales?.salesName ?? 'Chưa gán nhân sự'
          const currentRevenue = item.latestHistory?.revenue ?? 0
          const prevRevenue = item.previousHistory?.revenue ?? 0
          const revenueDelta = currentRevenue - prevRevenue
          const assignedSalesZones = item.assignedSales?.assignedZones ?? []
          const assignedSalesCustomers = assignedSalesZones.reduce((sum, zone) => sum + zone.customers, 0)
          const assignedSalesOrders = assignedSalesZones.reduce((sum, zone) => sum + zone.orders, 0)

          return (
            <div key={item.districtId} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardLeft}>
                  <span style={{ ...styles.dot, background: fill }} />
                  <div>
                    <div style={styles.cardTitle}>Cụm {item.districtId}</div>
                    <div style={styles.cardMeta}>
                      {districtZonesLabel} · {item.districtCustomers.toLocaleString('vi-VN')} KH · {item.districtOrders.toLocaleString('vi-VN')} đơn
                    </div>
                  </div>
                </div>
                <div style={styles.agentChip}>{assignedLabel}</div>
              </div>

              <div style={styles.metricGrid}>
                <div style={styles.metricPill}>
                  <span style={styles.metricPillLabel}>Lịch sử gần nhất</span>
                  <strong>{item.latestHistory?.period || periods[0]}</strong>
                </div>
                <div style={styles.metricPill}>
                  <span style={styles.metricPillLabel}>Khách hàng</span>
                  <strong>{(item.latestHistory?.customers ?? 0).toLocaleString('vi-VN')}</strong>
                </div>
                <div style={styles.metricPill}>
                  <span style={styles.metricPillLabel}>Đơn hàng</span>
                  <strong>{(item.latestHistory?.orders ?? 0).toLocaleString('vi-VN')}</strong>
                </div>
                <div style={styles.metricPill}>
                  <span style={styles.metricPillLabel}>Doanh thu</span>
                  <strong>{currentRevenue.toLocaleString('vi-VN')}</strong>
                </div>
              </div>

              {!compact && (
                <div style={styles.detailGrid}>
                  <div style={styles.detailCard}>
                    <div style={styles.detailTitle}>Lịch sử cụm</div>
                    <div style={styles.history}>
                      {item.districtHistory.map((summary) => (
                        <div key={`${item.districtId}-${summary.period}`} style={styles.historyRow}>
                          <span style={styles.historyPeriod}>{summary.period}</span>
                          <span style={styles.historyValue}>{summary.customers.toLocaleString('vi-VN')} KH</span>
                          <span style={styles.historyValue}>{summary.orders.toLocaleString('vi-VN')} đơn</span>
                          <span style={styles.historyRevenue}>
                            {summary.revenue.toLocaleString('vi-VN')}
                            {summary.updatedAt ? ` · ${new Date(summary.updatedAt).toLocaleDateString('vi-VN')}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    {item.latestHistory && (
                      <div style={styles.deltaRow}>
                        <span style={styles.deltaLabel}>Chênh lệch doanh thu so với kỳ trước</span>
                        <strong style={{ color: revenueDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                          {revenueDelta >= 0 ? '+' : ''}
                          {revenueDelta.toLocaleString('vi-VN')}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div style={styles.detailCard}>
                    <div style={styles.detailTitle}>Lịch sử nhân viên</div>
                    <div style={styles.agentCard}>
                      <div style={styles.agentTitle}>{assignedLabel}</div>
                      <div style={styles.agentSummary}>
                        <span>
                          {item.assignedSales
                            ? `${item.assignedSales.assignedZones.length} cụm đang quản lý`
                            : 'Chưa có dữ liệu nhân sự'}
                        </span>
                        <span>
                          {item.assignedSales
                            ? `${assignedSalesCustomers.toLocaleString('vi-VN')} KH · ${assignedSalesOrders.toLocaleString('vi-VN')} đơn`
                            : 'Chưa có lịch sử nhân viên'}
                        </span>
                      </div>
                    </div>
                    {item.assignedSales && (
                      <div style={styles.agentHistoryList}>
                        {assignedSalesZones.slice(0, 4).map((zone, index) => (
                          <div key={`${assignedLabel}-${index}`} style={styles.agentHistoryRow}>
                            <span style={styles.agentHistoryZone}>Cụm {index + 1}</span>
                            <span style={styles.agentHistoryValue}>{zone.customers.toLocaleString('vi-VN')} KH</span>
                            <span style={styles.agentHistoryValue}>{zone.orders.toLocaleString('vi-VN')} đơn</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {loading && <div style={styles.loading}>Đang tải lịch sử cụm...</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    background: 'var(--color-surface-2)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-3)',
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--color-text)',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--color-text-2)',
    marginTop: 4,
  },
  badge: {
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(37,99,235,0.20)',
    background: 'rgba(37,99,235,0.08)',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 8,
  },
  metricCard: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    borderRadius: 14,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 900,
    color: 'var(--color-text)',
    lineHeight: 1.15,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  card: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    borderRadius: 16,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    minWidth: 0,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  cardMeta: {
    marginTop: 2,
    fontSize: 11,
    color: 'var(--color-text-3)',
    lineHeight: 1.45,
  },
  agentChip: {
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(16,185,129,0.10)',
    color: '#047857',
    border: '1px solid rgba(16,185,129,0.18)',
    fontSize: 11,
    fontWeight: 800,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 8,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
    gap: 10,
    alignItems: 'start',
  },
  detailCard: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    borderRadius: 14,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  metricPill: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    borderRadius: 12,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  metricPillLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--color-text-3)',
    fontWeight: 700,
  },
  agentCard: {
    borderRadius: 14,
    border: '1px solid var(--color-border)',
    background: 'color-mix(in srgb, var(--color-surface) 88%, white)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  agentTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  agentSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 11,
    color: 'var(--color-text-2)',
    lineHeight: 1.45,
  },
  agentHistoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  agentHistoryRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 88px 88px',
    gap: 8,
    alignItems: 'center',
    paddingTop: 6,
    borderTop: '1px dashed var(--color-border)',
    fontSize: 11,
  },
  agentHistoryZone: {
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  agentHistoryValue: {
    color: 'var(--color-text-2)',
    fontWeight: 700,
  },
  history: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  historyRow: {
    display: 'grid',
    gridTemplateColumns: '92px 92px 92px 1fr',
    gap: 8,
    alignItems: 'center',
    fontSize: 11,
    borderTop: '1px dashed var(--color-border)',
    paddingTop: 6,
  },
  historyPeriod: {
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  historyValue: {
    color: 'var(--color-text-2)',
    fontWeight: 700,
  },
  historyRevenue: {
    color: 'var(--color-text-3)',
    textAlign: 'right',
  },
  deltaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 4,
    borderTop: '1px solid var(--color-border)',
    fontSize: 11,
  },
  deltaLabel: {
    color: 'var(--color-text-3)',
    fontWeight: 700,
  },
  loading: {
    padding: '8px 10px',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    fontSize: 12,
    color: 'var(--color-text-2)',
  },
}
