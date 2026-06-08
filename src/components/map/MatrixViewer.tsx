/**
 * MatrixViewer — Trình xem bảng ma trận kề và ma trận khoảng cách
 *
 * Panel có thể thu gọn với hai tab: adjacency (✓/·) và distance (bản đồ nhiệt km).
 * Xử lý tràn khi số zone lớn (>12) bằng thanh cuộn ngang.
 * Chỉ dành cho admin — render trong RightPanel.
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Zone, AdjMatrix, DistMatrix } from '../../../facades/viewmodels.js'

interface MatrixViewerProps {
  zones: Zone[]
  adj:   AdjMatrix
  dist:  DistMatrix
}

type TabType = 'adj' | 'dist'

/** Truncate zone name for table header (max 4 chars). */
function shortName(name: string): string {
  return name.length <= 4 ? name : name.slice(0, 4)
}

/** Color gradient for distance cells. */
function distColor(km: number): string {
  if (km <= 0) return 'transparent'
  if (km < 5)  return 'rgba(34, 197, 94, 0.25)'   // green
  if (km < 15) return 'rgba(234, 179, 8, 0.2)'     // yellow
  if (km < 30) return 'rgba(249, 115, 22, 0.2)'    // orange
  return 'rgba(239, 68, 68, 0.2)'                   // red
}

export default function MatrixViewer({ zones, adj, dist }: MatrixViewerProps) {
  const { t } = useTranslation()
  const [open, setOpen]     = useState(false)
  const [tab, setTab]       = useState<TabType>('adj')

  if (zones.length === 0) return null

  return (
    <div style={styles.wrapper} data-testid="matrix-viewer">
      {/* Collapsible header */}
      <button
        style={styles.header}
        onClick={() => setOpen((p) => !p)}
        data-testid="matrix-toggle"
      >
        <span>📐 {t('matrix.title')}</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={styles.body}>
          {/* Tabs */}
          <div style={styles.tabRow}>
            <TabBtn
              label={t('matrix.tab_adj')}
              active={tab === 'adj'}
              onClick={() => setTab('adj')}
              testId="matrix-tab-adj"
            />
            <TabBtn
              label={t('matrix.tab_dist')}
              active={tab === 'dist'}
              onClick={() => setTab('dist')}
              testId="matrix-tab-dist"
            />
          </div>

          {/* Table */}
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, ...styles.stickyCol }} />
                  {zones.map((z) => (
                    <th key={z.id} style={styles.th} title={z.name}>
                      {shortName(z.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map((rowZone) => (
                  <tr key={rowZone.id}>
                    <td style={{ ...styles.td, ...styles.stickyCol, fontWeight: 600 }} title={rowZone.name}>
                      {shortName(rowZone.name)}
                    </td>
                    {zones.map((colZone) => {
                      const isDiag = rowZone.id === colZone.id

                      if (tab === 'adj') {
                        const isAdj = (adj[rowZone.id] ?? []).includes(colZone.id)
                        return (
                          <td
                            key={colZone.id}
                            style={{
                              ...styles.td,
                              background: isDiag ? 'var(--color-surface)' : isAdj ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                              color: isDiag ? 'var(--color-text-3)' : isAdj ? '#16a34a' : 'var(--color-text-3)',
                              fontWeight: isAdj ? 700 : 400,
                            }}
                            title={isDiag ? rowZone.name : `${rowZone.name} ↔ ${colZone.name}: ${isAdj ? 'kề' : 'không kề'}`}
                            data-testid={`matrix-cell-${rowZone.id}-${colZone.id}`}
                          >
                            {isDiag ? '—' : isAdj ? '✓' : '·'}
                          </td>
                        )
                      }

                      // Distance tab
                      const km = dist[rowZone.id]?.[colZone.id] ?? 0
                      return (
                        <td
                          key={colZone.id}
                          style={{
                            ...styles.td,
                            background: isDiag ? 'var(--color-surface)' : distColor(km),
                            color: isDiag ? 'var(--color-text-3)' : 'var(--color-text)',
                          }}
                          title={isDiag ? rowZone.name : `${rowZone.name} → ${colZone.name}: ${km.toFixed(1)} km`}
                          data-testid={`matrix-cell-${rowZone.id}-${colZone.id}`}
                        >
                          {isDiag ? '0' : km.toFixed(1)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ label, active, onClick, testId }: {
  label: string; active: boolean; onClick: () => void; testId: string;
}) {
  return (
    <button
      style={{
        ...styles.tabBtn,
        borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-3)',
        fontWeight: active ? 700 : 500,
      }}
      onClick={onClick}
      data-testid={testId}
    >
      {label}
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--color-text-3)',
  },
  body: {
    padding: '0 14px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  tabRow: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--color-border)',
  },
  tabBtn: {
    flex: 1,
    padding: '6px 8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    transition: 'color 0.15s',
  },
  tableWrap: {
    overflowX: 'auto' as const,
    maxHeight: 340,
    overflowY: 'auto' as const,
  },
  table: {
    borderCollapse: 'collapse' as const,
    fontSize: 10,
    width: '100%',
    minWidth: 'fit-content',
  },
  th: {
    padding: '4px 6px',
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--color-text-3)',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid var(--color-border)',
  },
  td: {
    padding: '3px 5px',
    textAlign: 'center' as const,
    fontSize: 10,
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap' as const,
  },
  stickyCol: {
    position: 'sticky' as const,
    left: 0,
    background: 'var(--color-surface-2)',
    zIndex: 1,
    textAlign: 'left' as const,
    minWidth: 40,
  },
}
