/**
 * AlgorithmComparator - side-by-side scenario runner with explicit data gates.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { useFacade } from '../../context/FacadeContext.js'
import TerritoryMap from '../map/TerritoryMap.js'
import type { Assignment, Zone } from '../../../facades/viewmodels.js'
import { buildAdjacencyMatrix, findPolygonTopologyViolations } from '../../../lib/geometry.js'

type Algo = 'greedy' | 'local-search' | 'sa'

function componentCount(zones: Zone[]): number {
  if (zones.length === 0) return 0
  const adj = buildAdjacencyMatrix(zones, 50)
  const ids = new Set(zones.map((z) => z.id))
  const visited = new Set<string>()
  let count = 0

  for (const zone of zones) {
    if (visited.has(zone.id)) continue
    count++
    const queue = [zone.id]
    visited.add(zone.id)
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]!
      for (const next of adj[current] ?? []) {
        if (ids.has(next) && !visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
  }

  return count
}

  export default function AlgorithmComparator() {
  const zones = useDataStore((s) => s.zones)
  const regions = useDataStore((s) => s.regions)
  const agents = useDataStore((s) => s.agents)
  const currentRegionId = useDataStore((s) => s.currentRegionId)
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)
  const persistAssignments = useDataStore((s) => s.persistAssignments)
  const ctx = useFacade()

  const [selectedRegionId, setSelectedRegionId] = useState(currentRegionId || regions[0]?.id || '')
  const [isRunning, setIsRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [syncViewport, setSyncViewport] = useState(true)
  const [error, setError] = useState<string | null>(null)

    const [algoA, setAlgoA] = useState<Algo>('greedy')
    const [algoB, setAlgoB] = useState<Algo>('sa')
    const [numDistrictsA, setNumDistrictsA] = useState(4)
    const [numDistrictsB, setNumDistrictsB] = useState(4)
    const [showScenarioB, setShowScenarioB] = useState(false)

  const [assignmentsA, setAssignmentsA] = useState<Assignment[]>([])
  const [assignmentsB, setAssignmentsB] = useState<Assignment[]>([])
  const [metricsA, setMetricsA] = useState<any>(null)
  const [metricsB, setMetricsB] = useState<any>(null)

  useEffect(() => {
    if (selectedRegionId) setCurrentRegion(selectedRegionId)
  }, [selectedRegionId, setCurrentRegion])

  const selectedRegion = regions.find((r) => r.id === selectedRegionId)
  const displayZones = useMemo(
    () => selectedRegionId ? zones.filter((z) => (z as any).regionId === selectedRegionId) : [],
    [zones, selectedRegionId],
  )
  const displayAgents = useMemo(
    () => selectedRegionId
      ? agents.filter((a) =>
        a.activeRegion === selectedRegionId
        || a.activeRegion === selectedRegion?.name
        || (a as any).regionId === selectedRegionId
        || (a as any).region_id === selectedRegionId,
      )
      : [],
    [agents, selectedRegionId, selectedRegion?.name],
  )

  const topologyViolations = useMemo(() => findPolygonTopologyViolations(displayZones), [displayZones])
  const components = useMemo(() => componentCount(displayZones), [displayZones])
  const blockers = [
    !selectedRegionId ? 'Chưa chọn khu vực.' : null,
    displayZones.length < 2 ? 'Khu vực cần ít nhất 2 zones.' : null,
    displayAgents.length < 2 ? 'Khu vực cần ít nhất 2 sales đang hoạt động.' : null,
    topologyViolations.length > 0 ? `Có ${topologyViolations.length} lỗi topology polygon.` : null,
    components > 1 ? `Đồ thị zone có ${components} cụm rời, không thể đảm bảo liên thông.` : null,
  ].filter((x): x is string => Boolean(x))

    const canRun = blockers.length === 0 && !isRunning && showScenarioB
  const center: [number, number] = selectedRegion
    ? [selectedRegion.center.lat, selectedRegion.center.lng]
    : [21.03, 105.83]
  const zoom = selectedRegion?.zoom ?? 12

  const runScenario = async (algo: Algo, m: number) =>
    ctx.facade.runAlgorithm(algo, displayZones, m, displayAgents)

    const handleRun = async () => {
      if (!canRun) return
      setError(null)
      setIsRunning(true)
      setHasRun(false)
      try {
        const [resultA, resultB] = await Promise.all([
          runScenario(algoA, numDistrictsA),
          runScenario(algoB, numDistrictsB),
        ])
      setAssignmentsA(resultA.assignments)
      setAssignmentsB(resultB.assignments)
      setMetricsA(resultA)
      setMetricsB(resultB)
      setHasRun(true)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setIsRunning(false)
      }
    }

  const handleApply = async (side: 'A' | 'B') => {
    const chosen = side === 'A' ? assignmentsA : assignmentsB
    await persistAssignments(chosen)
    alert(`Đã áp dụng kịch bản ${side}.`)
  }

  const recommendation = useMemo(() => {
    if (!metricsA || !metricsB) return null
    const scoreA = (metricsA.balanceScore ?? 0) - (metricsA.violationCount ?? 0) * 20
    const scoreB = (metricsB.balanceScore ?? 0) - (metricsB.violationCount ?? 0) * 20
    if (scoreA === scoreB) return 'Hai kịch bản tương đương theo balance và violation.'
    return scoreA > scoreB
      ? 'Ưu tiên kịch bản A: điểm cân bằng/violation tốt hơn.'
      : 'Ưu tiên kịch bản B: điểm cân bằng/violation tốt hơn.'
  }, [metricsA, metricsB])

  return (
    <div style={styles.container}>
        <section style={styles.header}>
          <div>
            <span style={styles.kicker}>Bước 5</span>
            <h1 style={styles.title}>So sánh thuật toán phân chia</h1>
            <p style={styles.subtitle}>
              Chọn một khu vực hợp lệ, cấu hình hai kịch bản, chạy song song và chỉ áp dụng sau khi xem metrics.
            </p>
          </div>
          <button style={{ ...styles.primaryBtn, opacity: canRun ? 1 : .55 }} disabled={!canRun} onClick={handleRun}>
            {isRunning ? 'Đang chạy...' : 'Chạy so sánh'}
          </button>
        </section>

      <section style={styles.gate}>
        <label style={styles.field}>
          <span>Khu vực</span>
          <select value={selectedRegionId} onChange={(e) => setSelectedRegionId(e.target.value)} style={styles.input}>
            <option value="">Chọn khu vực</option>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        </label>
        <DataChip label="Zones" value={displayZones.length} ok={displayZones.length >= 2} />
        <DataChip label="Sales" value={displayAgents.length} ok={displayAgents.length >= 2} />
        <DataChip label="Topology" value={topologyViolations.length} ok={topologyViolations.length === 0} />
        <DataChip label="Components" value={components} ok={components <= 1 && components > 0} />
        <label style={styles.checkbox}>
          <input type="checkbox" checked={syncViewport} onChange={(e) => setSyncViewport(e.target.checked)} />
          Đồng bộ góc nhìn bản đồ
        </label>
      </section>

      {blockers.length > 0 && (
        <section style={styles.blocker}>
          <strong>Chưa thể chạy thuật toán</strong>
          <ul style={styles.blockerList}>
            {blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </section>
      )}

        {error && <section style={styles.errorBox}>{error}</section>}

        <section style={styles.configGrid}>
          <ScenarioCard
            title="Kịch bản A"
            algo={algoA}
            setAlgo={setAlgoA}
            m={numDistrictsA}
            setM={setNumDistrictsA}
            accent="#2563eb"
            rightAction={
              showScenarioB
                ? null
                : (
                  <button
                    type="button"
                    onClick={() => { setShowScenarioB(true); setHasRun(false) }}
                    style={styles.addScenarioBtn}
                    title="Thêm thuật toán để so sánh"
                  >
                    +
                  </button>
                )
            }
          />
          {showScenarioB && (
            <ScenarioCard
              title="Kịch bản B"
              algo={algoB}
              setAlgo={setAlgoB}
              m={numDistrictsB}
              setM={setNumDistrictsB}
              accent="#059669"
              rightAction={
                <button
                  type="button"
                  onClick={() => { setShowScenarioB(false); setHasRun(false); setError(null) }}
                  style={styles.removeScenarioBtn}
                  title="Bỏ thuật toán B"
                >
                  ×
                </button>
              }
            />
          )}
        </section>

        {!hasRun ? (
          <section style={styles.emptyState}>
            <h2>Chưa có kết quả so sánh</h2>
            {!showScenarioB ? (
              <p>Hãy chọn 1 thuật toán trước, sau đó bấm dấu + để thêm thuật toán thứ hai để so sánh.</p>
            ) : (
              <p>Map và metrics chỉ xuất hiện sau khi dữ liệu khu vực đạt điều kiện và bạn bấm chạy.</p>
            )}
          </section>
        ) : (
          <>
            <section style={styles.resultGrid}>
              <ResultPanel title="Kết quả A" algo={algoA} zones={displayZones} assignments={assignmentsA} center={center} zoom={zoom} metrics={metricsA} onApply={() => handleApply('A')} />
              {showScenarioB && (
                <ResultPanel title="Kết quả B" algo={algoB} zones={displayZones} assignments={assignmentsB} center={center} zoom={zoom} metrics={metricsB} onApply={() => handleApply('B')} />
              )}
            </section>
            <section style={styles.recommendation}>
              <strong>Khuyến nghị:</strong> {recommendation}
            </section>
          </>
        )}
      </div>
    )
  }

function DataChip({ label, value, ok }: { label: string; value: number; ok: boolean }) {
  return (
    <div style={{ ...styles.chip, borderColor: ok ? '#bbf7d0' : '#fecaca', background: ok ? '#f0fdf4' : '#fef2f2' }}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

  function ScenarioCard({
    title, algo, setAlgo, m, setM, accent, rightAction,
  }: {
    title: string;
    algo: Algo;
    setAlgo: (v: Algo) => void;
    m: number;
    setM: (v: number) => void;
    accent: string;
    rightAction?: React.ReactNode;
  }) {
    return (
      <div style={styles.scenarioCard}>
        <div style={styles.scenarioHeaderRow}>
          <h2 style={{ ...styles.scenarioTitle, color: accent }}>{title}</h2>
          {rightAction}
        </div>
        <div style={styles.formRow}>
          <label style={styles.field}>
            <span>Thuật toán</span>
            <select value={algo} onChange={(e) => setAlgo(e.target.value as Algo)} style={styles.input}>
              <option value="greedy">Greedy Seed Expansion</option>
              <option value="local-search">Local Search Refinement</option>
              <option value="sa">Simulated Annealing</option>
            </select>
          </label>
          <label style={styles.field}>
            <span>Số cụm</span>
            <input type="number" min={2} max={30} value={m} onChange={(e) => setM(Number(e.target.value))} style={styles.input} />
          </label>
        </div>
      </div>
    )
  }

function ResultPanel({
  title, algo, zones, assignments, center, zoom, metrics, onApply,
}: {
  title: string; algo: Algo; zones: Zone[]; assignments: Assignment[]; center: [number, number]; zoom: number; metrics: any; onApply: () => void;
}) {
  return (
    <div style={styles.resultPanel}>
      <div style={styles.resultHeader}>
        <div>
          <h2 style={styles.resultTitle}>{title}</h2>
          <span style={styles.kicker}>{algo}</span>
        </div>
        <button style={styles.applyBtn} onClick={onApply}>Áp dụng</button>
      </div>
      <div style={styles.mapShell}>
        <TerritoryMap zones={zones} assignments={assignments} center={center} zoom={zoom} />
      </div>
      <div style={styles.metricGrid}>
        <Metric label="Balance" value={Math.round(metrics?.balanceScore ?? 0)} />
        <Metric label="Violations" value={metrics?.violationCount ?? 0} />
        <Metric label="Max diameter" value={Math.round(metrics?.maxDiameter ?? 0)} />
        <Metric label="Runtime ms" value={Math.round(metrics?.durationMs ?? 0)} />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

  const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  kicker: {
    color: 'var(--color-text-2)',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    margin: '4px 0 6px',
  },
  subtitle: {
    color: 'var(--color-text-2)',
    maxWidth: 720,
  },
  primaryBtn: {
    border: 0,
    borderRadius: 8,
    background: '#2563eb',
    color: '#fff',
    padding: '11px 16px',
    fontWeight: 850,
    cursor: 'pointer',
  },
  gate: {
    display: 'flex',
    gap: 10,
    alignItems: 'end',
    flexWrap: 'wrap',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    borderRadius: 8,
    padding: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text-2)',
  },
  input: {
    height: 38,
    width: '100%',
    minWidth: 0,
    border: '1px solid var(--color-border)',
    borderRadius: 7,
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    padding: '0 10px',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 38,
    color: 'var(--color-text-2)',
    fontWeight: 700,
  },
  chip: {
    minWidth: 92,
    height: 54,
    border: '1px solid',
    borderRadius: 8,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    color: '#0f172a',
  },
  blocker: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#7f1d1d',
    borderRadius: 8,
    padding: 14,
  },
  blockerList: {
    margin: '8px 0 0 18px',
  },
  errorBox: {
    border: '1px solid #fecaca',
    color: '#991b1b',
    background: '#fff1f2',
    borderRadius: 8,
    padding: 14,
    fontWeight: 700,
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 14,
  },
    scenarioCard: {
      border: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      borderRadius: 8,
      padding: 16,
    },
    scenarioHeaderRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 12,
    },
    scenarioTitle: {
      fontSize: 18,
      marginBottom: 0,
    },
    addScenarioBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      border: '1px solid rgba(37,99,235,0.35)',
      background: 'rgba(37,99,235,0.10)',
      color: '#2563eb',
      fontWeight: 900,
      cursor: 'pointer',
      lineHeight: '32px',
      textAlign: 'center',
      flex: '0 0 auto',
    },
    removeScenarioBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      border: '1px solid rgba(239,68,68,0.35)',
      background: 'rgba(239,68,68,0.10)',
      color: '#ef4444',
      fontWeight: 900,
      cursor: 'pointer',
      lineHeight: '32px',
      textAlign: 'center',
      flex: '0 0 auto',
    },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  emptyState: {
    minHeight: 260,
    border: '1px dashed var(--color-border)',
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    color: 'var(--color-text-2)',
    padding: 30,
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: 18,
  },
  resultPanel: {
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    background: 'var(--color-bg)',
    overflow: 'hidden',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottom: '1px solid var(--color-border)',
  },
  resultTitle: {
    fontSize: 18,
  },
  applyBtn: {
    border: 0,
    borderRadius: 7,
    background: '#111827',
    color: '#fff',
    padding: '8px 11px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  mapShell: {
    height: 380,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 1,
    background: 'var(--color-border)',
  },
  metric: {
    background: 'var(--color-surface)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  recommendation: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1e3a8a',
    borderRadius: 8,
    padding: 14,
  },
}
