import React, { useMemo } from 'react'
import type { Assignment } from '../../../facades/viewmodels.js'
import { getDistrictFillColor } from '../../data/district-colors.js'

interface MapLegendProps {
  assignments: Assignment[]
  disconnectedDistrictIds?: Set<number>
}

export default function MapLegend({ assignments, disconnectedDistrictIds }: MapLegendProps) {
  const clusters = useMemo(() => {
    return [...new Set(assignments.map((a) => a.districtId))]
      .sort((a, b) => a - b)
      .slice(0, 8)
  }, [assignments])

  if (assignments.length === 0) return null

  return (
    <div style={styles.container}>
      <div style={styles.title}>Chú giải</div>
      <div style={styles.items}>
        {clusters.map((id) => {
          const disconnected = disconnectedDistrictIds?.has(id) ?? false
          return (
            <div key={id} style={styles.item}>
              <span
                style={{
                  ...styles.swatch,
                  background: getDistrictFillColor(id),
                  outline: disconnected ? '2px dashed #dc2626' : 'none',
                }}
              />
              <span style={styles.label}>Cụm {id}</span>
            </div>
          )
        })}
        {assignments.length > 0 && (
          <div style={styles.item}>
            <span style={{ ...styles.swatch, background: '#9ca3af', borderStyle: 'dashed' }} />
            <span style={styles.label}>Chưa gán</span>
          </div>
        )}
        {(disconnectedDistrictIds?.size ?? 0) > 0 && (
          <div style={styles.warning}>Cụm viền đỏ đang mất liên thông</div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    zIndex: 800,
    width: 190,
    maxWidth: 'calc(100vw - 32px)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
    padding: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text)',
    marginBottom: 8,
  },
  items: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '1px solid rgba(15, 23, 42, 0.25)',
    flexShrink: 0,
  },
  label: {
    fontSize: 12,
    color: 'var(--color-text-2)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  warning: {
    marginTop: 4,
    borderTop: '1px solid var(--color-border)',
    paddingTop: 6,
    color: '#b91c1c',
    fontSize: 11,
    lineHeight: 1.35,
  },
}
