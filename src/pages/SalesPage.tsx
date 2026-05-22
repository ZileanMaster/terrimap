/**
 * SalesPage — Read-only district view
 * Layout: [Sidebar | Map]
 *
 * State: reads from global useDataStore — no local DB init needed.
 */

import React, { useMemo, useState, useEffect } from 'react'
import { useUIStore } from '../store/uiStore.js'
import { useDataStore } from '../store/dataStore.js'
import { useFacade } from '../context/FacadeContext.js'
import Sidebar from '../components/layout/Sidebar.js'
import TerritoryMap from '../components/map/TerritoryMap.js'
import ZoneInfoPanel from '../components/map/ZoneInfoPanel.js'
import PartitionFeedback from '../components/feedback/PartitionFeedback.js'
import { loadSnapshots } from '../services/db.js'
import type { Zone, Assignment } from '../../facades/viewmodels.js'

export default function SalesPage() {
  // ── Global store ───────────────────────────────────────────────────────────
  const zones      = useDataStore((s) => s.zones)
  const assignments = useDataStore((s) => s.assignments)
  const loading    = useDataStore((s) => s.loading)

  const selectedZoneId = useUIStore((s) => s.selectedZoneId)
  const selectZone     = useUIStore((s) => s.selectZone)
  const ctx            = useFacade()

  // Latest snapshot for feedback link (Adjust 5)
  const [latestSnapshotId, setLatestSnapshotId]    = useState('')
  const [latestSnapshotLabel, setLatestSnapshotLabel] = useState('')
  useEffect(() => {
    loadSnapshots().then((snaps) => {
      const first = snaps[0]
      if (first) {
        setLatestSnapshotId(first.id)
        setLatestSnapshotLabel(first.label)
      }
    })
  }, [])

  // Filter to this sales agent's district (safe — SalesFacade may throw)
  const { myZones, myAssignments } = useMemo<{
    myZones:       Zone[]
    myAssignments: Assignment[]
  }>(() => {
    if (ctx.role !== 'sales' || zones.length === 0) return { myZones: [], myAssignments: [] }
    try {
      const district = ctx.facade.getMyDistrict()
      const zoneIds  = new Set(district.zones.map((z) => z.id))
      return {
        myZones:       district.zones,
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

  // Use full zones/assignments if sales district is empty (fallback)
  const displayZones       = myZones.length > 0 ? myZones : zones
  const displayAssignments = myAssignments.length > 0 ? myAssignments : assignments

  return (
    <div style={styles.layout}>
      <Sidebar zones={zones} assignments={assignments} />

      <div style={styles.mapArea}>
        <TerritoryMap
          zones={displayZones}
          assignments={displayAssignments}
          onZoneClick={selectZone}
          selectedZoneId={selectedZoneId}
        />
        <ZoneInfoPanel
          zones={zones}
          assignments={assignments}
          districtCount={new Set(assignments.map((a) => a.districtId)).size || 4}
          // No onAssign — Sales is read-only
        />

        {/* Partition Feedback — Adjust 5: truyền snapshotId */}
        {latestSnapshotId && (
          <div style={styles.feedbackBar}>
            <span style={styles.feedbackLabel}>
              Phân vùng hiện tại:
            </span>
            <PartitionFeedback
              snapshotId={latestSnapshotId}
              snapshotLabel={latestSnapshotLabel}
              agentId={ctx.role === 'sales' ? 'current-sales' : 'anon'}
              agentName="Thành viên"
              mode="sales"
            />
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout:   { display: 'flex', height: '100%', overflow: 'hidden' },
  mapArea:  { flex: 1, position: 'relative', overflow: 'hidden' },
  feedbackBar: {
    position:    'absolute',
    bottom:      14,
    left:        '50%',
    transform:   'translateX(-50%)',
    zIndex:      1000,
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    padding:     '8px 16px',
    borderRadius: 99,
    background:  'var(--color-surface)',
    border:      '1.5px solid var(--color-border)',
    boxShadow:   '0 4px 16px rgba(0,0,0,0.14)',
    backdropFilter: 'blur(8px)',
  },
  feedbackLabel: {
    fontSize:  12,
    color:     'var(--color-text-muted)',
    whiteSpace: 'nowrap',
  },
  loading: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 12,
    background: 'var(--color-surface)',
  },
  loadingSpinner: {
    width: 36, height: 36,
    border: '3px solid var(--color-border)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: 'var(--color-text-muted)', fontSize: 14, margin: 0 },
}
