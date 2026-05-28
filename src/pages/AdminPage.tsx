/**
 * AdminPage — Full admin dashboard
 * Layout: [Sidebar | Map | RightPanel]
 *
 * State: reads from global useDataStore (shared with Coordinator/Sales).
 * No local useEffect for DB init — App.tsx handles that exactly once.
 */

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

import { useSAWorker } from '../hooks/useSAWorker.js'
import { validatePartition } from '../../lib/validator.js'

export interface AdminPageProps {
  mode?: 'regions' | 'assignments'
}

export default function AdminPage({ mode = 'assignments' }: AdminPageProps) {
  // ── Global data store (shared across pages) ────────────────────────────────
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
  const currentUserKey = authUser?.id ?? profile?.id ?? profile?.email ?? ''

  // Filter zones/agents/assignments by currentRegionId — MANDATORY:
  // The algorithm MUST run on each region independently.
  const displayZones = currentRegionId
    ? zones.filter((z) => (z as any).regionId === currentRegionId)
    : zones

  const displayAgents = currentRegionId
    ? agents.filter((a) => (a as any).region_id === currentRegionId)
    : agents

  const displayAssignments = currentRegionId
    ? assignments.filter((a) => displayZones.some((z) => z.id === a.zoneId))
    : assignments

  const districtIds = useMemo(
    () => [...new Set(displayAssignments.map((a) => a.districtId))].sort((a, b) => a - b),
    [displayAssignments],
  )

  // Compute map center/zoom from selected region (for flyTo animation)
  const selectedRegion = currentRegionId
    ? regions.find((r) => r.id === currentRegionId)
    : null
  const mapCenter: [number, number] = selectedRegion
    ? [selectedRegion.center.lat, selectedRegion.center.lng]
    : [21.03, 105.83]
  const mapZoom = selectedRegion?.zoom ?? 12

  // Province search fly-to (overrides region center temporarily)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const handleFlyTo = useCallback((lat: number, lng: number, zoom: number) => {
    setFlyTarget({ lat, lng, zoom })
  }, [])
  const effectiveCenter: [number, number] = flyTarget
    ? [flyTarget.lat, flyTarget.lng]
    : mapCenter
  const effectiveZoom = flyTarget?.zoom ?? mapZoom

  // ── Local UI state (not shared) ────────────────────────────────────────────
  const [result, setResult]           = useState<AlgorithmResultVM | null>(null)
  const [progress, setProgress]       = useState(0)
  const [currentCost, setCurrentCost] = useState<number | null>(null)
  const [snapshots, setSnapshots]     = useState<Snapshot[]>([])

  const selectedZoneId        = useUIStore((s) => s.selectedZoneId)
  const selectZone            = useUIStore((s) => s.selectZone)
  const setAlgoRunning        = useUIStore((s) => s.setAlgorithmRunning)
  const highlightedSalesId    = useUIStore((s) => s.highlightedSalesId)
  const setHighlightedSalesId = useUIStore((s) => s.setHighlightedSalesId)
  const isMapTransitioning    = useUIStore((s) => s.isMapTransitioning)
  const setMapTransitioning   = useUIStore((s) => s.setMapTransitioning)
  const ctx                   = useFacade()

  // Load version history once (local facade — not DB)
  useEffect(() => {
    if (ctx.role === 'admin') {
      setSnapshots(ctx.facade.getVersionHistory())
    }
  }, [ctx])

  // ── Matrix data ────────────────────────────────────────────────────────────

  const matrixData = useMemo((): { adj: AdjMatrix; dist: DistMatrix } | null => {
    if (ctx.role !== 'admin') return null
    try { return ctx.facade.computeMatrices(displayZones) } catch { return null }
  }, [ctx, displayZones])

  // ── Island zones ───────────────────────────────────────────────────────────

  const islandZoneIds = useMemo(() => {
    if (ctx.role !== 'admin') return new Set<string>()
    try { return new Set(ctx.facade.getIslandZones(displayZones)) } catch { return new Set<string>() }
  }, [ctx, displayZones])

  // ── Disconnected districts ─────────────────────────────────────────────────

  const disconnectedDistrictIds = useMemo(() => {
    if (!result) return new Set<number>()
    return new Set(
      result.violations
        .filter((v) => v.type === 'CONTIGUITY')
        .map((v) => v.districtId),
    )
  }, [result])

  // ── Export report ──────────────────────────────────────────────────────────

  const reportData = useMemo(() => {
    if (ctx.role !== 'admin') return null
    return ctx.facade.exportReport(displayZones, displayAssignments, displayAgents)
  }, [ctx, displayZones, displayAssignments, displayAgents])

  // ── SA Web Worker ──────────────────────────────────────────────────────────

  const { runSA } = useSAWorker()

  // ── Run algorithm ──────────────────────────────────────────────────────────

  const handleRun = useCallback(async (
    algo: 'greedy' | 'local-search' | 'sa',
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
        const startTime = performance.now()
        try {
          const saAssignments = await runSA(
            displayZones, m,
            { maxIter: 5000, initialTemp: 1000, cooling: 0.995 },
            (iter, cost, total) => {
              setProgress(Math.round((iter / total) * 100))
              setCurrentCost(cost)
            },
          )
          const durationMs = performance.now() - startTime
          partResult = ctx.facade.wrapAssignmentsAsResult('sa', displayZones, saAssignments, displayAgents, durationMs)
        } catch {
          console.warn('[AdminPage] SA Worker failed, falling back to main thread')
          partResult = await ctx.facade.runAlgorithm(algo, displayZones, m, displayAgents)
        }
      } else {
        partResult = await ctx.facade.runAlgorithm(algo, displayZones, m, displayAgents)
      }

      selectZone(null)
      setHighlightedSalesId(null)
      setMapTransitioning(true)
      setTimeout(() => setMapTransitioning(false), 300)

      // Show result IMMEDIATELY — don't wait for DB persist
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

  // ── Auto-suggest SA ────────────────────────────────────────────────────────

  const handleRunSA = useCallback(() => {
    const m = new Set(assignments.map((a) => a.districtId)).size
    handleRun('sa', m || 4)
  }, [handleRun, assignments])

  // ── Snapshot ───────────────────────────────────────────────────────────────

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

  // ── Update activity ────────────────────────────────────────────────────────

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

    const existing = displayAssignments.find((a) => a.zoneId === zoneId)
    const targetSalesAgentId =
      displayAssignments.find((a) => a.districtId === toDistrict)?.salesAgentId
      ?? displayAgents[toDistrict]?.id
      ?? `sa${toDistrict}`

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
      throw new Error('Không thể chuyển polygon vì thao tác này sẽ làm cụm mất liên thông.')
    }

    const scopedZoneIds = new Set(displayZones.map((z) => z.id))
    const mergedAssignments = [
      ...assignments.filter((a) => !scopedZoneIds.has(a.zoneId)),
      ...nextScopedAssignments,
    ]

    await persistAssignments(mergedAssignments)
    selectZone(null)
  }, [ctx, displayAssignments, displayAgents, displayZones, assignments, persistAssignments, selectZone])

  // ── Draw zone ──────────────────────────────────────────────────────────────

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

    await addZone(newZone as Zone)  // await — ensures DB write before tab switch
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

  // ── Delete zone ────────────────────────────────────────────────────────────
  const handleDeleteZone = useCallback(async (zoneId: string) => {
    selectZone(null)
    await removeZone(zoneId)  // awaits DB delete
  }, [selectZone, removeZone])

  const districtCount = districtIds.length
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)

  // ── Loading state ──────────────────────────────────────────────────────────

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
      <div style={styles.leftCol}>
        <Sidebar
          zones={displayZones}
          assignments={displayAssignments}
          onCreateSnapshot={handleSnapshot}
          islandZoneIds={islandZoneIds}
          disconnectedDistrictIds={disconnectedDistrictIds}
          onFlyTo={handleFlyTo}
          mode={mode}
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
          {mode === 'regions' && (
            <DrawingToolbar
              onZoneCreated={handleZoneCreated}
              onZoneEdited={handleZoneEdited}
              existingZones={displayZones}
              selectedZone={displayZones.find((z) => z.id === selectedZoneId) ?? null}
            />
          )}
        </TerritoryMap>
        {currentUserKey && (
          <MyClusterReports
            currentUserKey={currentUserKey}
            currentProjectId={currentProjectId}
            currentRegionId={currentRegionId}
            zones={zones}
            assignments={assignments}
          />
        )}

        {/* Floating Region Header */}
        <div style={styles.floatingRegionHeader}>
          <span style={styles.floatingRegionLabel}>
            📍 Khu vực: <strong>{selectedRegion?.name || 'Chưa chọn'}</strong>
          </span>
          <button
            style={styles.changeRegionBtn}
            onClick={() => setCurrentRegion(null)}
          >
            Đổi khu vực
          </button>
        </div>

        <SnapshotManager />
        <MapLegend assignments={displayAssignments} disconnectedDistrictIds={disconnectedDistrictIds} />
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
    height: '100%',
    overflow: 'hidden',
  },
  leftCol: {
    display:        'flex',
    flexDirection:  'column',
    overflow:       'hidden',
    borderRight:    '1px solid var(--color-border)',
    flexShrink:     0,
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
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'var(--color-text-muted)',
    fontSize: 14,
    margin: 0,
  },
  floatingRegionHeader: {
    position: 'absolute',
    top: 16,
    left: 60,
    zIndex: 1000,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: 'var(--shadow-md)',
    backdropFilter: 'blur(8px)',
  },
  floatingRegionLabel: {
    fontSize: 13,
    color: 'var(--color-text)',
  },
  changeRegionBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-accent-light)',
    color: 'var(--color-accent)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
