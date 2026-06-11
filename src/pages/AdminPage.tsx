import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useUIStore } from '../store/uiStore.js'
import { useDataStore } from '../store/dataStore.js'
import { useFacade } from '../context/FacadeContext.js'
import { isOnline } from '../lib/supabase.js'
import type {
  Zone, GeoJSONPolygon, Assignment, AlgorithmResultVM, Snapshot,
  AdjMatrix, DistMatrix,
} from '../../facades/viewmodels.js'
import Sidebar from '../components/layout/Sidebar.js'
import RightPanel from '../components/layout/RightPanel.js'
import TerritoryMap from '../components/map/TerritoryMap.js'
import ZoneInfoPanel from '../components/map/ZoneInfoPanel.js'
import MapLegend from '../components/map/MapLegend.js'
import DrawingToolbar from '../components/map/DrawingToolbar.js'
import SnapshotManager from '../components/snapshot/SnapshotManager.js'
import MyClusterReports from '../components/reports/MyClusterReports.js'
import { useAuthStore } from '../store/authStore.js'
import { resolveUserKey } from '../utils/userIdentity.js'
import { getActiveDistrictIds } from '../utils/districtAssignments.js'

import { useSAWorker } from '../hooks/useSAWorker.js'
import { validatePartition } from '../../lib/validator.js'
import type { AlgorithmName } from '../../lib/partition.js'

export interface AdminPageProps {
  mode?: 'regions' | 'assignments'
}

