/**
 * ZoneInfoPanel — Hiển thị thông tin zone được chọn
 * Coordinator: có dropdown gán district
 * Admin: có inline edit cho customers/orders (L4c)
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store/uiStore.js'
import { useFacade } from '../../context/FacadeContext.js'
import { useDataStore } from '../../store/dataStore.js'
import type { Zone, Assignment } from '../../../facades/viewmodels.js'
import { getDistrictFillColor } from '../../data/district-colors.js'

interface ZoneInfoPanelProps {
  zones:              Zone[]
  assignments:        Assignment[]
  onAssign?:          (zoneId: string, toDistrict: number) => Promise<void>
  districtCount:      number
  onUpdateActivity?:  (zoneId: string, data: { customers?: number; orders?: number }) => void
  onDeleteZone?:      (zoneId: string) => void
  onMoveRegion?:      (zoneId: string, newRegionId: string) => Promise<void>
}

export default function ZoneInfoPanel({
  zones, assignments, onAssign, districtCount, onUpdateActivity, onDeleteZone, onMoveRegion,
}: ZoneInfoPanelProps) {
  const { t }          = useTranslation()
  const role           = useUIStore((s) => s.role)
  const selectedZoneId = useUIStore((s) => s.selectedZoneId)
  const regions        = useDataStore((s) => s.regions)
  const [targetDistrict, setTargetDistrict] = useState(0)
  const [assigning, setAssigning]           = useState(false)

  // Activity edit state (admin only)
  const [editCustomers, setEditCustomers] = useState('')
  const [editOrders, setEditOrders]       = useState('')

  // Delete confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Move region state
  const [targetRegionId, setTargetRegionId] = useState('')
  const [moving, setMoving]                 = useState(false)

  // Reset state when selected zone changes (must be before early return for Rules of Hooks)
  useEffect(() => {
    setShowDeleteConfirm(false)
    setEditCustomers('')
    setEditOrders('')
    setTargetRegionId('')
    setMoving(false)
  }, [selectedZoneId])

  if (!selectedZoneId) return (
    <div style={styles.hint}>
      🖱️ {t('map.click_hint')}
    </div>
  )

  const zone       = zones.find((z) => z.id === selectedZoneId)
  const assignment = assignments.find((a) => a.zoneId === selectedZoneId)
  if (!zone) return null

  const customers = zone.activities
    .filter((a) => a.type === 'CUSTOMER')
    .reduce((s, a) => s + a.value, 0)
  const orders = zone.activities
    .filter((a) => a.type === 'ORDER')
    .reduce((s, a) => s + a.value, 0)

  const districtId = assignment?.districtId ?? -1
  const distColor  = districtId >= 0 ? getDistrictFillColor(districtId) : '#888'

  async function handleAssign() {
    if (!onAssign) return
    setAssigning(true)
    try {
      await onAssign(selectedZoneId!, targetDistrict)
    } finally {
      setAssigning(false)
    }
  }

  function handleSaveActivity() {
    if (!onUpdateActivity || !selectedZoneId) return
    const data: { customers?: number; orders?: number } = {}
    if (editCustomers !== '') {
      const parsed = Number(editCustomers)
      if (!isNaN(parsed) && parsed >= 0) data.customers = parsed
    }
    if (editOrders !== '') {
      const parsed = Number(editOrders)
      if (!isNaN(parsed) && parsed >= 0) data.orders = parsed
    }
    if (Object.keys(data).length === 0) return

    onUpdateActivity(selectedZoneId, data)
    setEditCustomers('')
    setEditOrders('')
  }

  return (
    <div style={styles.panel}>
      {/* Zone name + district badge */}
      <div style={styles.header}>
        <h3 style={styles.zoneName}>{zone.name}</h3>
        {districtId >= 0 && (
          <span style={{ ...styles.badge, background: distColor }}>
            D{districtId}
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <Stat icon="👥" label={t('map.zone_customers')} value={customers} />
        <Stat icon="📦" label={t('map.zone_orders')}    value={orders} />
      </div>

      {/* Admin: activity edit */}
      {role === 'admin' && onUpdateActivity && (
        <div style={styles.editSection}>
          <div style={styles.editRow}>
            <label style={styles.editLabel}>{t('map.edit_customers')}</label>
            <input
              type="number"
              min="0"
              data-testid="activity-edit-customers"
              style={styles.editInput}
              placeholder={String(customers)}
              value={editCustomers}
              onChange={(e) => setEditCustomers(e.target.value)}
            />
          </div>
          <div style={styles.editRow}>
            <label style={styles.editLabel}>{t('map.edit_orders')}</label>
            <input
              type="number"
              min="0"
              data-testid="activity-edit-orders"
              style={styles.editInput}
              placeholder={String(orders)}
              value={editOrders}
              onChange={(e) => setEditOrders(e.target.value)}
            />
          </div>
          <button
            data-testid="activity-save-btn"
            style={styles.saveBtn}
            onClick={handleSaveActivity}
            disabled={editCustomers === '' && editOrders === ''}
          >
            💾 {t('map.save_activity')}
          </button>
        </div>
      )}

      {/* Admin: delete zone */}
      {role === 'admin' && onDeleteZone && (
        <div style={styles.deleteSection}>
          {!showDeleteConfirm ? (
            <button
              data-testid="zone-delete-btn"
              style={styles.deleteBtn}
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑️ {t('map.delete_zone')}
            </button>
          ) : (
            <div style={styles.confirmRow}>
              <span style={styles.confirmText}>
                {t('map.delete_confirm', { name: zone.name })}
              </span>
              <button
                data-testid="zone-delete-confirm"
                style={styles.confirmYes}
                onClick={() => {
                  onDeleteZone(selectedZoneId!)
                  setShowDeleteConfirm(false)
                }}
              >
                {t('common.confirm')}
              </button>
              <button
                data-testid="zone-delete-cancel"
                style={styles.confirmNo}
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Coordinator: assign to district — Phase 3C */}
      {role === 'coordinator' && onAssign && (
        <div style={styles.assignRow}>
          <label style={styles.assignLabel}>Chuyển sang district:</label>
          <select
            style={styles.select}
            value={targetDistrict}
            onChange={(e) => setTargetDistrict(Number(e.target.value))}
          >
            {Array.from({ length: districtCount }, (_, i) => {
              const zoneCount = assignments.filter((a) => a.districtId === i).length
              return (
                <option key={i} value={i} disabled={i === districtId}>
                  District {i} ({zoneCount} vùng){i === districtId ? ' ← hiện tại' : ''}
                </option>
              )
            })}
          </select>
          <button
            style={styles.assignBtn}
            onClick={handleAssign}
            disabled={assigning || targetDistrict === districtId}
          >
            {assigning ? '...' : t('map.assign_confirm')}
          </button>
        </div>
      )}

      {/* Move zone to another region */}
      {onMoveRegion && (
        <div style={styles.moveRegionRow}>
          <label style={styles.assignLabel}>Chuyển sang khu vực:</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <select
              style={styles.select}
              value={targetRegionId || (zone as any).regionId || ''}
              onChange={(e) => setTargetRegionId(e.target.value)}
              data-testid="move-region-select"
            >
              <option value="" disabled>-- Chọn khu vực --</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id} disabled={r.id === (zone as any).regionId}>
                  {r.name}{r.id === (zone as any).regionId ? ' (Hiện tại)' : ''}
                </option>
              ))}
            </select>
            <button
              style={styles.assignBtn}
              onClick={async () => {
                const destRegionId = targetRegionId || (zone as any).regionId;
                if (!destRegionId || destRegionId === (zone as any).regionId) return;
                setMoving(true);
                try {
                  await onMoveRegion(zone.id, destRegionId);
                } finally {
                  setMoving(false);
                }
              }}
              disabled={moving || !targetRegionId || targetRegionId === (zone as any).regionId}
              data-testid="move-region-btn"
            >
              {moving ? '...' : 'Chuyển'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span>{icon}</span>
      <span style={{ color: 'var(--color-text-2)' }}>{label}:</span>
      <strong>{value}</strong>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 999,
    minWidth: 280,
    maxWidth: 380,
  },
  hint: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 20px',
    boxShadow: 'var(--shadow-sm)',
    zIndex: 999,
    color: 'var(--color-text-3)',
    fontSize: 13,
    whiteSpace: 'nowrap' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  badge: {
    padding: '2px 10px',
    borderRadius: 99,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
  },
  statsRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 10,
  },
  // Activity edit (admin)
  editSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    padding: '8px 0',
    borderTop: '1px solid var(--color-border)',
    marginTop: 2,
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  editLabel: {
    fontSize: 12,
    color: 'var(--color-text-2)',
    minWidth: 52,
  },
  editInput: {
    flex: 1,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
    width: '100%',
  },
  saveBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
  // Coordinator assign
  assignRow: {
    display: 'flex',
    gap: 8,
    marginTop: 6,
  },
  select: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
  },
  // Delete zone
  deleteSection: {
    borderTop: '1px solid var(--color-border)',
    marginTop: 8,
    paddingTop: 8,
  },
  deleteBtn: {
    width: '100%',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #dc2626',
    background: 'transparent',
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  confirmText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: 600,
    flex: 1,
    minWidth: 120,
  },
  confirmYes: {
    padding: '5px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmNo: {
    padding: '5px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 12,
    cursor: 'pointer',
  },
  assignRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    paddingTop: 10,
    borderTop: '1px solid var(--color-border)',
    marginTop: 4,
  },
  moveRegionRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    paddingTop: 10,
    borderTop: '1px solid var(--color-border)',
    marginTop: 4,
  },
  assignLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  assignBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-end' as const,
  },
}
