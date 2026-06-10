import React, { useState, useEffect, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import {
  saveMonthlyMetrics,
  loadMonthlyMetrics,
  type MonthlyMetric,
} from '../../services/metricsDb.js'
import type { Zone } from '../../../facades/viewmodels.js'

interface MetricsInputProps {
  /** format: '2026-04' */
  period:    string
  zones:     Zone[]
  onRunWithMetrics: (zonesWithMetrics: Zone[]) => void
}

interface RowData {
  customers:   number
  orders:      number
  revenue:     number
  familiarity: number
}

const DEFAULT_ROW: RowData = { customers: 0, orders: 0, revenue: 0, familiarity: 0 }

export default function MetricsInput({ period, zones, onRunWithMetrics }: MetricsInputProps) {
  const [rows, setRows]       = useState<Record<string, RowData>>({})
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    setLoading(true)
    const zoneIds = zones.map((z) => z.id)
    loadMonthlyMetrics(period, zoneIds).then((metricsMap) => {
      const initialRows: Record<string, RowData> = {}
      for (const zone of zones) {
        const mets = metricsMap.get(zone.id) ?? []
        initialRows[zone.id] = {
          customers:   mets.find((m) => m.type === 'CUSTOMER')?.value   ?? 0,
          orders:      mets.find((m) => m.type === 'ORDER')?.value      ?? 0,
          revenue:     mets.find((m) => m.type === 'REVENUE')?.value    ?? 0,
          familiarity: mets.find((m) => m.type === 'FAMILIARITY')?.value ?? 0,
        }
      }
      setRows(initialRows)
      setLoading(false)
    })
  }, [period, zones])

  const updateRow = (zoneId: string, field: keyof RowData, value: string) => {
    setRows((prev) => ({
      ...prev,
      [zoneId]: { ...(prev[zoneId] ?? DEFAULT_ROW), [field]: Number(value) || 0 },
    }))
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await Promise.all(
        zones.map((zone) => {
          const row = rows[zone.id] ?? DEFAULT_ROW
          const metrics: MonthlyMetric[] = [
            { type: 'CUSTOMER',    value: row.customers   },
            { type: 'ORDER',       value: row.orders      },
            { type: 'REVENUE',     value: row.revenue     },
            { type: 'FAMILIARITY', value: row.familiarity },
          ]
          return saveMonthlyMetrics(zone.id, period, metrics)
        }),
      )
      alert('✅ Đã lưu chỉ số!')
    } catch (e) {
      alert('❌ Lỗi khi lưu: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [zones, rows, period])

  const handleImportCSV = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const lines = text.trim().split('\n')
      const newRows = { ...rows }
      for (const line of lines.slice(1)) {
        const [zoneId, cust, ord, rev, fam] = line.split(',').map((s) => s.trim())
        if (!zoneId) continue
        newRows[zoneId] = {
          customers:   Number(cust) || 0,
          orders:      Number(ord)  || 0,
          revenue:     Number(rev)  || 0,
          familiarity: Number(fam)  || 0,
        }
      }
      setRows(newRows)
    }
    input.click()
  }, [rows])

  /**
   * Adjust 2: Tạo bản copy zones với activities override từ metrics.
   * KHÔNG sửa store.zones trực tiếp.
   */
  const handleRunWithMetrics = useCallback(() => {
    const zonesWithMetrics: Zone[] = zones.map((zone) => {
      const row = rows[zone.id] ?? DEFAULT_ROW
      return {
        ...zone,
        activities: [
          { id: `${zone.id}-cust`, type: 'CUSTOMER',    value: row.customers   },
          { id: `${zone.id}-ord`,  type: 'ORDER',       value: row.orders      },
          { id: `${zone.id}-rev`,  type: 'REVENUE',     value: row.revenue     },
          { id: `${zone.id}-fam`,  type: 'FAMILIARITY', value: row.familiarity },
        ],
      }
    })
    onRunWithMetrics(zonesWithMetrics)
  }, [zones, rows, onRunWithMetrics])

  if (loading) {
    return <div style={styles.loading}>⏳ Đang tải chỉ số tháng {period}...</div>
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>📊 Chỉ số tháng {period}</span>
        <div style={styles.headerBtns}>
          <button onClick={handleImportCSV} style={styles.btnSecondary}>📥 Import CSV</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...styles.btnPrimary, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? '⏳ Đang lưu...' : '💾 Lưu chỉ số'}
          </button>
          <button onClick={handleRunWithMetrics} style={styles.btnRun}>
            ▶️ Chạy phân vùng
          </button>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Vùng</th>
              <th style={styles.th}>Khách hàng</th>
              <th style={styles.th}>Đơn hàng</th>
              <th style={styles.th}>Doanh thu</th>
              <th style={styles.th}>Thân thuộc</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => {
              const row = rows[zone.id] ?? DEFAULT_ROW
              return (
                <tr key={zone.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 600, color: 'var(--color-text)' }}>
                    {zone.name}
                  </td>
                  {(['customers', 'orders', 'revenue', 'familiarity'] as (keyof RowData)[]).map((field) => (
                    <td key={field} style={styles.td}>
                      <input
                        type="number"
                        min={0}
                        value={row[field]}
                        onChange={(e) => updateRow(zone.id, field, e.target.value)}
                        style={styles.input}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.hint}>
        CSV format: <code>zone_id,customers,orders,revenue,familiarity</code>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background:   'var(--color-surface)',
    border:       '1px solid var(--color-border)',
    borderRadius: 10,
    overflow:     'hidden',
    marginTop:    8,
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    flexWrap:       'wrap',
    gap:            8,
    padding:        '10px 14px',
    borderBottom:   '1px solid var(--color-border)',
    background:     'var(--color-surface-2)',
  },
  title: {
    fontSize:   14,
    fontWeight: 700,
    color:      'var(--color-text)',
  },
  headerBtns: {
    display: 'flex',
    gap:     6,
  },
  btnSecondary: {
    padding:      '5px 12px',
    borderRadius: 7,
    border:       '1.5px solid var(--color-border)',
    background:   'transparent',
    color:        'var(--color-text)',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
  },
  btnPrimary: {
    padding:      '5px 12px',
    borderRadius: 7,
    border:       'none',
    background:   'var(--color-accent)',
    color:        '#fff',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
  },
  btnRun: {
    padding:      '5px 12px',
    borderRadius: 7,
    border:       'none',
    background:   'var(--color-success, #22c55e)',
    color:        '#fff',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
    maxHeight: 300,
    overflowY: 'auto',
  },
  table: {
    width:           '100%',
    borderCollapse:  'collapse',
    fontSize:        13,
  },
  thead: {
    position:   'sticky',
    top:        0,
    background: 'var(--color-surface-2)',
    zIndex:     1,
  },
  th: {
    padding:     '8px 10px',
    textAlign:   'left',
    fontWeight:  700,
    fontSize:    12,
    color:       'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace:  'nowrap',
  },
  tr: { borderBottom: '1px solid var(--color-border)' },
  td: {
    padding: '6px 10px',
    color:   'var(--color-text-muted)',
  },
  input: {
    width:        '80px',
    padding:      '4px 6px',
    borderRadius: 5,
    border:       '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
    fontSize:     13,
  },
  loading: {
    padding: 20,
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: 13,
  },
  hint: {
    padding:  '6px 14px',
    fontSize: 11,
    color:    'var(--color-text-muted)',
    borderTop: '1px solid var(--color-border)',
  },
}
