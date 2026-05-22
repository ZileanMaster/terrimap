/**
 * CoordinatorPage — Team overview + manual zone assignment
 * Layout: [Sidebar | Map]
 *
 * Phase 2 additions:
 * - Region dropdown selector (Adjust 4: không auto-detect, dùng dropdown)
 * - Monthly metrics input flow
 * - Filter zones theo region đang chọn
 *
 * State: reads from global useDataStore — no local DB init needed.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { useUIStore } from '../store/uiStore.js'
import { useDataStore } from '../store/dataStore.js'
import { useFacade } from '../context/FacadeContext.js'
import Sidebar from '../components/layout/Sidebar.js'
import TerritoryMap from '../components/map/TerritoryMap.js'
import ZoneInfoPanel from '../components/map/ZoneInfoPanel.js'
import MetricsInput from '../components/coordinator/MetricsInput.js'
import { buildAdjacencyMatrix } from '../../lib/geometry.js'
import { isDistrictConnected } from '../../lib/partition.js'
import type { Zone } from '../../facades/viewmodels.js'

function currentPeriodDefault() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CoordinatorPage() {
  // ── Global store ───────────────────────────────────────────────────────────
  const zones              = useDataStore((s) => s.zones)
  const assignments        = useDataStore((s) => s.assignments)
  const agents             = useDataStore((s) => s.agents)
  const regions            = useDataStore((s) => s.regions)
  const loading            = useDataStore((s) => s.loading)
  const persistAssignments = useDataStore((s) => s.persistAssignments)

  const selectedZoneId     = useUIStore((s) => s.selectedZoneId)
  const selectZone         = useUIStore((s) => s.selectZone)
  const highlightedSalesId = useUIStore((s) => s.highlightedSalesId)
  const ctx                = useFacade()

  // ── Local UI state ─────────────────────────────────────────────────────────
  // Adjust 4: Region dropdown — không auto-detect, user chọn
  const [selectedRegionId, setSelectedRegionId] = useState<string>('')
  const [currentPeriod, setCurrentPeriod]       = useState(currentPeriodDefault())
  const [showMetricsInput, setShowMetricsInput] = useState(false)

  // Filter zones theo region đang chọn
  const displayZones = useMemo<Zone[]>(() => {
    if (!selectedRegionId) return zones
    return zones.filter((z) => (z as any).regionId === selectedRegionId)
  }, [zones, selectedRegionId])

  // Compute map center/zoom from selected region (for flyTo animation)
  const selectedRegion = selectedRegionId
    ? regions.find((r) => r.id === selectedRegionId)
    : null
  const mapCenter: [number, number] = selectedRegion
    ? [selectedRegion.center.lat, selectedRegion.center.lng]
    : [21.03, 105.83]
  const mapZoom = selectedRegion?.zoom ?? 12

  const displayAssignments = useMemo(
    () => assignments.filter((a) => displayZones.some((z) => z.id === a.zoneId)),
    [assignments, displayZones],
  )

  const handleAssign = useCallback(async (zoneId: string, toDistrict: number) => {
    if (ctx.role !== 'coordinator') return

    // 3C: BFS connectivity check — verify source district remains connected after move
    const currentAssignment = assignments.find((a) => a.zoneId === zoneId)
    const fromDistrict = currentAssignment?.districtId ?? -1

    if (fromDistrict !== toDistrict && fromDistrict >= 0) {
      // Build temp assignment array (index-based)
      const tempAssignments = assignments.map((a) =>
        a.zoneId === zoneId ? { ...a, districtId: toDistrict } : a,
      )
      const assignmentArr = zones.map((z) => {
        const a = tempAssignments.find((a) => a.zoneId === z.id)
        return a?.districtId ?? -1
      })

      // Build adjacency matrix from zones
      const adjMatrix = buildAdjacencyMatrix(zones)
      const idToIdx   = new Map(zones.map((z, i) => [z.id, i]))

      // Check source district still connected
      if (!isDistrictConnected(zones, assignmentArr, fromDistrict, adjMatrix, idToIdx)) {
        alert('\u26a0\ufe0f Chuy\u1ec3n zone n\u00e0y s\u1ebd l\u00e0m district b\u1ecb t\u00e1ch r\u1eddi. Kh\u00f4ng th\u1ec3 th\u1ef1c hi\u1ec7n.')
        return
      }
    }

    // OK — persist
    try {
      const result = await ctx.facade.assignZone(zoneId, toDistrict, assignments, zones)
      if (result.ok) {
        const newAssignments = assignments.map((a) =>
          a.zoneId === zoneId
            ? { ...a, districtId: toDistrict, salesAgentId: `sa${toDistrict}` }
            : a,
        )
        await persistAssignments(newAssignments)
        selectZone(null)
      }
    } catch (e) {
      console.error('[CoordinatorPage] assignZone error:', e)
    }
  }, [ctx, assignments, zones, persistAssignments, selectZone])

  /**
   * Adjust 2: Chạy thuật toán với bản copy zones (metrics override).
   * KHÔNG sửa store.zones trực tiếp.
   */
  const handleRunWithMetrics = useCallback((zonesWithMetrics: Zone[]) => {
    // TODO Phase 2.5: trigger algorithm runner từ CoordinatorPage
    // Hiện tại: thông báo user về zones đã được cập nhật metrics
    console.info('[CoordinatorPage] Running algorithm with metrics-overridden zones:', zonesWithMetrics.length)
    alert(`✅ Chạy phân vùng với ${zonesWithMetrics.length} zones (chỉ số tháng ${currentPeriod}).\nTính năng chạy thuật toán sẽ được tích hợp sau.`)
  }, [currentPeriod])

  const districtCount = new Set(assignments.map((a) => a.districtId)).size

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>⏳ Đang tải dữ liệu...</p>
      </div>
    )
  }

  return (
    <div style={styles.layout}>
      {/* Left sidebar */}
      <div style={styles.leftCol}>
        {/* Region selector — Adjust 4 */}
        <div style={styles.regionBar}>
          <span style={styles.regionLabel}>📍 Khu vực:</span>
          <select
            value={selectedRegionId}
            onChange={(e) => setSelectedRegionId(e.target.value)}
            style={styles.regionSelect}
          >
            <option value="">Tất cả khu vực</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Period selector + metrics toggle */}
        <div style={styles.metricBar}>
          <input
            type="month"
            value={currentPeriod}
            onChange={(e) => setCurrentPeriod(e.target.value)}
            style={styles.monthInput}
          />
          <button
            onClick={() => setShowMetricsInput((v) => !v)}
            style={{
              ...styles.metricsBtn,
              background: showMetricsInput ? 'var(--color-accent)' : 'transparent',
              color:      showMetricsInput ? '#fff' : 'var(--color-text)',
            }}
          >
            {showMetricsInput ? '▲ Ẩn' : '📊 Nhập chỉ số tháng'}
          </button>
        </div>

        {/* Metrics input panel */}
        {showMetricsInput && (
          <div style={styles.metricsPanel}>
            <MetricsInput
              period={currentPeriod}
              zones={displayZones}
              onRunWithMetrics={handleRunWithMetrics}
            />
          </div>
        )}

        <Sidebar zones={displayZones} assignments={displayAssignments} />
      </div>

      <div style={styles.mapArea}>
        <TerritoryMap
          zones={displayZones}
          assignments={displayAssignments}
          onZoneClick={selectZone}
          selectedZoneId={selectedZoneId}
          highlightedSalesId={highlightedSalesId}
          center={mapCenter}
          zoom={mapZoom}
        />
        <ZoneInfoPanel
          zones={displayZones}
          assignments={displayAssignments}
          onAssign={handleAssign}
          districtCount={districtCount}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', height: '100%', overflow: 'hidden' },

  leftCol: {
    display:       'flex',
    flexDirection: 'column',
    overflow:      'hidden',
    borderRight:   '1px solid var(--color-border)',
    flexShrink:    0,
  },

  regionBar: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    padding:      '8px 12px',
    borderBottom: '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    flexShrink:   0,
  },
  regionLabel: {
    fontSize:   12,
    fontWeight: 600,
    color:      'var(--color-text-muted)',
    whiteSpace: 'nowrap',
  },
  regionSelect: {
    flex:         1,
    fontSize:     13,
    padding:      '4px 8px',
    borderRadius: 6,
    border:       '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
    cursor:       'pointer',
  },

  metricBar: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '6px 12px',
    borderBottom: '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    flexShrink:   0,
  },
  monthInput: {
    fontSize:     12,
    padding:      '3px 6px',
    borderRadius: 6,
    border:       '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
  },
  metricsBtn: {
    flex:         1,
    padding:      '4px 10px',
    borderRadius: 7,
    border:       '1.5px solid var(--color-border)',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
    transition:   'all 150ms',
  },

  metricsPanel: {
    overflowY:  'auto',
    maxHeight:  320,
    padding:    '0 10px 10px',
    flexShrink: 0,
  },

  mapArea:  { flex: 1, position: 'relative', overflow: 'hidden' },

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
