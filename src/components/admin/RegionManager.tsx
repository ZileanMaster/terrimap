import React, { useCallback, useState } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { useUIStore } from '../../store/uiStore.js'

interface RegionManagerProps {
  onFlyTo?: ((lat: number, lng: number, zoom: number) => void) | undefined
}

export default function RegionManager({ onFlyTo }: RegionManagerProps) {
  const role = useUIStore((s) => s.role)
  const regions = useDataStore((s) => s.regions)
  const zones = useDataStore((s) => s.zones)
  const agents = useDataStore((s) => s.agents)
  const currentRegionId = useDataStore((s) => s.currentRegionId)
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)
  const updateRegion = useDataStore((s) => s.updateRegion)
  const deleteRegion = useDataStore((s) => s.deleteRegion)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const handleDeleteRegion = useCallback(async (regionId: string) => {
    const zoneCount = zones.filter((zone) => (zone as any).regionId === regionId).length
    if (zoneCount > 0) {
      alert(`Khu vực này còn ${zoneCount} vùng. Hãy chuyển toàn bộ vùng sang khu vực khác trước khi xóa.`)
      setConfirmDelete(null)
      return
    }
    await deleteRegion(regionId)
    setConfirmDelete(null)
  }, [deleteRegion, zones])

  const activeRegion = regions.find((region) => region.id === currentRegionId)

  return (
    <div style={styles.wrapper}>
      {regions.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🗺️</div>
          <div style={styles.emptyText}>Chưa có khu vực nào</div>
          <div style={styles.emptyHint}>
            {role === 'admin'
              ? 'Hãy dùng nút tạo khu vực ở góc trên bên phải để khởi tạo dữ liệu.'
              : 'Chờ quản trị viên tạo khu vực để bắt đầu làm việc.'}
          </div>
        </div>
      ) : (
        <div style={styles.pillBar}>
          {regions.map((region) => {
            const isActive = currentRegionId === region.id
            const zoneCount = zones.filter((zone) => (zone as any).regionId === region.id).length
            const isConfirming = confirmDelete === region.id

            return (
              <div key={region.id} style={styles.pillRow}>
                <button
                  style={{
                    ...styles.pill,
                    ...(isActive ? styles.pillActive : styles.pillInactive),
                  }}
                  onClick={() => {
                    const nextActive = !isActive
                    setCurrentRegion(nextActive ? region.id : null)
                    if (nextActive && region.center) {
                      onFlyTo?.(region.center.lat, region.center.lng, (region as any).zoom ?? 12)
                    }
                  }}
                  title={`${region.name} · ${zoneCount} vùng`}
                >
                  <span style={styles.pillName}>{region.name}</span>
                  <span
                    style={{
                      ...styles.pillBadge,
                      background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--color-surface)',
                    }}
                  >
                    {zoneCount}
                  </span>
                </button>

                {role === 'admin' && isConfirming ? (
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmText}>Xóa?</span>
                    <button style={styles.confirmYes} onClick={() => handleDeleteRegion(region.id)}>✓</button>
                    <button style={styles.confirmNo} onClick={() => setConfirmDelete(null)}>✕</button>
                  </div>
                ) : role === 'admin' ? (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => setConfirmDelete(region.id)}
                    title="Xóa khu vực"
                  >
                    🗑
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {activeRegion && role === 'admin' && (
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Điều phối:</span>
          <select
            value={activeRegion.coordinatorId ?? ''}
            onChange={(e) => {
              const coordinatorId = e.target.value || undefined
              updateRegion(
                coordinatorId === undefined
                  ? { ...activeRegion }
                  : { ...activeRegion, coordinatorId },
              )
            }}
            style={styles.select}
          >
            <option value="">— Chưa gán —</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyState: {
    padding: 16,
    borderRadius: 14,
    border: '1px dashed var(--color-border)',
    background: 'var(--color-surface-2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  emptyHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--color-text-2)',
  },
  pillBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  pillRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    border: '1px solid var(--color-border)',
    borderRadius: 999,
    minHeight: 42,
    padding: '0 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    cursor: 'pointer',
    fontWeight: 700,
  },
  pillActive: {
    background: 'var(--color-accent)',
    color: '#fff',
    borderColor: 'var(--color-accent)',
    boxShadow: '0 10px 24px rgba(37,99,235,0.18)',
  },
  pillInactive: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  },
  pillName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 15,
  },
  pillBadge: {
    minWidth: 32,
    height: 24,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    fontSize: 12,
    fontWeight: 800,
    color: 'inherit',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  confirmText: {
    fontSize: 11,
    color: 'var(--color-text-2)',
    fontWeight: 700,
  },
  confirmYes: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontWeight: 800,
  },
  confirmNo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    fontWeight: 800,
  },
  detailRow: {
    display: 'grid',
    gridTemplateColumns: '72px 1fr',
    gap: 10,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 12,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--color-text-2)',
  },
  select: {
    width: '100%',
    minHeight: 36,
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    padding: '0 10px',
    fontSize: 14,
  },
}