export default function AdminPage({ mode = 'assignments' }: AdminPageProps) {
  //  Global data store (shared across pages) 
  const zones              = useDataStore((s) => s.zones)
  const assignments        = useDataStore((s) => s.assignments)
  const agents             = useDataStore((s) => s.agents)
  const loading            = useDataStore((s) => s.loading)
  const regions            = useDataStore((s) => s.regions)
  const currentRegionId    = useDataStore((s) => s.currentRegionId)
  const addZone            = useDataStore((s) => s.addZone)
  const removeZone         = useDataStore((s) => s.removeZone)
  const updateZone         = useDataStore((s) => s.updateZone)
  const persistAssignments = useDataStore((s) => s.persistAssignments)

  const authUser = useAuthStore((s) => s.user)
  const profile  = useAuthStore((s) => s.profile)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const currentUserKey = resolveUserKey(authUser, profile, agents)


  // Thuật toán PHẢI chạy độc lập trên từng region.
  const displayZones = currentRegionId
    ? zones.filter((z) => (z as any).regionId === currentRegionId)
    : zones

  const displayAgents = currentRegionId
    ? agents.filter((a) => (a as any).regionId === currentRegionId || (a as any).region_id === currentRegionId)
    : agents

  const displayAssignments = currentRegionId
    ? assignments.filter((a) => displayZones.some((z) => z.id === a.zoneId))
    : assignments

  const districtIds = useMemo(
    () => getActiveDistrictIds(displayAssignments, displayZones),
    [displayAssignments, displayZones],
  )

  // Tính map center/zoom từ region đã chọn (cho hiệu ứng flyTo)
  const selectedRegion = currentRegionId
    ? regions.find((r) => r.id === currentRegionId)
    : null
  const mapCenter: [number, number] = selectedRegion
    ? [selectedRegion.center.lat, selectedRegion.center.lng]
    : [21.03, 105.83]
  const mapZoom = selectedRegion?.zoom ?? 12


  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const handleFlyTo = useCallback((lat: number, lng: number, zoom: number) => {
    setFlyTarget({ lat, lng, zoom })
  }, [])
  const effectiveCenter: [number, number] = flyTarget
    ? [flyTarget.lat, flyTarget.lng]
    : mapCenter
  const effectiveZoom = flyTarget?.zoom ?? mapZoom

  //  Local UI state (not shared) 
  const [result, setResult]           = useState<AlgorithmResultVM | null>(null)
  const [progress, setProgress]       = useState(0)
  const [currentCost, setCurrentCost] = useState<number | null>(null)
  const [snapshots, setSnapshots]     = useState<Snapshot[]>([])
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false)

  const selectedZoneId        = useUIStore((s) => s.selectedZoneId)
  const selectZone            = useUIStore((s) => s.selectZone)
  const setAlgoRunning        = useUIStore((s) => s.setAlgorithmRunning)
  const highlightedSalesId    = useUIStore((s) => s.highlightedSalesId)
  const setHighlightedSalesId = useUIStore((s) => s.setHighlightedSalesId)
  const isMapTransitioning    = useUIStore((s) => s.isMapTransitioning)
  const setMapTransitioning   = useUIStore((s) => s.setMapTransitioning)

  const ctx                   = useFacade()
  const role                  = useUIStore((s) => s.role)

  // Default: show draw/edit tools inside "Phân chia lãnh thổ".
  // No per-mode enable/disable for drawing toolbar.

  // Tải lịch sử version một lần (facade local - không lấy từ DB)
  useEffect(() => {
    if (ctx.role === 'admin') {
      setSnapshots(ctx.facade.getVersionHistory())
    }
  }, [ctx])

  //  Matrix data 

  const matrixData = useMemo((): { adj: AdjMatrix; dist: DistMatrix } | null => {
    if (ctx.role !== 'admin') return null
    try { return ctx.facade.computeMatrices(displayZones) } catch { return null }
  }, [ctx, displayZones])

  //  Island zones 

  const islandZoneIds = useMemo(() => {
    if (ctx.role !== 'admin') return new Set<string>()
    try { return new Set(ctx.facade.getIslandZones(displayZones)) } catch { return new Set<string>() }
  }, [ctx, displayZones])

  //  Các cụm mất liên thông 

  const disconnectedDistrictIds = useMemo(() => {
    if (!result) return new Set<number>()
    return new Set(
      result.violations
        .filter((v) => v.type === 'CONTIGUITY')
        .map((v) => v.districtId),
    )
  }, [result])

  //  Export report 

  const reportData = useMemo(() => {
    if (ctx.role !== 'admin') return null
    return ctx.facade.exportReport(displayZones, displayAssignments, displayAgents)
  }, [ctx, displayZones, displayAssignments, displayAgents])

  //  SA Web Worker 

  const { runSA } = useSAWorker()

  //  Run algorithm 

  const handleRun = useCallback(async (
    algo: AlgorithmName,
    m: number,
  ) => {
    if (ctx.role !== 'admin') return
    setAlgoRunning(true)
    setProgress(0)
    setCurrentCost(null)
    setResult(null)

    try {
      let partResult: AlgorithmResultVM

      if (!currentRegionId) {
        console.warn('[AdminPage] Phải chọn khu vực (region) trước khi chạy thuật toán')
        alert('Vui lòng chọn khu vực (region) trước khi chạy thuật toán.\nThuật toán chỉ phân chia zones trong cùng 1 khu vực.')
        setAlgoRunning(false)
        return
      }

      if (displayZones.length < 2) {
        console.warn('[AdminPage] Not enough zones in region to run algorithm (need ≥2)')
        setAlgoRunning(false)
        return
      }

      if (algo === 'sa') {
        const saOpts = { maxIter: 12000, initialTemp: 1500, cooling: 0.9965 }
        const startTime = performance.now()
        try {
          const saAssignments = await runSA(
            displayZones, m,
            saOpts,
            (iter, cost, total) => {
              setProgress(Math.round((iter / total) * 100))
              setCurrentCost(cost)
            },
          )
          const durationMs = performance.now() - startTime
          partResult = ctx.facade.wrapAssignmentsAsResult('sa', displayZones, saAssignments, displayAgents, durationMs)
        } catch {
          console.warn('[AdminPage] SA Worker failed, falling back to main thread')
          partResult = await ctx.facade.runAlgorithm(algo, displayZones, m, displayAgents, saOpts)
        }
      } else {
        partResult = await ctx.facade.runAlgorithm(algo, displayZones, m, displayAgents)
      }

      selectZone(null)
      setHighlightedSalesId(null)
      setMapTransitioning(true)
      setTimeout(() => setMapTransitioning(false), 300)

      // Show result IMMEDIATELY - don't wait for DB persist
      setResult(partResult)
      setAlgoRunning(false)

      // Persist in background (fire-and-forget) so UI is never blocked
      persistAssignments(partResult.assignments).catch((e) =>
        console.warn('[AdminPage] persist failed (non-critical):', e),
      )
    } catch (e) {
      console.error('[AdminPage] runAlgorithm error:', e)
      setAlgoRunning(false)
    }
  }, [ctx, displayZones, displayAgents, currentRegionId, runSA, setAlgoRunning, selectZone, setHighlightedSalesId, setMapTransitioning, persistAssignments])

  //  Snapshot 

  const handleSnapshot = useCallback(async () => {
    if (ctx.role !== 'admin') return
    const label = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    try {
      await ctx.facade.createVersion(label, displayZones, displayAssignments)
      setSnapshots(ctx.facade.getVersionHistory())
    } catch (e) {
      console.error('[AdminPage] createVersion error:', e)
    }
  }, [ctx, displayZones, displayAssignments])

  //  Update activity 

  const handleUpdateActivity = useCallback((
    zoneId: string,
    data: { customers?: number; orders?: number },
  ) => {
    if (ctx.role !== 'admin') return
    try {
      const newZones = ctx.facade.updateZoneActivity(zoneId, zones, data)
      const updated = newZones.find((z) => z.id === zoneId)
      if (updated) useDataStore.getState().updateZone(updated)  // awaited inside store
    } catch (e) {
      console.error('[AdminPage] updateActivity error:', e)
    }
  }, [ctx, zones])

  const handleAssign = useCallback(async (zoneId: string, toDistrict: number) => {
    if (ctx.role !== 'admin') return

    try {
      const existing = displayAssignments.find((a) => a.zoneId === zoneId)
      const targetSalesAgentId =
        displayAssignments.find((a) => a.districtId === toDistrict)?.salesAgentId
        ?? ''

      const nextScopedAssignments = existing
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
    } catch (e) {
      console.error('[AdminPage] assignZone error:', e)
      const message = e instanceof Error ? e.message : 'Không thể lưu thay đổi phân vùng'
      alert(message)
    }
  }, [ctx, displayAssignments, displayAgents, displayZones, assignments, persistAssignments, selectZone])

  //  Draw zone 

  const handleZoneCreated = useCallback(async (
    polygon: GeoJSONPolygon,
    centroid: { lat: number; lng: number },
  ) => {
    const name = window.prompt('Tên vùng mới:')
    if (!name?.trim()) return

    const newZone: Zone & { regionId?: string } = {
      id:         `z-${Date.now()}`,
      name:       name.trim(),
      status:     'unassigned',
      centroid,
      polygon,
      activities: [],
      regionId:   currentRegionId || 'region-hn',
    }

    await addZone(newZone as Zone)  // await - ensures DB write before tab switch
  }, [addZone, currentRegionId])

  const handleZoneEdited = useCallback(async (
    zoneId: string,
    polygon: GeoJSONPolygon,
    centroid: { lat: number; lng: number },
  ) => {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return
    await updateZone({ ...zone, polygon, centroid } as Zone)
  }, [zones, updateZone])

  //  Delete zone 
  const handleDeleteZone = useCallback(async (zoneId: string) => {
    selectZone(null)
    await removeZone(zoneId)  // awaits DB delete
  }, [selectZone, removeZone])

    const districtCount = districtIds.length
    const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)
    const showPolygons = useUIStore((s) => s.showPolygons)
    const togglePolygons = useUIStore((s) => s.togglePolygons)

  //  Trạng thái đang tải 

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>
          {isOnline() ? '⏳ Đang kết nối Supabase...' : '⏳ Đang tải dữ liệu...'}
        </p>
      </div>
    )
  }

  return (
    <div style={styles.layout}>
      {workspaceExpanded && <button type="button" aria-label="Đóng bảng phân chia" style={styles.backdrop} onClick={() => setWorkspaceExpanded(false)} />}

      <div
        style={{
          ...styles.leftCol,
          ...(workspaceExpanded ? styles.leftColOverlay : {}),
        }}
      >
        <Sidebar
          zones={displayZones}
          assignments={displayAssignments}
          agents={displayAgents}
          onCreateSnapshot={handleSnapshot}
          islandZoneIds={islandZoneIds}
          disconnectedDistrictIds={disconnectedDistrictIds}
          onFlyTo={handleFlyTo}
          mode={mode}
          workspaceExpanded={workspaceExpanded}
          onToggleWorkspace={() => setWorkspaceExpanded((value) => !value)}
        />
      </div>

      {/* Map area */}
      <div style={styles.mapArea}>
        <TerritoryMap
          zones={displayZones}
          assignments={displayAssignments}
          onZoneClick={selectZone}
          selectedZoneId={selectedZoneId}
          highlightedSalesId={highlightedSalesId}
          isTransitioning={isMapTransitioning}
          center={effectiveCenter}
          zoom={effectiveZoom}
          islandZoneIds={islandZoneIds}
          disconnectedDistrictIds={disconnectedDistrictIds}
        >
          {role === 'admin' && (
            <DrawingToolbar
              onZoneCreated={handleZoneCreated}
              onZoneEdited={handleZoneEdited}
              existingZones={displayZones}
              selectedZone={displayZones.find((z) => z.id === selectedZoneId) ?? null}
            />
          )}
        </TerritoryMap>
          {mode === 'assignments' && currentUserKey && (
            <MyClusterReports
              currentUserKey={currentUserKey}
              currentProjectId={currentProjectId}
              currentRegionId={currentRegionId}
              zones={zones}
              assignments={assignments}
            />
          )}
  
          {/* Map HUD (mode-specific) */}
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
                {/* Drawing toolbar is always visible for admins (top-right). */}
              </div>
            ) : (
              <div style={styles.mapHudRow}>
                <span style={styles.modeBadgeAssign}>Chế độ: Phân chia lãnh thổ</span>
                <div style={styles.qualityRow}>
                  <span style={{ ...styles.qualityPill, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#047857' }}>
                    {districtCount} cụm
                  </span>
                  <span style={{ ...styles.qualityPill, borderColor: disconnectedDistrictIds.size > 0 ? '#fecaca' : '#e5e7eb', background: disconnectedDistrictIds.size > 0 ? '#fef2f2' : '#f8fafc', color: disconnectedDistrictIds.size > 0 ? '#b91c1c' : '#64748b' }}>
                    {disconnectedDistrictIds.size} tách rời
                  </span>
                  <span style={{ ...styles.qualityPill, borderColor: islandZoneIds.size > 0 ? '#fed7aa' : '#e5e7eb', background: islandZoneIds.size > 0 ? '#fff7ed' : '#f8fafc', color: islandZoneIds.size > 0 ? '#c2410c' : '#64748b' }}>
                    {islandZoneIds.size} cô lập
                  </span>
                </div>
                {/* Drawing toolbar is always visible for admins (top-right). */}
              </div>
            )}
          </div>
  
          {mode === 'assignments' && <SnapshotManager />}
          {mode === 'assignments' && (
            <MapLegend
              assignments={displayAssignments}
              zones={displayZones}
              disconnectedDistrictIds={disconnectedDistrictIds}
            />
          )}
          <ZoneInfoPanel
            zones={displayZones}
            assignments={displayAssignments}
            districtCount={districtCount}
          districtIds={districtIds}
          onAssign={handleAssign}
          onUpdateActivity={handleUpdateActivity}
          onDeleteZone={handleDeleteZone}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    position: 'relative',
    height: '100%',
    overflow: 'hidden',
  },
  leftCol: {
    display:        'flex',
    flexDirection:  'column',
    overflow:       'hidden',
    borderRight:    '1px solid var(--color-border)',
    flexShrink:     0,
    width:          360,
    background:     'var(--color-surface)',
    position:       'relative',
    zIndex:         2,
    transition:     'all 180ms ease',
  },
  leftColOverlay: {
    position:   'absolute',
    top:        0,
    left:       0,
    bottom:     0,
    width:      'min(460px, 92vw)',
    zIndex:     1300,
    boxShadow:  '0 24px 64px rgba(15,23,42,.22)',
    borderRight:'1px solid var(--color-border)',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 1200,
    border: 'none',
    background: 'rgba(15, 23, 42, 0.14)',
    cursor: 'pointer',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
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
    borderTopColor: 'var(--color-accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'var(--color-text-muted)',
    fontSize: 14,
    margin: 0,
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
    qualityRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    qualityPill: {
      border: '1px solid',
      padding: '4px 9px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    },
  }
