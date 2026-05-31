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
  const selectZone = useUIStore((s) => s.selectZone)
  const toggleZoneHidden = useUIStore((s: any) => s.toggleZoneHidden as (zoneId: string) => void)
  const hiddenZoneIds = useUIStore((s: any) => (s.hiddenZoneIds ?? {}) as Record<string, true>)
  const showPolygons = useUIStore((s: any) => (s.showPolygons ?? true) as boolean)
  const togglePolygons = useUIStore((s: any) => s.togglePolygons as () => void)

  const [targetDistrict, setTargetDistrict] = useState(0)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')
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

  const targetZoneCount = assignments.filter((a) => a.districtId === targetDistrict).length
  const sourceZoneCount = districtId >= 0
    ? assignments.filter((a) => a.districtId === districtId).length
    : 0
  const currentSalesId = assignment?.salesAgentId ?? 'Chưa gán'
  const targetSalesId =
    assignments.find((a) => a.districtId === targetDistrict)?.salesAgentId ?? currentSalesId

  useEffect(() => {
    setShowDeleteConfirm(false)
    setAssignError('')
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
    return <div style={styles.hint}>{t('map.click_hint')}</div>
  }

  if (!zone) return null

  const customers = zone.activities
    .filter((a) => a.type === 'CUSTOMER')
    .reduce((s, a) => s + a.value, 0)
  const orders = zone.activities
    .filter((a) => a.type === 'ORDER')
    .reduce((s, a) => s + a.value, 0)
  const distColor = districtId >= 0 ? getDistrictFillColor(districtId) : '#888'
  const targetColor = targetDistrict >= 0 ? getDistrictFillColor(targetDistrict) : '#888'
  const isHidden = selectedZoneId ? Boolean(hiddenZoneIds[selectedZoneId]) : false

  async function handleAssign() {
    if (!onAssign || !selectedZoneId) return
    setAssignError('')
    setAssigning(true)
    try {
      await onAssign(selectedZoneId, targetDistrict)
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : 'Không thể chuyển polygon.')
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
        <div>
          <h3 style={styles.zoneName}>{zone.name}</h3>
          <div style={styles.zoneSub}>Polygon {zone.id}</div>
        </div>
        <div style={styles.headerRight}>
          {districtId >= 0 && (
            <span style={{ ...styles.badge, background: distColor }}>
              C{districtId}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              selectZone(null)
            }}
            aria-label="Đóng bảng thông tin"
            title="Đóng"
            style={styles.closeBtn}
            data-testid="zone-panel-close"
          >
            ×
          </button>
        </div>
      </div>

      <div style={styles.quickActions}>
        <button
          style={styles.quickBtn}
          onClick={() => {
            if (!selectedZoneId) return
            if (!showPolygons) togglePolygons()
            toggleZoneHidden(selectedZoneId)
          }}
          data-testid="toggle-selected-zone-visibility"
        >
          {isHidden ? 'Hiện polygon này' : 'Ẩn polygon này'}
        </button>
      </div>

      <div style={styles.statsGrid}>
        <Stat label={t('map.zone_customers')} value={customers} />
        <Stat label={t('map.zone_orders')} value={orders} />
        <Stat label="Cụm hiện tại" value={districtId >= 0 ? `C${districtId}` : 'Chưa gán'} />
        <Stat label="Sales" value={currentSalesId} />
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

      {(role === 'admin' || role === 'coordinator') && onAssign && availableDistrictIds.length > 0 && (
        <div style={styles.assignRow}>
          <div style={styles.assignHeader}>
            <label style={styles.assignLabel}>Chuyển sang cụm</label>
            {targetDistrict !== districtId && (
              <span style={{ ...styles.targetChip, borderColor: targetColor, color: targetColor }}>
                C{districtId} {'->'} C{targetDistrict}
              </span>
            )}
          </div>
          <div style={styles.assignControls}>
            <select
              style={styles.select}
              value={targetDistrict}
              onChange={(e) => {
                setTargetDistrict(Number(e.target.value))
                setAssignError('')
              }}
              data-testid="assign-district-select"
            >
              {availableDistrictIds.map((id) => {
                const zoneCount = assignments.filter((a) => a.districtId === id).length
                return (
                  <option key={id} value={id} disabled={id === districtId}>
                    Cụm {id} ({zoneCount} vùng){id === districtId ? ' - hiện tại' : ''}
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
              {assigning ? 'Đang kiểm tra...' : t('map.assign_confirm')}
            </button>
          </div>
          {targetDistrict !== districtId && (
            <div style={styles.movePreview}>
              Cụm nguồn còn {Math.max(0, sourceZoneCount - 1)} vùng; cụm đích sẽ có {targetZoneCount + 1} vùng.
              Sales phụ trách sau chuyển: {targetSalesId}.
            </div>
          )}
          {assignError && <div style={styles.inlineError}>{assignError}</div>}
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
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
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
    padding: 14,
    boxShadow: 'var(--shadow-lg)',
    zIndex: 999,
    width: 'min(440px, calc(100vw - 32px))',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-2)',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: '26px',
    textAlign: 'center',
    padding: 0,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: 0,
  },
  zoneSub: {
    color: 'var(--color-text-muted)',
    fontSize: 11,
    marginTop: 3,
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 6,
    color: '#fff',
    fontSize: 12,
    fontWeight: 800,
  },
  quickActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  quickBtn: {
    padding: '7px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  quickBtnGhost: {
    padding: '7px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #2563eb',
    background: 'transparent',
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
    marginBottom: 10,
  },
  stat: {
    minWidth: 0,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '7px 8px',
    background: 'var(--color-surface-2)',
  },
  statLabel: {
    display: 'block',
    color: 'var(--color-text-2)',
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--color-text)',
    fontSize: 13,
  },
  editSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr auto',
    alignItems: 'end',
    gap: 8,
    padding: '10px 0',
    borderTop: '1px solid var(--color-border)',
    marginTop: 2,
  },
  editRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  editLabel: {
    fontSize: 11,
    color: 'var(--color-text-2)',
  },
  editInput: {
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
    width: '100%',
    minWidth: 0,
  },
  saveBtn: {
    padding: '7px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  assignRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 10,
    borderTop: '1px solid var(--color-border)',
    marginTop: 8,
  },
  assignHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  assignControls: {
    display: 'flex',
    gap: 8,
  },
  assignLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  targetChip: {
    border: '1px solid',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 800,
    background: 'var(--color-surface)',
  },
  select: {
    flex: 1,
    minWidth: 0,
    padding: '7px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
  },
  assignBtn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  movePreview: {
    color: 'var(--color-text-2)',
    fontSize: 12,
    lineHeight: 1.45,
  },
  inlineError: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px',
    fontSize: 12,
    lineHeight: 1.4,
  },
  deleteSection: {
    borderTop: '1px solid var(--color-border)',
    marginTop: 10,
    paddingTop: 10,
  },
  deleteBtn: {
    width: '100%',
    padding: '7px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #dc2626',
    background: 'transparent',
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 700,
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
    fontWeight: 700,
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
    fontWeight: 700,
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
}
