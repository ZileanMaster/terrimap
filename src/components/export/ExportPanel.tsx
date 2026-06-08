/**
 * ExportPanel — Khối xuất dữ liệu có thể thu gọn (CSV, GeoJSON, PDF)
 * Chỉ dành cho admin. Đặt trong RightPanel bên dưới MatrixViewer.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Zone, Assignment, AdjMatrix, AlgorithmResultVM, ReportData } from '../../../facades/viewmodels.js'
import {
  exportAssignmentsCSV,
  exportZonesCSV,
  exportMatrixCSV,
  exportGeoJSON,
  printReport,
} from '../../utils/exportUtils.js'

interface ExportPanelProps {
  zones: Zone[]
  assignments: Assignment[]
  adj?: AdjMatrix | null
  report?: ReportData | null
  result?: AlgorithmResultVM | null
}

export default function ExportPanel({
  zones, assignments, adj, report, result,
}: ExportPanelProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div style={styles.wrapper}>
      <button
        style={styles.toggleBtn}
        onClick={() => setExpanded(!expanded)}
        data-testid="export-toggle"
      >
        {expanded ? '▾' : '▸'} 📥 {t('export.title')}
      </button>

      {expanded && (
        <div style={styles.content}>
          {/* CSV section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>CSV</div>
            <div style={styles.btnGroup}>
              <ExportButton
                label={t('export.csv_assignments')}
                icon="📋"
                testId="export-csv-assignments"
                onClick={() => exportAssignmentsCSV(zones, assignments)}
              />
              <ExportButton
                label={t('export.csv_zones')}
                icon="🗺️"
                testId="export-csv-zones"
                onClick={() => exportZonesCSV(zones)}
              />
              {adj && (
                <ExportButton
                  label={t('export.csv_matrix')}
                  icon="📐"
                  testId="export-csv-matrix"
                  onClick={() => exportMatrixCSV(adj)}
                />
              )}
            </div>
          </div>

          {/* GeoJSON */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>GeoJSON</div>
            <ExportButton
              label={t('export.geojson')}
              icon="🌐"
              testId="export-geojson"
              onClick={() => exportGeoJSON(zones, assignments)}
            />
          </div>

          {/* PDF Report */}
          {report && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Report</div>
              <ExportButton
                label={t('export.pdf_report')}
                icon="📄"
                testId="export-pdf"
                onClick={() => printReport(report, result)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExportButton({ label, icon, testId, onClick }: {
  label: string; icon: string; testId: string; onClick: () => void
}) {
  const [clicked, setClicked] = React.useState(false)

  function handleClick() {
    onClick()
    setClicked(true)
    setTimeout(() => setClicked(false), 1500)
  }

  return (
    <button
      style={{
        ...styles.exportBtn,
        borderColor: clicked ? 'var(--color-success)' : 'var(--color-border)',
        color: clicked ? 'var(--color-success)' : 'var(--color-text)',
      }}
      onClick={handleClick}
      data-testid={testId}
    >
      {clicked ? '✓' : icon} {label}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  toggleBtn: {
    width: '100%',
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text)',
    textAlign: 'left' as const,
  },
  content: {
    padding: '0 14px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--color-text-3)',
  },
  btnGroup: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  exportBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--color-text)',
    transition: 'border-color 0.2s, color 0.2s',
    whiteSpace: 'nowrap' as const,
  },
}
