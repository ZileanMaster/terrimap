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
import { saveZone } from '../services/db.js'
import { isOnline } from '../lib/supabase.js'
import type {
  Zone, GeoJSONPolygon, Assignment, AlgorithmResultVM, Snapshot,
  AdjMatrix, DistMatrix,
} from '../../facades/viewmodels.js'
import Sidebar from '../components/layout/Sidebar.js'
import RightPanel from '../components/layout/RightPanel.js'
import TerritoryMap from '../components/map/TerritoryMap.js'
import ZoneInfoPanel from '../components/map/ZoneInfoPanel.js'
import DrawingToolbar from '../components/map/DrawingToolbar.js'
import SnapshotManager from '../components/snapshot/SnapshotManager.js'

import { useSAWorker } from '../hooks/useSAWorker.js'

export default function AdminPage() {
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

  // Filter zones by currentRegionId when a region is selected
  const displayZones = currentRegionId
    ? zones.filter((z) => (z as any).regionId === currentRegionId)
    : zones

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
    try { return ctx.facade.computeMatrices(zones) } catch { return null }
  }, [ctx, zones])

  // ── Island zones ───────────────────────────────────────────────────────────

  const islandZoneIds = useMemo(() => {
    if (ctx.role !== 'admin') return new Set<string>()
    try { return new Set(ctx.facade.getIslandZones(zones)) } catch { return new Set<string>() }
  }, [ctx, zones])

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
    return ctx.facade.exportReport(zones, assignments, agents)
  }, [ctx, zones, assignments, agents])

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

      if (algo === 'sa') {
        const startTime = performance.now()
        try {
          const saAssignments = await runSA(
            zones, m,
            { maxIter: 5000, initialTemp: 1000, cooling: 0.995 },
            (iter, cost, total) => {
              setProgress(Math.round((iter / total) * 100))
              setCurrentCost(cost)
            },
          )
          const durationMs = performance.now() - startTime
          partResult = ctx.facade.wrapAssignmentsAsResult('sa', zones, saAssignments, agents, durationMs)
        } catch {
          console.warn('[AdminPage] SA Worker failed, falling back to main thread')
          partResult = await ctx.facade.runAlgorithm(algo, zones, m, agents)
        }
      } else {
        partResult = await ctx.facade.runAlgorithm(algo, zones, m, agents)
      }

      selectZone(null)
      setHighlightedSalesId(null)
      setMapTransitioning(true)

      // Await persist — prevents data loss if user switches tab immediately
      await persistAssignments(partResult.assignments)

      setTimeout(() => setMapTransitioning(false), 300)
      setResult(partResult)
    } catch (e) {
      console.error('[AdminPage] runAlgorithm error:', e)
    } finally {
      setAlgoRunning(false)
    }
  }, [ctx, zones, agents, runSA, setAlgoRunning, selectZone, setHighlightedSalesId, setMapTransitioning, persistAssignments])

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
      await ctx.facade.createVersion(label, zones, assignments)
      setSnapshots(ctx.facade.getVersionHistory())
    } catch (e) {
      console.error('[AdminPage] createVersion error:', e)
    }
  }, [ctx, zones, assignments])

  // ── Update activity ────────────────────────────────────────────────────────

  const handleUpdateActivity = useCallback((
    zoneId: string,
    data: { customers?: number; orders?: number },
  ) => {
    if (ctx.role !== 'admin') return
    try {
      const newZones = ctx.facade.updateZoneActivity(zoneId, zones, data)
      const updated = newZones.find((z) => z.id === zoneId)
      if (updated) updateZone(updated)  // awaited inside store
    } catch (e) {
      console.error('[AdminPage] updateActivity error:', e)
    }
  }, [ctx, zones, updateZone])

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

  // ── Delete zone ────────────────────────────────────────────────────────────

  const handleDeleteZone = useCallback(async (zoneId: string) => {
    selectZone(null)
    await removeZone(zoneId)  // awaits DB delete
  }, [selectZone, removeZone])

  const districtCount = new Set(assignments.map((a) => a.districtId)).size

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
          zones={zones}
          assignments={assignments}
          onCreateSnapshot={handleSnapshot}
          islandZoneIds={islandZoneIds}
          disconnectedDistrictIds={disconnectedDistrictIds}
          onFlyTo={handleFlyTo}
        />
      </div>

      {/* Map area */}
      <div style={styles.mapArea}>
        <TerritoryMap
          zones={displayZones}
          assignments={assignments}
          onZoneClick={selectZone}
          selectedZoneId={selectedZoneId}
          highlightedSalesId={highlightedSalesId}
          isTransitioning={isMapTransitioning}
          center={effectiveCenter}
          zoom={effectiveZoom}
          islandZoneIds={islandZoneIds}
          disconnectedDistrictIds={disconnectedDistrictIds}
        >
          <DrawingToolbar onZoneCreated={handleZoneCreated} existingZones={zones} />
        </TerritoryMap>
        <SnapshotManager />
        <ZoneInfoPanel
          zones={zones}
          assignments={assignments}
          districtCount={districtCount}
          onUpdateActivity={handleUpdateActivity}
          onDeleteZone={handleDeleteZone}
        />
      </div>

      <RightPanel
        result={result}
        onRun={handleRun}
        progress={progress}
        currentCost={currentCost}
        snapshots={snapshots}
        matrixData={matrixData}
        zones={zones}
        onRunSA={handleRunSA}
        report={reportData}
        assignments={assignments}
      />
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
}
