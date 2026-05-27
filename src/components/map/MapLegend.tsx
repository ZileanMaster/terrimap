import React, { useMemo } from 'react'
import type { Assignment } from '../../../facades/viewmodels.js'
import { getDistrictFillColor } from '../../data/district-colors.js'
import { useUIStore } from '../../store/uiStore.js'

interface MapLegendProps {
  assignments: Assignment[]
  disconnectedDistrictIds?: Set<number>
}

export default function MapLegend({ assignments, disconnectedDistrictIds }: MapLegendProps) {
  const selectedDistrictId = useUIStore((s) => s.selectedDistrictId)
  const setSelectedDistrictId = useUIStore((s) => s.setSelectedDistrictId)
  const showPolygons = useUIStore((s) => s.showPolygons)
  const togglePolygons = useUIStore((s) => s.togglePolygons)

  const clusters = useMemo(() => {
    return [...new Set(assignments.map((a) => a.districtId))]
      .sort((a, b) => a - b)
      .slice(0, 8)
  }, [assignments])

  if (assignments.length === 0) return null

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Chú giải</div>
        <button type="button" style={styles.toggleBtn} onClick={togglePolygons}>
          {showPolygons ? 'Ẩn polygon' : 'Hiện polygon'}
        </button>
      </div>
      <div style={styles.items}>
        {clusters.map((id) => {
          const disconnected = disconnectedDistrictIds?.has(id) ?? false
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedDistrictId(id)}
              style={{
                ...styles.itemBtn,
                ...(selectedDistrictId === id ? styles.itemBtnActive : null),
              }}
              title={`Chọn để tập trung cụm ${id}`}
            >
              <span
                style={{
                  ...styles.swatch,
                  background: getDistrictFillColor(id),
                  outline: disconnected ? '2px dashed #dc2626' : 'none',
                }}
              />
              <span style={styles.label}>Cụm {id}</span>
              <span style={styles.rightHint}>{selectedDistrictId === id ? 'Đang chọn' : ''}</span>
            </button>
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text)',
    marginBottom: 0,
  },
  toggleBtn: {
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-2)',
    fontSize: 12,
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  itemBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    width: '100%',
    border: '1px solid transparent',
    background: 'transparent',
    padding: '6px 6px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  itemBtnActive: {
    border: '1px solid rgba(37, 99, 235, 0.45)',
    background: 'rgba(37, 99, 235, 0.08)',
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
  rightHint: {
    marginLeft: 'auto',
    fontSize: 11,
    color: 'var(--color-text-3)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
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
