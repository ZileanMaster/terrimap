import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { useDataStore } from '../../store/dataStore.js'
import { useUIStore } from '../../store/uiStore.js'
import type { ProjectMember } from '../../store/authStore.js'

interface RegionManagerProps {
  onFlyTo?: ((lat: number, lng: number, zoom: number) => void) | undefined
  assignments?: Array<{ zoneId: string; districtId: number }> | undefined
}

export default function RegionManager({ onFlyTo, assignments = [] }: RegionManagerProps) {
  const role = useUIStore((s) => s.role)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const loadMembers = useAuthStore((s) => s.loadMembers)
  const regions = useDataStore((s) => s.regions)
  const zones = useDataStore((s) => s.zones)
  const currentRegionId = useDataStore((s) => s.currentRegionId)
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)
  const updateRegion = useDataStore((s) => s.updateRegion)
  const deleteRegion = useDataStore((s) => s.deleteRegion)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    if (!currentProjectId) {
      setMembers([])
      return
    }

    loadMembers(true)
      .then((rows) => {
        if (!mounted) return
        setMembers(rows)
      })
      .catch(() => {
        if (mounted) setMembers([])
      })

    return () => {
      mounted = false
    }
  }, [currentProjectId, loadMembers])

  const coordinatorMembers = useMemo(
    () => members.filter((member) => member.role === 'coordinator' && member.status !== 'blocked'),
    [members],
  )

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
  const visibleRegions = regions.filter((region) => {
    const regionZoneIds = new Set(
      zones
        .filter((zone) => (zone as any).regionId === region.id)
        .map((zone) => zone.id),
    )
    if (regionZoneIds.size === 0) return false

    const districtCount = new Set(
      assignments
        .filter((assignment) => regionZoneIds.has(assignment.zoneId))
        .map((assignment) => assignment.districtId),
    ).size

    return districtCount > 0
  })

  return (
    <div style={styles.wrapper}>
      {visibleRegions.length === 0 ? (
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
          {visibleRegions.map((region) => {
            const isActive = currentRegionId === region.id
            const zoneCount = zones.filter((zone) => (zone as any).regionId === region.id).length
            const districtCount = new Set(
              assignments
                .filter((assignment) =>
                  zones.some(
                    (zone) =>
                      zone.id === assignment.zoneId
                      && (zone as any).regionId === region.id,
                  ),
                )
                .map((assignment) => assignment.districtId),
            ).size
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
                  title={`${region.name} · ${zoneCount} vùng · ${districtCount} cụm`}
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
            <option value="">- Chưa gán -</option>
            {coordinatorMembers.map((member) => (
              <option key={member.id} value={member.user_id}>
                {member.profile?.full_name || member.profile?.email?.split('@')[0] || member.user_id}
              </option>
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
