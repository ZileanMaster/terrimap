/**
 * MyClusterReports — Users enter KPIs for clusters (districts) they manage.
 *
 * "Managed" means: at least one assignment exists with salesAgentId === currentUserKey
 * for the current region. This matches existing district→agent mapping behavior.
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
}

type Row = { customers: number; orders: number; note: string; saving: boolean }

export default function MyClusterReports({
  currentUserKey,
  currentProjectId,
  currentRegionId,
  zones,
  assignments,
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
    const dids = new Set<number>()
    for (const a of assignments) {
      if (!zoneIdsInRegion.has(a.zoneId)) continue
      if (a.salesAgentId === currentUserKey) dids.add(a.districtId)
    }
    return Array.from(dids).sort((a, b) => a - b)
  }, [assignments, zoneIdsInRegion, currentUserKey])

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

  const setRowField = (districtId: number, field: 'customers' | 'orders' | 'note', value: string) => {
    setRows((prev) => {
      const cur = prev[districtId] ?? { customers: 0, orders: 0, note: '', saving: false }
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
      await saveDistrictReport({
        projectId: currentProjectId ?? undefined,
        regionId: currentRegionId,
        districtId,
        userId: currentUserKey,
        period,
        customers: row.customers,
        orders: row.orders,
        note: row.note,
      })
      // Reload for dashboard consistency
      const rs = await loadDistrictReports(period, currentProjectId ?? undefined)
      setReports(rs)
    } finally {
      setRows((prev) => ({ ...prev, [districtId]: { ...prev[districtId]!, saving: false } }))
    }
  }, [currentRegionId, currentProjectId, currentUserKey, period, rows])

  if (!currentRegionId) return null
  if (myDistrictIds.length === 0) return null

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Báo cáo cụm</div>
          <div style={styles.title}>Số liệu của bạn</div>
        </div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={styles.month}
          aria-label="Chọn tháng"
        />
      </div>

      {loading && (
        <div style={styles.loading}>Đang tải...</div>
      )}

      {!loading && (
        <div style={styles.list}>
          {myDistrictIds.map((did) => {
            const row = rows[did] ?? { customers: 0, orders: 0, note: '', saving: false }
            const updatedAt = myReports.find((r) => r.districtId === did)?.updatedAt
            return (
              <div key={did} style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={styles.cardTitle}>Cụm {did}</div>
                  <button
                    type="button"
                    style={{ ...styles.saveBtn, opacity: row.saving ? 0.7 : 1 }}
                    disabled={row.saving}
                    onClick={() => handleSaveOne(did)}
                  >
                    {row.saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
                <div style={styles.grid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Khách hàng</span>
                    <input
                      type="number"
                      min={0}
                      value={row.customers}
                      onChange={(e) => setRowField(did, 'customers', e.target.value)}
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Đơn hàng</span>
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
                  <span style={styles.label}>Ghi chú</span>
                  <input
                    type="text"
                    value={row.note}
                    onChange={(e) => setRowField(did, 'note', e.target.value)}
                    style={styles.input}
                    placeholder="(Tùy chọn)"
                  />
                </label>
                {updatedAt && (
                  <div style={styles.meta}>Cập nhật: {new Date(updatedAt).toLocaleString('vi-VN')}</div>
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
    width: 320,
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--color-text-2)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--color-text)',
    marginTop: 2,
  },
  month: {
    height: 32,
    border: '1px solid var(--color-border)',
    borderRadius: 8,
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
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  card: {
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: 10,
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
    fontSize: 13,
    fontWeight: 900,
    color: 'var(--color-text)',
  },
  saveBtn: {
    border: 0,
    borderRadius: 8,
    background: '#2563eb',
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

