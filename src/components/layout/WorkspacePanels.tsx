import React, { useMemo } from 'react'
import { findPolygonTopologyViolations } from '../../../lib/geometry.js'
import { exportGeoJSON, exportZonesCSV } from '../../utils/exportUtils.js'
import type { Assignment, Zone } from '../../../facades/viewmodels.js'

function getZoneCustomers(zone: Zone): number {
  return zone.activities
    .filter((activity) => activity.type === 'CUSTOMER')
    .reduce((sum, activity) => sum + activity.value, 0)
}

function getZoneOrders(zone: Zone): number {
  return zone.activities
    .filter((activity) => activity.type === 'ORDER')
    .reduce((sum, activity) => sum + activity.value, 0)
}

function TinyStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value.toLocaleString('vi-VN')}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

export function MapDataWorkspacePanel({
  zones,
  assignments,
  canExport = true,
}: {
  zones: Zone[]
  assignments: Assignment[]
  canExport?: boolean
}) {
  const assignedIds = useMemo(() => new Set(assignments.map((assignment) => assignment.zoneId)), [assignments])
  const unassignedCount = useMemo(
    () => zones.filter((zone) => !assignedIds.has(zone.id)).length,
    [zones, assignedIds],
  )
  const topologyErrors = useMemo(() => findPolygonTopologyViolations(zones).length, [zones])
  const emptyMetricsCount = useMemo(
    () => zones.filter((zone) => getZoneCustomers(zone) === 0 && getZoneOrders(zone) === 0).length,
    [zones],
  )

  return (
    <div style={styles.stack}>
      <div style={styles.card}>
        <div style={styles.subTitle}>Kiểm tra dữ liệu</div>
        <div style={styles.checkList}>
          <div style={styles.checkItem}>
            <span style={styles.statusDot(topologyErrors === 0)} />
            <span>
              {topologyErrors === 0
                ? 'Không có lỗi chồng lấn polygon.'
                : `Có ${topologyErrors} lỗi polygon cần xử lý.`}
            </span>
          </div>
          <div style={styles.checkItem}>
            <span style={styles.statusDot(unassignedCount === 0)} />
            <span>
              {unassignedCount === 0
                ? 'Tất cả vùng đã sẵn sàng để phân cụm.'
                : `${unassignedCount} vùng chưa được đưa vào cụm.`}
            </span>
          </div>
          <div style={styles.checkItem}>
            <span style={styles.statusDot(emptyMetricsCount === 0)} />
            <span>
              {emptyMetricsCount === 0
                ? 'Mọi vùng đã có số liệu khách hàng/đơn hàng.'
                : `${emptyMetricsCount} vùng còn thiếu số liệu hoạt động.`}
            </span>
          </div>
        </div>

        {canExport && (
          <div style={styles.buttonRow}>
            <button style={styles.ghostBtn} onClick={() => exportZonesCSV(zones)} disabled={zones.length === 0}>
              Xuất CSV vùng
            </button>
            <button
              style={styles.ghostBtn}
              onClick={() => exportGeoJSON(zones, assignments)}
              disabled={zones.length === 0}
            >
              Xuất GeoJSON
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function AssignmentWorkspacePanel({
  zoneCount,
  districtCount,
}: {
  zoneCount: number
  districtCount: number
}) {
  return (
    <div style={styles.card}>
      <div style={styles.eyebrow}>Không gian vận hành</div>
      <div style={styles.title}>Phân chia lãnh thổ</div>
      <div style={styles.desc}>
        Màn này dành cho phân cụm, gán nhân sự, cân bằng tải và lưu phương án triển khai. Phần dữ liệu nền
        nên xử lý ở màn Khu vực & bản đồ.
      </div>
      <div style={styles.statsGrid}>
        <TinyStat label="Vùng trong khu vực" value={zoneCount} />
        <TinyStat label="Cụm đang có" value={districtCount} />
        <TinyStat label="Trạng thái" value={zoneCount > 0 ? 1 : 0} />
      </div>
    </div>
  )
}

const styles: Record<string, any> = {
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  card: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-3)',
    fontWeight: 700,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--color-text)',
    marginTop: 2,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  desc: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--color-text-2)',
    marginTop: 2,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 8px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--color-accent)',
    lineHeight: 1.15,
  },
  statLabel: {
    fontSize: 10,
    color: 'var(--color-text-3)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  checkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 12,
    color: 'var(--color-text-2)',
    lineHeight: 1.45,
  },
  statusDot: (ok: boolean) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 4,
    flexShrink: 0,
    background: ok ? '#10b981' : '#f59e0b',
  }),
  buttonRow: {
    display: 'flex',
    gap: 8,
    marginTop: 2,
  },
  ghostBtn: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
