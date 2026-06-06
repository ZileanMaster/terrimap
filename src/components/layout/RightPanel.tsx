/**
 * RightPanel — Algorithm controls + Version History
 * Chỉ hiển thị với role admin hoặc coordinator.
 * Chứa: AlgorithmSelector + ConstraintConfig + ProgressBar + ResultMetrics
 * Admin: + VersionHistory
 */

import React from 'react'
import { useUIStore } from '../../store/uiStore.js'
import AlgorithmSelector from '../algorithm/AlgorithmSelector.js'
import ConstraintConfigPanel from '../algorithm/ConstraintConfig.js'
import ProgressBar from '../algorithm/ProgressBar.js'
import ResultMetrics from '../algorithm/ResultMetrics.js'
import VersionHistory from '../version/VersionHistory.js'
import MatrixViewer from '../map/MatrixViewer.js'
import ExportPanel from '../export/ExportPanel.js'
import type { AlgorithmResultVM, Assignment, Snapshot, Zone, AdjMatrix, DistMatrix, ReportData } from '../../../facades/viewmodels.js'

interface RightPanelProps {
  result:        AlgorithmResultVM | null
  onRun:         (algo: 'greedy' | 'local-search' | 'sa', m: number) => void
  progress:      number
  currentCost:   number | null
  snapshots?:    Snapshot[]
  matrixData?:   { adj: AdjMatrix; dist: DistMatrix } | null
  zones?:        Zone[]
  report?:       ReportData | null   // L4b-5: export report data
  assignments?:  Assignment[]        // L4b-5: for export panel
}

export default function RightPanel({
  result, onRun, progress, currentCost, snapshots = [], matrixData, zones,
  report, assignments,
}: RightPanelProps) {
  const role               = useUIStore((s) => s.role)
  const isRunning          = useUIStore((s) => s.isAlgorithmRunning)
  const [algo, setAlgo]    = React.useState<'greedy'|'local-search'|'sa'>('local-search')
  const [m, setM]          = React.useState(4)

  if (role === 'sales') return null

  return (
    <aside style={styles.panel}>
      <div style={styles.header}>
        <span>⚙️</span>
        <span style={styles.title}>Thuật toán</span>
      </div>

      <div style={styles.body}>
        <AlgorithmSelector value={algo} onChange={setAlgo} disabled={isRunning} />

        <div style={styles.district}>
          <label style={styles.label}>Số cụm</label>
          <div style={styles.stepper}>
            <button
              style={styles.stepBtn}
              onClick={() => setM((v) => Math.max(2, v - 1))}
              disabled={isRunning || m <= 2}
            >−</button>
            <span style={styles.stepVal}>{m}</span>
            <button
              style={styles.stepBtn}
              onClick={() => setM((v) => Math.min(10, v + 1))}
              disabled={isRunning || m >= 10}
            >+</button>
          </div>
        </div>

        <ConstraintConfigPanel />

        <button
          id="btn-run-algorithm"
          data-testid="run-algorithm"
          style={{
            ...styles.runBtn,
            opacity: isRunning ? 0.7 : 1,
            cursor: isRunning ? 'not-allowed' : 'pointer',
          }}
          onClick={() => !isRunning && onRun(algo, m)}
          disabled={isRunning}
        >
          {isRunning ? '⏳ Đang chạy...' : '▶ Chạy phân chia'}
        </button>

        {isRunning && (
          <div data-testid="progress-bar">
            <ProgressBar isRunning={isRunning} progress={progress} currentCost={currentCost} />
          </div>
        )}

        {result && !isRunning && (
          <div data-testid="result-metrics">
            <ResultMetrics result={result} />
          </div>
        )}

        {/* Version History — Admin only */}
        {role === 'admin' && (
          <VersionHistory snapshots={snapshots} />
        )}

        {/* Matrix Viewer — Admin only */}
        {role === 'admin' && matrixData && zones && zones.length > 0 && (
          <MatrixViewer zones={zones} adj={matrixData.adj} dist={matrixData.dist} />
        )}

        {/* Export Panel — Admin only */}
        {role === 'admin' && (
          <ExportPanel
            zones={zones ?? []}
            assignments={assignments ?? result?.assignments ?? []}
            adj={matrixData?.adj}
            report={report}
            result={result}
          />
        )}
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 'var(--rpanel-w)',
    background: 'var(--color-surface)',
    borderLeft: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: '100%',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 16px',
    borderBottom: '1px solid var(--color-border)',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  body: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  district: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: 'var(--color-text-2)',
    fontWeight: 500,
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    border: '1px solid var(--color-border)',
  },
  stepBtn: {
    width: 24, height: 24,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 16,
    color: 'var(--color-accent)',
    fontWeight: 700,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text)',
    minWidth: 20,
    textAlign: 'center' as const,
  },
  runBtn: {
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    letterSpacing: '0.01em',
    boxShadow: '0 2px 8px rgba(37,99,235,.35)',
  },
}
