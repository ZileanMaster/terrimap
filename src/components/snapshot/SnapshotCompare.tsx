import React, { useMemo } from 'react'
import type { SnapshotItem } from './SnapshotManager.js'
import { getActiveDistrictIds } from '../../utils/districtAssignments.js'

interface SnapshotCompareProps {
  snapshotA: SnapshotItem
  snapshotB: SnapshotItem
  onClose:   () => void
}

export default function SnapshotCompare({ snapshotA, snapshotB, onClose }: SnapshotCompareProps) {

  const { diffs, summaryA, summaryB } = useMemo(() => {
    const mapA = new Map(snapshotA.data.assignments.map((a) => [a.zoneId, a.districtId]))
    const mapB = new Map(snapshotB.data.assignments.map((a) => [a.zoneId, a.districtId]))

    const changes: { zoneId: string; zoneName: string; districtA: number; districtB: number }[] = []
    for (const zone of snapshotA.data.zones) {
      const dA = mapA.get(zone.id) ?? -1
      const dB = mapB.get(zone.id) ?? -1
      if (dA !== dB) {
        changes.push({ zoneId: zone.id, zoneName: zone.name, districtA: dA, districtB: dB })
      }
    }

    const distCountA = getActiveDistrictIds(snapshotA.data.assignments, snapshotA.data.zones).length
    const distCountB = getActiveDistrictIds(snapshotB.data.assignments, snapshotB.data.zones).length

    return {
      diffs: changes,
      summaryA: { zoneCount: snapshotA.data.zones.length, distCount: distCountA },
      summaryB: { zoneCount: snapshotB.data.zones.length, distCount: distCountB },
    }
  }, [snapshotA, snapshotB])

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>📊 So sánh Snapshots</h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Summary grid */}
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.snapLabel}>📌 {snapshotA.label}</div>
            {snapshotA.period && <div style={styles.snapPeriod}>{snapshotA.period}</div>}
            <div style={styles.snapMeta}>
              <span>{summaryA.zoneCount} vùng</span>
              <span>·</span>
              <span>{summaryA.distCount} cụm</span>
            </div>
          </div>
          <div style={styles.vsLabel}>VS</div>
          <div style={styles.summaryCard}>
            <div style={styles.snapLabel}>📌 {snapshotB.label}</div>
            {snapshotB.period && <div style={styles.snapPeriod}>{snapshotB.period}</div>}
            <div style={styles.snapMeta}>
              <span>{summaryB.zoneCount} vùng</span>
              <span>·</span>
              <span>{summaryB.distCount} cụm</span>
            </div>
          </div>
        </div>

        {/* Diff count banner */}
        <div style={{
          ...styles.diffBanner,
          background: diffs.length === 0 ? 'var(--color-success-bg, #f0fdf4)' : 'var(--color-warn-bg, #fffbeb)',
          color:      diffs.length === 0 ? '#16a34a' : '#b45309',
        }}>
          {diffs.length === 0
            ? '✅ Hai snapshots có phân vùng hoàn toàn giống nhau'
            : `${diffs.length} vùng có sự thay đổi cụm`}
        </div>

        {/* Diff table */}
        {diffs.length > 0 && (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Vùng</th>
                  <th style={styles.th}>Cụm (A)</th>
                  <th style={styles.th}>Cụm (B)</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr key={d.zoneId} style={styles.diffRow}>
                    <td style={styles.td}>{d.zoneName}</td>
                    <td style={{ ...styles.td, ...styles.distCell }}>C{d.districtA}</td>
                    <td style={{ ...styles.td, ...styles.distCellB }}>C{d.districtB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={styles.footer}>
          <button style={styles.closeFullBtn} onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position:        'fixed',
    inset:           0,
    zIndex:          3000,
    background:      'rgba(0,0,0,0.5)',
    backdropFilter:  'blur(5px)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         16,
  },
  modal: {
    background:   'var(--color-surface)',
    borderRadius: 16,
    border:       '1.5px solid var(--color-border)',
    width:        '100%',
    maxWidth:     680,
    maxHeight:    '85vh',
    overflowY:    'auto',
    boxShadow:    '0 20px 60px rgba(0,0,0,0.25)',
  },
  header: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         '16px 20px 12px',
    borderBottom:    '1px solid var(--color-border)',
  },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' },
  closeBtn: {
    border: 'none', background: 'transparent', fontSize: 22,
    cursor: 'pointer', color: 'var(--color-text-3)', padding: '2px 8px', borderRadius: 6,
  },
  summaryGrid: {
    display:        'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap:            16,
    padding:        '16px 20px',
    alignItems:     'center',
  },
  summaryCard: {
    background:   'var(--color-surface-2)',
    border:       '1.5px solid var(--color-border)',
    borderRadius: 10,
    padding:      '12px 16px',
  },
  snapLabel:  { fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 },
  snapPeriod: { fontSize: 11, color: 'var(--color-accent)', fontWeight: 600, marginBottom: 4 },
  snapMeta:   { fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 6 },
  vsLabel: {
    fontSize: 18, fontWeight: 900,
    color: 'var(--color-text-3)',
    textAlign: 'center' as const,
  },
  diffBanner: {
    margin:       '0 20px 12px',
    padding:      '10px 16px',
    borderRadius: 8,
    fontSize:     13,
    fontWeight:   600,
  },
  tableWrapper: {
    padding:    '0 20px 8px',
    overflowX:  'auto',
  },
  table: {
    width:           '100%',
    borderCollapse:  'collapse',
    fontSize:        13,
  },
  th: {
    textAlign:     'left' as const,
    padding:       '8px 12px',
    background:    'var(--color-surface-2)',
    borderBottom:  '2px solid var(--color-border)',
    fontWeight:    700,
    color:         'var(--color-text-3)',
    fontSize:      11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  diffRow: { background: 'rgba(251,191,36,0.08)' },
  td:       { padding: '8px 12px', borderBottom: '1px solid var(--color-border)' },
  distCell: { color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' },
  distCellB: {
    color:      '#d97706',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  footer: {
    display:         'flex',
    justifyContent:  'flex-end',
    padding:         '12px 20px 16px',
    borderTop:       '1px solid var(--color-border)',
  },
  closeFullBtn: {
    padding:      '8px 20px',
    borderRadius: 8,
    border:       '1.5px solid var(--color-border)',
    background:   'transparent',
    color:        'var(--color-text)',
    fontSize:     14,
    fontWeight:   600,
    cursor:       'pointer',
  },
}
