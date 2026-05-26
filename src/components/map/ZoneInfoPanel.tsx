import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store/uiStore.js'
import type { Zone, Assignment } from '../../../facades/viewmodels.js'
import { getDistrictFillColor } from '../../data/district-colors.js'

interface ZoneInfoPanelProps {
  zones: Zone[]
  assignments: Assignment[]
  onAssign?: (zoneId: string, toDistrict: number) => Promise<void>
  districtCount: number
  districtIds?: number[]
  onUpdateActivity?: (zoneId: string, data: { customers?: number; orders?: number }) => void
  onDeleteZone?: (zoneId: string) => void
}

export default function ZoneInfoPanel({
  zones,
  assignments,
  onAssign,
  districtCount,
  districtIds,
  onUpdateActivity,
  onDeleteZone,
}: ZoneInfoPanelProps) {
  const { t } = useTranslation()
  const role = useUIStore((s) => s.role)
  const selectedZoneId = useUIStore((s) => s.selectedZoneId)

  const [targetDistrict, setTargetDistrict] = useState(0)
  const [assigning, setAssigning] = useState(false)
  const [editCustomers, setEditCustomers] = useState('')
  const [editOrders, setEditOrders] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const zone = zones.find((z) => z.id === selectedZoneId)
  const assignment = assignments.find((a) => a.zoneId === selectedZoneId)
  const districtId = assignment?.districtId ?? -1

  const availableDistrictIds = useMemo(() => {
    if (districtIds?.length) return [...districtIds].sort((a, b) => a - b)
    return Array.from({ length: districtCount }, (_, i) => i)
  }, [districtCount, districtIds])

  useEffect(() => {
    setShowDeleteConfirm(false)
    setEditCustomers('')
    setEditOrders('')
  }, [selectedZoneId])

  useEffect(() => {
    if (districtId >= 0) {
      setTargetDistrict(districtId)
      return
    }
    setTargetDistrict(availableDistrictIds[0] ?? 0)
  }, [availableDistrictIds, districtId, selectedZoneId])

  if (!selectedZoneId) {
    return (
      <div style={styles.hint}>
        {t('map.click_hint')}
      </div>
    )
  }

  if (!zone) return null

  const customers = zone.activities
    .filter((a) => a.type === 'CUSTOMER')
    .reduce((s, a) => s + a.value, 0)
  const orders = zone.activities
    .filter((a) => a.type === 'ORDER')
    .reduce((s, a) => s + a.value, 0)
  const distColor = districtId >= 0 ? getDistrictFillColor(districtId) : '#888'

  async function handleAssign() {
    if (!onAssign || !selectedZoneId) return
    setAssigning(true)
    try {
      await onAssign(selectedZoneId, targetDistrict)
    } finally {
      setAssigning(false)
    }
  }

  function handleSaveActivity() {
    if (!onUpdateActivity || !selectedZoneId) return

    const data: { customers?: number; orders?: number } = {}
    if (editCustomers !== '') {
      const parsed = Number(editCustomers)
      if (!Number.isNaN(parsed) && parsed >= 0) data.customers = parsed
    }
    if (editOrders !== '') {
      const parsed = Number(editOrders)
      if (!Number.isNaN(parsed) && parsed >= 0) data.orders = parsed
    }
    if (Object.keys(data).length === 0) return

    onUpdateActivity(selectedZoneId, data)
    setEditCustomers('')
    setEditOrders('')
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.zoneName}>{zone.name}</h3>
        {districtId >= 0 && (
          <span style={{ ...styles.badge, background: distColor }}>
            D{districtId}
          </span>
        )}
      </div>

      <div style={styles.statsRow}>
        <Stat label={t('map.zone_customers')} value={customers} />
        <Stat label={t('map.zone_orders')} value={orders} />
      </div>

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
            {t('map.save_activity')}
          </button>
        </div>
      )}

      {role === 'admin' && onDeleteZone && (
        <div style={styles.deleteSection}>
          {!showDeleteConfirm ? (
            <button
              data-testid="zone-delete-btn"
              style={styles.deleteBtn}
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t('map.delete_zone')}
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
                  onDeleteZone(selectedZoneId)
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

      {(role === 'admin' || role === 'coordinator') && onAssign && availableDistrictIds.length > 0 && (
        <div style={styles.assignRow}>
          <label style={styles.assignLabel}>Chuyển sang district:</label>
          <div style={styles.assignControls}>
            <select
              style={styles.select}
              value={targetDistrict}
              onChange={(e) => setTargetDistrict(Number(e.target.value))}
              data-testid="assign-district-select"
            >
              {availableDistrictIds.map((id) => {
                const zoneCount = assignments.filter((a) => a.districtId === id).length
                return (
                  <option key={id} value={id} disabled={id === districtId}>
                    District {id} ({zoneCount} vùng){id === districtId ? ' - hiện tại' : ''}
                  </option>
                )
              })}
            </select>
            <button
              style={styles.assignBtn}
              onClick={handleAssign}
              disabled={assigning || targetDistrict === districtId}
              data-testid="assign-district-btn"
            >
              {assigning ? '...' : t('map.assign_confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}:</span>
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
    maxWidth: 420,
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
    whiteSpace: 'nowrap',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: 0,
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
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
  },
  statLabel: {
    color: 'var(--color-text-2)',
  },
  editSection: {
    display: 'flex',
    flexDirection: 'column',
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
    flexWrap: 'wrap',
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
    flexDirection: 'column',
    gap: 6,
    paddingTop: 10,
    borderTop: '1px solid var(--color-border)',
    marginTop: 8,
  },
  assignControls: {
    display: 'flex',
    gap: 8,
  },
  assignLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  select: {
    flex: 1,
    minWidth: 0,
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
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
    whiteSpace: 'nowrap',
  },
}
