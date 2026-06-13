import React, { useState, useCallback, useMemo } from 'react'
import { useUIStore } from '../store/uiStore.js'
import { useDataStore } from '../store/dataStore.js'
import { useFacade } from '../context/FacadeContext.js'
import Sidebar from '../components/layout/Sidebar.js'
import TerritoryMap from '../components/map/TerritoryMap.js'
import ZoneInfoPanel from '../components/map/ZoneInfoPanel.js'
import MapLegend from '../components/map/MapLegend.js'
import MetricsInput from '../components/coordinator/MetricsInput.js'
import SnapshotManager from '../components/snapshot/SnapshotManager.js'
import MyClusterReports from '../components/reports/MyClusterReports.js'
import { useToast } from '../components/ui/Toast.js'
import { useAuthStore } from '../store/authStore.js'
import { resolveUserKey } from '../utils/userIdentity.js'
import { buildAdjacencyMatrix } from '../../lib/geometry.js'
import { isDistrictConnected } from '../../lib/partition.js'
import { validatePartition } from '../../lib/validator.js'
import { getActiveDistrictIds } from '../utils/districtAssignments.js'
import type { Zone } from '../../facades/viewmodels.js'

function currentPeriodDefault() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface CoordinatorPageProps {
  mode?: 'regions' | 'assignments'
}

