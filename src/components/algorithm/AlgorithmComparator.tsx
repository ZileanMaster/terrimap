/**
 * AlgorithmComparator.tsx — Side-by-side comparative territory mapping
 * 
 * Flow:
 * 1. User configures parameters for Run A and Run B.
 * 2. User clicks "Chạy song song".
 * 3. Shows Map A (Run A) and Map B (Run B) side-by-side.
 * 4. Comparative metrics card deck is rendered below the maps.
 * 5. Sync Viewport option maintains identical map zoom & center.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useDataStore } from '../../store/dataStore.js';
import { useFacade } from '../../context/FacadeContext.js';
import TerritoryMap from '../map/TerritoryMap.js';
import type { Zone, Assignment } from '../../../facades/viewmodels.js';

export default function AlgorithmComparator() {
  const zones = useDataStore((s) => s.zones);
  const assignments = useDataStore((s) => s.assignments);
  const regions = useDataStore((s) => s.regions);
  const agents = useDataStore((s) => s.agents);
  const currentRegionId = useDataStore((s) => s.currentRegionId);
  const ctx = useFacade();

  // States
  const [selectedRegionId, setSelectedRegionId] = useState<string>(currentRegionId || '');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasRun, setHasRun] = useState<boolean>(false);
  const [syncViewport, setSyncViewport] = useState<boolean>(true);

  // Real algorithm result states
  const [realAssignmentsA, setRealAssignmentsA] = useState<Assignment[]>([]);
  const [realAssignmentsB, setRealAssignmentsB] = useState<Assignment[]>([]);
  const [metricsA, setMetricsA] = useState<any>(null);
  const [metricsB, setMetricsB] = useState<any>(null);

  // Run A Configuration
  const [algoA, setAlgoA] = useState<string>('greedy');
  const [numDistrictsA, setNumDistrictsA] = useState<number>(4);

  // Run B Configuration
  const [algoB, setAlgoB] = useState<string>('sa');
  const [numDistrictsB, setNumDistrictsB] = useState<number>(4);

  // Map viewport center and zoom states to keep them synced when active
  const selectedRegion = useMemo(() => {
    return regions.find((r) => r.id === selectedRegionId);
  }, [regions, selectedRegionId]);

  const defaultCenter: [number, number] = selectedRegion
    ? [selectedRegion.center.lat, selectedRegion.center.lng]
    : [21.03, 105.83];
  const defaultZoom = selectedRegion?.zoom ?? 12;

  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [mapZoom, setMapZoom] = useState<number>(defaultZoom);

  // Update map viewport when region selection changes
  useEffect(() => {
    if (selectedRegion) {
      setMapCenter([selectedRegion.center.lat, selectedRegion.center.lng]);
      setMapZoom(selectedRegion.zoom);
    }
  }, [selectedRegion]);

  // Sync selectedRegionId with global store when component mounts or changes
  useEffect(() => {
    if (selectedRegionId) {
      useDataStore.getState().setCurrentRegion(selectedRegionId);
    }
  }, [selectedRegionId]);

  // Filter zones by region
  const displayZones = useMemo(() => {
    if (!selectedRegionId) return zones;
    return zones.filter((z) => (z as any).regionId === selectedRegionId);
  }, [zones, selectedRegionId]);

  // Filter agents by region
  const displayAgents = useMemo(() => {
    if (!selectedRegionId) return agents;
    return agents.filter((a) => (a as any).region_id === selectedRegionId || (a as any).regionId === selectedRegionId);
  }, [agents, selectedRegionId]);

  const handleRunAlgorithms = async () => {
    if (!selectedRegionId) {
      alert('Vui lòng chọn khu vực trước khi chạy thuật toán.');
      return;
    }
    if (displayZones.length < 2) {
      alert('Khu vực này chưa có đủ zones (cần ít nhất 2 zones) để chạy thuật toán.');
      return;
    }

    setIsRunning(true);
    setHasRun(false);

    try {
      // Execute Scenario A
      const resA = await ctx.facade.runAlgorithm(
        algoA as any,
        displayZones,
        numDistrictsA,
        displayAgents
      );

      // Execute Scenario B
      const resB = await ctx.facade.runAlgorithm(
        algoB as any,
        displayZones,
        numDistrictsB,
        displayAgents
      );

      setRealAssignmentsA(resA.assignments);
      setRealAssignmentsB(resB.assignments);
      setMetricsA(resA);
      setMetricsB(resB);
      setHasRun(true);
    } catch (e: any) {
      console.error('[AlgorithmComparator] run error:', e);
      alert(`❌ Lỗi khi chạy thuật toán: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplyResult = async (side: 'A' | 'B') => {
    const chosenAssignments = side === 'A' ? realAssignmentsA : realAssignmentsB;
    const chosenAlgoName = side === 'A' ? algoA : algoB;
    try {
      await useDataStore.getState().persistAssignments(chosenAssignments);
      alert(`✅ Đã chọn và áp dụng phương án phân vùng của Thuật toán ${chosenAlgoName.toUpperCase()}!`);
    } catch (e: any) {
      alert(`❌ Lỗi áp dụng phân vùng: ${e.message}`);
    }
  };

  // Dynamic evaluation helper variables
  const balanceScoreA = metricsA?.balanceScore ?? 0;
  const balanceScoreB = metricsB?.balanceScore ?? 0;
  const balanceEval = balanceScoreA > balanceScoreB
    ? '🟢 Kịch bản A tốt hơn (Cân bằng hơn)'
    : balanceScoreB > balanceScoreA
      ? '🟢 Kịch bản B tốt hơn (Cân bằng hơn)'
      : '🤝 Ngang bằng nhau';

  const diamA = metricsA?.maxDiameter ?? 0;
  const diamB = metricsB?.maxDiameter ?? 0;
  const diamEval = diamA < diamB
    ? '🟢 Kịch bản A tốt hơn (Gom gọn hơn)'
    : diamB < diamA
      ? '🟢 Kịch bản B tốt hơn (Gom gọn hơn)'
      : '🤝 Ngang bằng nhau';

  const violationsA = metricsA?.violations?.filter((v: any) => v.type === 'CONTIGUITY').length ?? 0;
  const violationsB = metricsB?.violations?.filter((v: any) => v.type === 'CONTIGUITY').length ?? 0;
  const contigEval = violationsA < violationsB
    ? '🟢 Kịch bản A tốt hơn (Ít vi phạm liên thông hơn)'
    : violationsB < violationsA
      ? '🟢 Kịch bản B tốt hơn (Ít vi phạm liên thông hơn)'
      : '🤝 Ngang bằng nhau';

  const durationA = metricsA?.durationMs ?? 0;
  const durationB = metricsB?.durationMs ?? 0;
  const durationEval = durationA < durationB
    ? '🟢 Kịch bản A nhanh hơn'
    : durationB < durationA
      ? '🟢 Kịch bản B nhanh hơn'
      : '🤝 Ngang bằng nhau';

  return (
    <div style={styles.container}>
      {/* ── Top Header and Configuration ───────────────────────────────────── */}
      <div style={styles.configHeader}>
        <div style={styles.regionSelectWrapper}>
          <label style={styles.label}>📍 Chọn khu vực phân chia:</label>
          <select
            value={selectedRegionId}
            onChange={(e) => setSelectedRegionId(e.target.value)}
            style={styles.select}
          >
            <option value="" disabled>-- Chọn khu vực --</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div style={styles.actions}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={syncViewport}
              onChange={(e) => setSyncViewport(e.target.checked)}
            />
             Đồng bộ góc nhìn bản đồ (Sync Pan/Zoom)
          </label>
          <button
            onClick={handleRunAlgorithms}
            disabled={isRunning || !selectedRegionId}
            style={{
              ...styles.runButton,
              opacity: isRunning || !selectedRegionId ? 0.6 : 1,
            }}
          >
            {isRunning ? '⏳ Đang phân tích...' : '⚡ Chạy so sánh song song'}
          </button>
        </div>
      </div>

      {/* ── Parameters Form ────────────────────────────────────────────────── */}
      <div style={styles.formsContainer}>
        {/* Config A */}
        <div style={styles.formCard}>
          <h4 style={{ ...styles.cardTitle, color: 'var(--c-primary-400, #60a5fa)' }}>Kịch bản A (Bản đồ trái)</h4>
          <div style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.fieldLabel}>Thuật toán:</label>
              <select value={algoA} onChange={(e) => setAlgoA(e.target.value)} style={styles.fieldSelect}>
                <option value="greedy">Greedy Seed Expansion</option>
                <option value="local-search">Local Search Refinement</option>
                <option value="sa">Simulated Annealing (SA)</option>
              </select>
            </div>
            <div style={styles.formField}>
              <label style={styles.fieldLabel}>Số cụm (m):</label>
              <input
                type="number"
                min={2}
                max={10}
                value={numDistrictsA}
                onChange={(e) => setNumDistrictsA(Number(e.target.value))}
                style={styles.fieldInput}
              />
            </div>
          </div>
        </div>

        {/* Config B */}
        <div style={styles.formCard}>
          <h4 style={{ ...styles.cardTitle, color: 'var(--color-success, #2dd4a0)' }}>Kịch bản B (Bản đồ phải)</h4>
          <div style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.fieldLabel}>Thuật toán:</label>
              <select value={algoB} onChange={(e) => setAlgoB(e.target.value)} style={styles.fieldSelect}>
                <option value="greedy">Greedy Seed Expansion</option>
                <option value="local-search">Local Search Refinement</option>
                <option value="sa">Simulated Annealing (SA)</option>
              </select>
            </div>
            <div style={styles.formField}>
              <label style={styles.fieldLabel}>Số cụm (m):</label>
              <input
                type="number"
                min={2}
                max={10}
                value={numDistrictsB}
                onChange={(e) => setNumDistrictsB(Number(e.target.value))}
                style={styles.fieldInput}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Side-by-Side Map Canvas ────────────────────────────────────────── */}
      <div style={styles.mapsContainer}>
        {/* Left Map View */}
        <div style={styles.mapColumn}>
          <div style={styles.mapLabelBar}>
            <span>🗺️ Kết quả Kịch bản A ({algoA.toUpperCase()})</span>
            {hasRun && (
              <button onClick={() => handleApplyResult('A')} style={styles.applyBtn}>
                ✓ Áp dụng phương án A
              </button>
            )}
          </div>
          <div style={styles.mapBox}>
            <TerritoryMap
              zones={displayZones}
              assignments={hasRun ? realAssignmentsA : []}
              center={mapCenter}
              zoom={mapZoom}
            />
          </div>
        </div>

        {/* Right Map View */}
        <div style={styles.mapColumn}>
          <div style={styles.mapLabelBar}>
            <span>🗺️ Kết quả Kịch bản B ({algoB.toUpperCase()})</span>
            {hasRun && (
              <button onClick={() => handleApplyResult('B')} style={{ ...styles.applyBtn, backgroundColor: 'var(--color-success, #16a34a)' }}>
                ✓ Áp dụng phương án B
              </button>
            )}
          </div>
          <div style={styles.mapBox}>
            <TerritoryMap
              zones={displayZones}
              assignments={hasRun ? realAssignmentsB : []}
              center={mapCenter}
              zoom={mapZoom}
            />
          </div>
        </div>
      </div>

      {/* ── Comparison Metrics Deck ───────────────────────────────────────── */}
      {hasRun && (
        <div style={styles.metricsCompareDeck}>
          <h4 style={styles.compareTitle}>📊 Bảng So Sánh Chỉ Số Kỹ Thuật</h4>
          <table style={styles.compareTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableTh}>Chỉ số so sánh</th>
                <th style={styles.tableTh}>Kịch bản A ({algoA.toUpperCase()})</th>
                <th style={styles.tableTh}>Kịch bản B ({algoB.toUpperCase()})</th>
                <th style={styles.tableTh}>Đánh giá phương án tốt hơn</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.tableTd}><strong>Chỉ số cân bằng tải (Workload Balance Score)</strong></td>
                <td style={styles.tableTd}>{balanceScoreA.toFixed(1)} / 100</td>
                <td style={styles.tableTd}>{balanceScoreB.toFixed(1)} / 100</td>
                <td style={{ ...styles.tableTd, color: balanceEval.includes('ngang bằng') ? 'inherit' : 'var(--color-success, #2dd4a0)', fontWeight: 'bold' }}>
                  {balanceEval}
                </td>
              </tr>
              <tr>
                <td style={styles.tableTd}><strong>Đường kính cụm tối đa (Max Diameter / Compactness)</strong></td>
                <td style={styles.tableTd}>{diamA.toFixed(1)} km</td>
                <td style={styles.tableTd}>{diamB.toFixed(1)} km</td>
                <td style={{ ...styles.tableTd, color: diamEval.includes('ngang bằng') ? 'inherit' : 'var(--color-success, #2dd4a0)', fontWeight: 'bold' }}>
                  {diamEval}
                </td>
              </tr>
              <tr>
                <td style={styles.tableTd}><strong>Vi phạm liên thông (Contiguity Violations)</strong></td>
                <td style={styles.tableTd}>{violationsA} vi phạm</td>
                <td style={styles.tableTd}>{violationsB} vi phạm</td>
                <td style={{ ...styles.tableTd, color: contigEval.includes('ngang bằng') ? 'inherit' : 'var(--color-success, #2dd4a0)', fontWeight: 'bold' }}>
                  {contigEval}
                </td>
              </tr>
              <tr>
                <td style={styles.tableTd}><strong>Thời gian chạy thuật toán (Execution Time)</strong></td>
                <td style={styles.tableTd}>{durationA.toFixed(1)} ms</td>
                <td style={styles.tableTd}>{durationB.toFixed(1)} ms</td>
                <td style={{ ...styles.tableTd, color: durationEval.includes('ngang bằng') ? 'inherit' : 'var(--color-success, #2dd4a0)', fontWeight: 'bold' }}>
                  {durationEval}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
    overflowY: 'auto',
  },
  configHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '10px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  regionSelectWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--color-text)',
  },
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-2, #1f2937)',
    border: '1px solid var(--color-border, #30363d)',
    color: 'var(--color-text)',
    fontSize: '13px',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  checkboxLabel: {
    fontSize: '13px',
    color: 'var(--color-text-2)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  runButton: {
    padding: '8px 18px',
    backgroundColor: 'var(--color-accent, #1f6feb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(31, 111, 235, 0.3)',
  },
  formsContainer: {
    display: 'flex',
    gap: '20px',
  },
  formCard: {
    flex: 1,
    padding: '16px',
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '10px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '12px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  formField: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '12px',
    color: 'var(--color-text-2)',
  },
  fieldSelect: {
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-2, #1f2937)',
    border: '1px solid var(--color-border, #30363d)',
    color: 'var(--color-text)',
    fontSize: '12px',
    outline: 'none',
  },
  fieldInput: {
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-2, #1f2937)',
    border: '1px solid var(--color-border, #30363d)',
    color: 'var(--color-text)',
    fontSize: '12px',
    outline: 'none',
  },
  mapsContainer: {
    display: 'flex',
    gap: '20px',
    height: '450px',
    minHeight: '400px',
  },
  mapColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: 'var(--color-surface, #161b22)',
  },
  mapLabelBar: {
    height: '40px',
    backgroundColor: 'var(--color-surface-2, #1f2937)',
    borderBottom: '1px solid var(--color-border, #30363d)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--color-text)',
  },
  applyBtn: {
    padding: '4px 10px',
    backgroundColor: 'var(--color-accent, #1f6feb)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  mapBox: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  metricsCompareDeck: {
    padding: '16px',
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  compareTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--color-text)',
  },
  compareTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  tableHeaderRow: {
    borderBottom: '2px solid var(--color-border, #30363d)',
  },
  tableTh: {
    padding: '10px',
    fontWeight: 'bold',
    color: 'var(--color-text-2)',
  },
  tableTd: {
    padding: '12px 10px',
    borderBottom: '1px solid var(--color-border, #30363d)',
    color: 'var(--color-text)',
  },
};
