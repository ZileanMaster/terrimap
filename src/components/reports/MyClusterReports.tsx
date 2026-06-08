/**
 * MyClusterReports â€” Users enter KPIs for clusters (districts) they manage.
 *
 * "Managed" means: at least one assignment exists with salesAgentId === currentUserKey
 * for the current region. This matches existing districtâ†’agent mapping behavior.
 *
 * Data is stored in localStorage (project-scoped) and optionally Supabase
 * via district_reports table.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import type { Assignment, DistrictReport, Zone } from '../../../facades/viewmodels.js'
import { currentPeriod, loadDistrictReports, saveDistrictReport } from '../../services/districtReportsDb.js'

interface MyClusterReportsProps {
  currentUserKey: string
  currentProjectId?: string | null
  currentRegionId: string | null
  zones: Zone[]
  assignments: Assignment[]
  variant?: 'overlay' | 'page'
  districtIds?: number[]
}

type Row = { customers: number; orders: number; revenue: number; note: string; saving: boolean }

export default function MyClusterReports({
  currentUserKey,
  currentProjectId,
  currentRegionId,
  zones,
  assignments,
  variant = 'overlay',
  districtIds,
}: MyClusterReportsProps) {
  const [period, setPeriod] = useState(currentPeriod())
  const [reports, setReports] = useState<DistrictReport[]>([])
  const [rows, setRows] = useState<Record<number, Row>>({})
  const [loading, setLoading] = useState(false)

  const zoneIdsInRegion = useMemo(() => {
    if (!currentRegionId) return new Set(zones.map((z) => z.id))
    return new Set(zones.filter((z) => (z as any).regionId === currentRegionId).map((z) => z.id))
  }, [zones, currentRegionId])

  const myDistrictIds = useMemo(() => {
    if (districtIds && districtIds.length > 0) {
      return Array.from(new Set(districtIds)).sort((a, b) => a - b)
    }
    const dids = new Set<number>()
    for (const a of assignments) {
      if (!zoneIdsInRegion.has(a.zoneId)) continue
      if (a.salesAgentId === currentUserKey) dids.add(a.districtId)
    }
    return Array.from(dids).sort((a, b) => a - b)
  }, [districtIds, assignments, zoneIdsInRegion, currentUserKey])

  const myReports = useMemo(() => {
    return reports
      .filter((r) =>
        r.userId === currentUserKey
        && (!currentRegionId || r.regionId === currentRegionId)
        && myDistrictIds.includes(r.districtId),
      )
  }, [reports, currentUserKey, currentRegionId, myDistrictIds])

  // Load reports for this period
  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadDistrictReports(period, currentProjectId ?? undefined)
      .then((rs) => {
        if (!mounted) return
        setReports(rs)

        // Prefill rows for my districts from existing reports
        const nextRows: Record<number, Row> = {}
        for (const did of myDistrictIds) {
          const existing = rs.find((r) =>
            r.userId === currentUserKey
            && r.districtId === did
            && (!currentRegionId || r.regionId === currentRegionId),
          )
          nextRows[did] = {
            customers: existing?.customers ?? 0,
            orders: existing?.orders ?? 0,
            revenue: existing?.revenue ?? 0,
            note: existing?.note ?? '',
            saving: false,
          }
        }
        setRows(nextRows)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [period, currentProjectId, currentUserKey, currentRegionId, myDistrictIds])

  const setRowField = (districtId: number, field: 'customers' | 'orders' | 'revenue' | 'note', value: string) => {
    setRows((prev) => {
      const cur = prev[districtId] ?? { customers: 0, orders: 0, revenue: 0, note: '', saving: false }
      const next: Row = {
        ...cur,
        [field]: field === 'note' ? value : (Number(value) || 0),
      } as Row
      return { ...prev, [districtId]: next }
    })
  }

  const handleSaveOne = useCallback(async (districtId: number) => {
    if (!currentRegionId) return
    const row = rows[districtId]
    if (!row) return

    setRows((prev) => ({ ...prev, [districtId]: { ...prev[districtId]!, saving: true } }))
    try {
      const nextReport: DistrictReport = {
        id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId: currentProjectId ?? undefined,
        regionId: currentRegionId,
        districtId,
        userId: currentUserKey,
        period,
        customers: row.customers,
        orders: row.orders,
        revenue: row.revenue,
        note: row.note,
        updatedAt: new Date().toISOString(),
      }

      setReports((prev) => {
        const key = (r: DistrictReport) => (
          r.period === nextReport.period
          && r.userId === nextReport.userId
          && r.regionId === nextReport.regionId
          && r.districtId === nextReport.districtId
        )
        const filtered = prev.filter((r) => !key(r))
        return [nextReport, ...filtered]
      })

      void saveDistrictReport({
        projectId: currentProjectId ?? undefined,
        regionId: currentRegionId,
        districtId,
        userId: currentUserKey,
        period,
        customers: row.customers,
        orders: row.orders,
        revenue: row.revenue,
        note: row.note,
      })
      void loadDistrictReports(period, currentProjectId ?? undefined)
        .then((rs) => setReports(rs))
        .catch(() => {
          // Keep optimistic state if refresh fails.
        })
    } finally {
      setRows((prev) => ({ ...prev, [districtId]: { ...prev[districtId]!, saving: false } }))
    }
  }, [currentRegionId, currentProjectId, currentUserKey, period, rows])

  if (!currentRegionId) return null
  if (myDistrictIds.length === 0) return null

  const isPage = variant === 'page'

  return (
    <div
      style={{
        ...styles.container,
        ...(isPage ? styles.pageContainer : {}),
      }}
    >
      <div style={styles.header}>
        <div style={styles.headerCopy}>
          <div style={styles.kicker}>BÃ¡o cÃ¡o cá»¥m</div>
          <div style={styles.title}>Sá»‘ liá»‡u cá»§a báº¡n</div>
          <div style={styles.subtitle}>
            Nhập số khách hàng, số đơn hàng, doanh thu và ghi chú cho các cụm bạn đang quản lý.
          </div>
          <div style={styles.badgeRow}>
            <span style={styles.badge}>{period}</span>
            <span style={styles.badge}>{myDistrictIds.length} cá»¥m</span>
            <span style={styles.badge}>{myReports.length} dÃ²ng Ä‘Ã£ lÆ°u</span>
          </div>
        </div>
        <label style={styles.monthWrap}>
          <span style={styles.monthLabel}>ThÃ¡ng</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={styles.month}
            aria-label="Chá»n thÃ¡ng"
          />
        </label>
      </div>

      {loading && (
        <div style={styles.loading}>Äang táº£i...</div>
      )}

      {!loading && (
        <div
          style={{
            ...styles.list,
            ...(isPage ? styles.pageList : {}),
          }}
        >
          {myReports.length === 0 && (
            <div style={styles.emptyState}>
              ChÆ°a cÃ³ bÃ¡o cÃ¡o nÃ o trong thÃ¡ng nÃ y. Nháº­p sá»‘ liá»‡u Ä‘á»ƒ dashboard cáº­p nháº­t ngay.
            </div>
          )}
          {myDistrictIds.map((did) => {
            const row = rows[did] ?? { customers: 0, orders: 0, revenue: 0, note: '', saving: false }
            const updatedAt = myReports.find((r) => r.districtId === did)?.updatedAt
            return (
              <div key={did} style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={styles.cardTitle}>Cá»¥m {did}</div>
                  <button
                    type="button"
                    style={{ ...styles.saveBtn, opacity: row.saving ? 0.7 : 1 }}
                    disabled={row.saving}
                    onClick={() => handleSaveOne(did)}
                  >
                    {row.saving ? 'Äang lÆ°u...' : 'LÆ°u'}
                  </button>
                </div>
                <div style={styles.grid}>
                  <label style={styles.field}>
                    <span style={styles.label}>KhÃ¡ch hÃ ng</span>
                    <input
                      type="number"
                      min={0}
                      value={row.customers}
                      onChange={(e) => setRowField(did, 'customers', e.target.value)}
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>ÄÆ¡n hÃ ng</span>
                    <input
                      type="number"
                      min={0}
                      value={row.orders}
                      onChange={(e) => setRowField(did, 'orders', e.target.value)}
                      style={styles.input}
                    />
                  </label>
                </div>
                <label style={styles.fieldWide}>
                  <span style={styles.label}>Doanh thu</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={row.revenue}
                    onChange={(e) => setRowField(did, 'revenue', e.target.value)}
                    style={styles.input}
                    placeholder="VNÄ"
                  />
                </label>
                <label style={styles.fieldWide}>
                  <span style={styles.label}>Ghi chÃº</span>
                  <input
                    type="text"
                    value={row.note}
                    onChange={(e) => setRowField(did, 'note', e.target.value)}
                    style={styles.input}
                    placeholder="(TÃ¹y chá»n)"
                  />
                </label>
                {updatedAt && (
                  <div style={styles.meta}>Cáº­p nháº­t: {new Date(updatedAt).toLocaleString('vi-VN')}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 850,
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid var(--color-border)',
    borderRadius: 20,
    background: 'color-mix(in srgb, var(--color-surface) 96%, transparent)',
    boxShadow: '0 18px 36px rgba(0,0,0,.18)',
    overflow: 'hidden',
    backdropFilter: 'blur(12px)',
  },
  pageContainer: {
    position: 'relative',
    top: 'auto',
    right: 'auto',
    zIndex: 1,
    width: '100%',
    maxWidth: 960,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 14px 12px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
  },
  headerCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--color-text-2)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--color-text)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--color-text-2)',
    lineHeight: 1.5,
    maxWidth: '28ch',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    border: '1px solid var(--color-border)',
    borderRadius: 999,
    background: 'var(--color-surface)',
    color: 'var(--color-text-2)',
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 800,
  },
  monthWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 122,
    flexShrink: 0,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--color-text-2)',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  month: {
    height: 36,
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '0 8px',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: 12,
    fontWeight: 700,
  },
  loading: {
    padding: 12,
    fontSize: 12,
    color: 'var(--color-text-2)',
  },
  list: {
    maxHeight: 420,
    overflowY: 'auto',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  pageList: {
    maxHeight: 'none',
    overflowY: 'visible',
  },
  emptyState: {
    border: '1px dashed var(--color-border)',
    borderRadius: 16,
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-2)',
    padding: 14,
    fontSize: 12,
    lineHeight: 1.5,
  },
  card: {
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    padding: 12,
    background: 'var(--color-bg)',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: 'var(--color-text)',
  },
  saveBtn: {
    border: 0,
    borderRadius: 10,
    background: 'var(--color-accent)',
    color: '#fff',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldWide: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 8,
  },
  label: {
    fontSize: 11,
    color: 'var(--color-text-2)',
    fontWeight: 750,
  },
  input: {
    height: 34,
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '0 10px',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 12,
    fontWeight: 700,
    outline: 'none',
  },
  meta: {
    marginTop: 8,
    fontSize: 11,
    color: 'var(--color-text-3)',
  },
}