export default function CoordinatorPage({ mode = 'assignments' }: CoordinatorPageProps) {
  //  Global store 
  const zones              = useDataStore((s) => s.zones)
  const assignments        = useDataStore((s) => s.assignments)
  const regions            = useDataStore((s) => s.regions)
  const loading            = useDataStore((s) => s.loading)
  const persistAssignments = useDataStore((s) => s.persistAssignments)
  const currentRegionId    = useDataStore((s) => s.currentRegionId)
  const setCurrentRegion   = useDataStore((s) => s.setCurrentRegion)

  const authUser = useAuthStore((s) => s.user)
  const profile  = useAuthStore((s) => s.profile)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const agents = useDataStore((s) => s.agents)
  const currentUserKey = resolveUserKey(authUser, profile, agents)

  const selectedZoneId     = useUIStore((s) => s.selectedZoneId)
  const selectZone         = useUIStore((s) => s.selectZone)
  const highlightedSalesId = useUIStore((s) => s.highlightedSalesId)
  const ctx                = useFacade()
  const { push } = useToast()

  //  Local UI state 
  const [currentPeriod, setCurrentPeriod]       = useState(currentPeriodDefault())
  const [showMetricsInput, setShowMetricsInput] = useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false)

  // Lọc zones theo region đang chọn
  const displayZones = useMemo<Zone[]>(() => {
    if (!currentRegionId) return zones
    return zones.filter((z) => (z as any).regionId === currentRegionId)
  }, [zones, currentRegionId])

  // Tính map center/zoom từ region đã chọn (cho hiệu ứng flyTo)
  const selectedRegion = currentRegionId
    ? regions.find((r) => r.id === currentRegionId)
    : null
  const mapCenter: [number, number] = selectedRegion
    ? [selectedRegion.center.lat, selectedRegion.center.lng]
    : [21.03, 105.83]
  const mapZoom = selectedRegion?.zoom ?? 12

  const displayAssignments = useMemo(
    () => assignments.filter((a) => displayZones.some((z) => z.id === a.zoneId)),
    [assignments, displayZones],
  )
  const displayAgents = useMemo(
    () => (currentRegionId
      ? agents.filter((agent) => (agent as any).region_id === currentRegionId || (agent as any).regionId === currentRegionId)
      : agents),
    [agents, currentRegionId],
  )

  const districtIds = useMemo(
    () => getActiveDistrictIds(displayAssignments, displayZones),
    [displayAssignments, displayZones],
  )

  const handleAssign = useCallback(async (zoneId: string, toDistrict: number) => {
    if (ctx.role !== 'coordinator') return

    try {
      // 3C: kiểm tra liên thông BFS - xác nhận cụm nguồn vẫn liên thông sau khi chuyển
      const currentAssignment = displayAssignments.find((a) => a.zoneId === zoneId)
      const fromDistrict = currentAssignment?.districtId ?? -1

      if (fromDistrict !== toDistrict && fromDistrict >= 0) {
        // Build temp assignment array (index-based)
        const tempAssignments = displayAssignments.map((a) =>
          a.zoneId === zoneId ? { ...a, districtId: toDistrict } : a,
        )
        const assignmentArr = displayZones.map((z) => {
          const a = tempAssignments.find((a) => a.zoneId === z.id)
          return a?.districtId ?? -1
        })

        // Build adjacency matrix from zones
        const adjMatrix = buildAdjacencyMatrix(displayZones)
        const idToIdx   = new Map(displayZones.map((z, i) => [z.id, i]))

        // Kiểm tra cụm nguồn vẫn liên thông
        if (!isDistrictConnected(displayZones, assignmentArr, fromDistrict, adjMatrix, idToIdx)) {
          throw new Error('Không thể chuyển vùng vì thao tác này sẽ làm cụm nguồn bị tách rời.')
        }
      }

      // OK - persist
      const targetSalesAgentId =
        displayAssignments.find((a) => a.districtId === toDistrict)?.salesAgentId
        ?? ''
      const nextScopedAssignments = currentAssignment
        ? displayAssignments.map((a) =>
            a.zoneId === zoneId
              ? { ...a, districtId: toDistrict, salesAgentId: targetSalesAgentId }
              : a,
          )
        : [...displayAssignments, { zoneId, districtId: toDistrict, salesAgentId: targetSalesAgentId }]

      const validation = validatePartition(displayZones, nextScopedAssignments, { adjThresholdKm: 50 })
      const disconnected = validation.violations.find((v) => 'type' in v && v.type === 'DISCONNECTED')
      if (disconnected) {
        throw new Error('Không thể chuyển vùng vì thao tác này sẽ làm cụm mất liên thông.')
      }

      const scopedZoneIds = new Set(displayZones.map((z) => z.id))
      const mergedAssignments = [
        ...assignments.filter((a) => !scopedZoneIds.has(a.zoneId)),
        ...nextScopedAssignments,
      ]
      await persistAssignments(mergedAssignments)
      selectZone(null)
      push({
        kind: 'success',
        title: 'Đã lưu phân chia',
        message: 'Thay đổi phân chia của điều phối đã được áp dụng thành công.',
      })
    } catch (e) {
      console.error('[CoordinatorPage] assignZone error:', e)
      const message = e instanceof Error ? e.message : 'Không thể lưu thay đổi phân vùng'
      push({ kind: 'error', title: 'Không thể lưu', message })
    }
  }, [ctx, assignments, displayAssignments, displayZones, persistAssignments, push, selectZone])

  /**
   * Adjust 2: Chạy thuật toán với bản copy zones (metrics override).
   * KHÔNG sửa store.zones trực tiếp.
   */
  const handleRunWithMetrics = useCallback((zonesWithMetrics: Zone[]) => {

    // Hiện tại: thông báo user về zones đã được cập nhật metrics
    console.info('[CoordinatorPage] Running algorithm with metrics-overridden zones:', zonesWithMetrics.length)
    push({
      kind: 'info',
      title: 'Đã ghi nhận',
      message: `Chạy phân vùng với ${zonesWithMetrics.length} zones (chỉ số tháng ${currentPeriod}).`,
    })
  }, [currentPeriod, push])

  const handleSnapshot = useCallback(async () => {
    if (ctx.role !== 'coordinator') return
    const label = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    try {
      await ctx.facade.createVersion(label, displayZones, displayAssignments)
      push({
        kind: 'success',
        title: 'Đã lưu snapshot',
        message: 'Bản lưu hiện tại đã được tạo thành công.',
      })
    } catch (e) {
      console.error('[CoordinatorPage] createVersion error:', e)
      push({
        kind: 'error',
        title: 'Không thể lưu snapshot',
        message: e instanceof Error ? e.message : 'Không thể lưu snapshot hiện tại.',
      })
    }
  }, [ctx, displayZones, displayAssignments, push])

  const districtCount = districtIds.length
  const showPolygons = useUIStore((s) => s.showPolygons)
  const togglePolygons = useUIStore((s) => s.togglePolygons)

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
      <div
        style={{
          ...styles.leftCol,
          ...(workspaceExpanded ? styles.leftColOverlay : {}),
        }}
      >
        {mode === 'assignments' && (
          <>
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
          </>
        )}

        <Sidebar
          zones={displayZones}
          assignments={displayAssignments}
          agents={displayAgents}
          onCreateSnapshot={handleSnapshot}
          mode={mode}
          workspaceExpanded={workspaceExpanded}
          onToggleWorkspace={() => setWorkspaceExpanded((value) => !value)}
        />
      </div>

        <div
          style={{
            ...styles.mapArea,
            ...(workspaceExpanded ? styles.mapAreaHidden : {}),
          }}
        >
          <TerritoryMap
            zones={displayZones}
            assignments={displayAssignments}
            onZoneClick={selectZone}
            selectedZoneId={selectedZoneId}
            highlightedSalesId={highlightedSalesId}
            center={mapCenter}
            zoom={mapZoom}
          />
          {mode === 'assignments' && currentUserKey && (
            <MyClusterReports
              currentUserKey={currentUserKey}
              currentProjectId={currentProjectId}
              currentRegionId={currentRegionId}
              zones={zones}
              assignments={assignments}
            />
          )}

          {mode === 'assignments' && <SnapshotManager />}

          <div style={styles.mapHud}>
            <div style={styles.mapHudRow}>
              <span style={styles.mapHudTitle}>
                📍 Khu vực: <strong>{selectedRegion?.name || 'Chưa chọn'}</strong>
              </span>
              <button style={styles.mapHudBtn} onClick={() => setCurrentRegion(null)}>
                Đổi khu vực
              </button>
            </div>
            {mode === 'regions' ? (
              <div style={styles.mapHudRow}>
                <span style={styles.modeBadgeEdit}>Chế độ: Phân chia lãnh thổ</span>
                <button style={styles.mapHudBtnGhost} onClick={togglePolygons}>
                  {showPolygons ? 'Ẩn vùng' : 'Hiện vùng'}
                </button>
              </div>
            ) : (
              <div style={styles.mapHudRow}>
                <span style={styles.modeBadgeAssign}>Chế độ: Phân chia lãnh thổ</span>
                <span style={styles.modeNote}>{districtCount} cụm</span>
              </div>
            )}
          </div>

          {mode === 'assignments' && <MapLegend assignments={displayAssignments} zones={displayZones} />}
          <ZoneInfoPanel
            zones={displayZones}
            assignments={displayAssignments}
            onAssign={handleAssign}
            districtCount={districtCount}
            districtIds={districtIds}
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
    width:         360,
    background:    'var(--color-surface)',
    position:      'relative',
    zIndex:        2,
    transition:    'all 180ms ease',
  },
  leftColOverlay: {
    position:    'fixed',
    top:         0,
    left:        280,
    right:       0,
    bottom:      0,
    width:       'auto',
    zIndex:      1300,
    boxShadow:   '0 24px 64px rgba(15,23,42,.22)',
    overflowY:   'auto',
    borderRight: '1px solid var(--color-border)',
  },
  mapHud: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
    background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    boxShadow: '0 8px 18px rgba(0,0,0,.10)',
    backdropFilter: 'blur(6px)',
    maxWidth: 520,
  },
  mapHudRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  mapHudTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  mapHudBtn: {
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 10,
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 12,
    flex: '0 0 auto',
  },
  mapHudBtnGhost: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    padding: '6px 10px',
    borderRadius: 10,
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 12,
    flex: '0 0 auto',
  },
  modeBadgeEdit: {
    border: '1px solid rgba(37,99,235,0.25)',
    background: 'rgba(37,99,235,0.10)',
    color: '#1d4ed8',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },
  modeBadgeAssign: {
    border: '1px solid rgba(5,150,105,0.25)',
    background: 'rgba(5,150,105,0.10)',
    color: '#047857',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },
  modeNote: {
    fontSize: 12,
    fontWeight: 900,
    color: 'var(--color-text)',
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
  mapAreaHidden: { display: 'none' },

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
