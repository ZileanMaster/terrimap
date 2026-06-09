/**
 * Sidebar — Thanh điều hướng thích ứng theo vai trò
 *
 * L4b-1: Hiện nhận prop `assignments` từ Page (phản ánh kết quả thuật toán).
 * - Khối thẻ zone có scroll-into-view khi selectedZoneId thay đổi
 * - Click thẻ agent → setHighlightedSalesId → map tô sáng cụm
 * - Click thẻ zone → selectZone → map tô sáng vùng
 */

import React, { useEffect, useRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store/uiStore.js'
import { useFacade } from '../../context/FacadeContext.js'
import { useDataStore } from '../../store/dataStore.js'
import { getDistrictFillColor } from '../../data/district-colors.js'
import AgentManager from '../agent/AgentManager.js'
import DistrictAgentAssigner from '../assignment/DistrictAgentAssigner.js'
import RegionManager from '../admin/RegionManager.js'
import { AssignmentWorkspacePanel, MapDataWorkspacePanel } from './WorkspacePanels.js'
import type { Assignment, HistoryEntry, Zone } from '../../../facades/viewmodels.js'

interface SidebarProps {
  /** Live assignments — reflects algorithm results. Passed from Page. */
  zones: Zone[]
  assignments: Assignment[]
  /** Callback ?? t?o snapshot phi?n b?n. Ch? admin d?ng. */
  onCreateSnapshot?: (() => void) | undefined
  /** L4b-2 EC-1: Island zone IDs (no adj neighbors). */
  islandZoneIds?: Set<string> | undefined
  /** L4b-2 EC-2: Disconnected district IDs (contiguity violations). */
  disconnectedDistrictIds?: Set<number> | undefined
  /** Fly map to given coordinates (from province search) */
  onFlyTo?: ((lat: number, lng: number, zoom: number) => void) | undefined
  mode?: 'regions' | 'assignments'
}

export default function Sidebar({ zones, assignments, onCreateSnapshot, islandZoneIds, disconnectedDistrictIds, onFlyTo, mode = 'assignments' }: SidebarProps) {
  const role = useUIStore((s) => s.role)

  return (
    <aside style={styles.sidebar} data-testid="sidebar">
      {role === 'admin'       && <AdminSidebar zones={zones} assignments={assignments} onCreateSnapshot={onCreateSnapshot} islandZoneIds={islandZoneIds} disconnectedDistrictIds={disconnectedDistrictIds} onFlyTo={onFlyTo} mode={mode} />}
      {role === 'coordinator' && <CoordinatorSidebar zones={zones} assignments={assignments} mode={mode} />}
      {role === 'sales'       && <SalesSidebar />}
    </aside>
  )
}

// ── Zone Card List (shared across roles) ──────────────────────────────────────

const CARD_HEIGHT = 44        // fixed height per zone card (px)
const OVERSCAN = 5            // extra cards rendered above/below viewport
const VIRTUAL_THRESHOLD = 40  // virtual scroll only when > this many zones

interface ZoneCardListProps {
  zones:          Zone[]
  assignments:    Assignment[]
  islandZoneIds?: Set<string> | undefined    // L4b-2 EC-1
  onFlyTo?:       ((lat: number, lng: number, zoom: number) => void) | undefined
  mode?:          'regions' | 'assignments'
}

function getZoneCustomers(zone: Zone): number {
  return zone.activities
    .filter((a) => a.type === 'CUSTOMER')
    .reduce((sum, a) => sum + a.value, 0)
}

function getZoneOrders(zone: Zone): number {
  return zone.activities
    .filter((a) => a.type === 'ORDER')
    .reduce((sum, a) => sum + a.value, 0)
}

function ZoneCardList({ zones, assignments, islandZoneIds, onFlyTo, mode = 'assignments' }: ZoneCardListProps) {
  const selectedZoneId = useUIStore((s) => s.selectedZoneId)
  const selectZone     = useUIStore((s) => s.selectZone)
  const containerRef   = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const handleZoneSelect = useCallback((zoneId: string) => {
    selectZone(zoneId)
    if (onFlyTo) {
      const zone = zones.find(z => z.id === zoneId)
      if (zone) {
        // T?nh centroid t? v?ng (t?a ?? GeoJSON l? [lng, lat])
        // Tr?nh d?ng field centroid ?? l?u v? c? th? c?/sai
        let ring: number[][] = []
        if (zone.polygon.type === 'Polygon') {
          ring = (zone.polygon.coordinates[0] ?? []) as number[][]
        } else if (zone.polygon.type === 'MultiPolygon') {
          ring = ((zone.polygon.coordinates[0]?.[0]) ?? []) as number[][]
        }
        if (ring.length > 0) {
          const avgLng = ring.reduce((s, p) => s + (p[0] ?? 0), 0) / ring.length
          const avgLat = ring.reduce((s, p) => s + (p[1] ?? 0), 0) / ring.length
          onFlyTo(avgLat, avgLng, 14)
        }
      }
    }
  }, [selectZone, onFlyTo, zones])

  // Build assignment lookup (memoized)
  const assignmentMap = React.useMemo(
    () => new Map(assignments.map((a) => [a.zoneId, a])),
    [assignments],
  )

  // Scroll-into-view when selectedZoneId changes
  useEffect(() => {
    if (!selectedZoneId || !containerRef.current) return
    if (zones.length <= VIRTUAL_THRESHOLD) {
      const el = containerRef.current.querySelector(`[data-testid="zone-card-${selectedZoneId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      const idx = zones.findIndex(z => z.id === selectedZoneId)
      if (idx >= 0) containerRef.current.scrollTop = idx * CARD_HEIGHT
    }
  }, [selectedZoneId, zones])

  // ── Normal rendering (< threshold) ──────────────────────────────────────────
  if (zones.length <= VIRTUAL_THRESHOLD) {
    return (
      <>
        <h2 style={styles.sectionTitle}>🗺️ Danh sách vùng ({zones.length})</h2>
        <div ref={containerRef} style={styles.zoneList}>
          {zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              assignment={assignmentMap.get(zone.id)}
              isSelected={zone.id === selectedZoneId}
              isIsland={islandZoneIds?.has(zone.id) ?? false}
              onSelect={handleZoneSelect}
              mode={mode}
            />
          ))}
        </div>
      </>
    )
  }

  // ── Virtual scroll rendering (>= threshold) ────────────────────────────────
  const containerHeight = 400
  const totalHeight = zones.length * CARD_HEIGHT
  const startIdx = Math.max(0, Math.floor(scrollTop / CARD_HEIGHT) - OVERSCAN)
  const endIdx = Math.min(zones.length, Math.ceil((scrollTop + containerHeight) / CARD_HEIGHT) + OVERSCAN)
  const visibleZones = zones.slice(startIdx, endIdx)

  return (
    <>
      <h2 style={styles.sectionTitle}>🗺️ Danh sách vùng ({zones.length})</h2>
      <div
        ref={containerRef}
        style={{ ...styles.zoneList, height: containerHeight, overflowY: 'auto' }}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: startIdx * CARD_HEIGHT, flexShrink: 0 }} />
        {visibleZones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            assignment={assignmentMap.get(zone.id)}
            isSelected={zone.id === selectedZoneId}
            isIsland={islandZoneIds?.has(zone.id) ?? false}
            onSelect={handleZoneSelect}
            mode={mode}
          />
        ))}
        <div style={{ height: (zones.length - endIdx) * CARD_HEIGHT, flexShrink: 0 }} />
      </div>
    </>
  )
}

// ── ZoneCard (memoized) ───────────────────────────────────────────────────────

const ZoneCard = React.memo(function ZoneCard({
  zone, assignment, isSelected, isIsland, onSelect, mode = 'assignments',
}: {
  zone: Zone
  assignment?: Assignment | undefined
  isSelected: boolean
  isIsland: boolean
  onSelect: (id: string) => void
  mode?: 'regions' | 'assignments'
}) {
  const districtId = assignment?.districtId ?? -1
  const customers = getZoneCustomers(zone)
  const orders = getZoneOrders(zone)
  const isAssigned = districtId >= 0
  const distColor = mode === 'regions'
    ? (isAssigned ? '#10b981' : '#888')
    : (districtId >= 0 ? getDistrictFillColor(districtId) : '#888')

  return (
    <div
      data-testid={`zone-card-${zone.id}`}
      style={{
        ...styles.zoneCard,
        height: CARD_HEIGHT,
        borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
        boxShadow: isSelected ? '0 0 0 2px var(--color-accent-light)' : 'none',
      }}
      onClick={() => onSelect(zone.id)}
    >
      <span style={{ ...styles.districtDot, background: distColor }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.zoneName}>
          {zone.name}
          {isIsland && (
            <span
              style={styles.islandBadge}
              title="Vùng cô lập — không kề vùng nào trong bán kính 50km"
              data-testid={`island-badge-${zone.id}`}
            >
              🏝️
            </span>
          )}
        </div>
        <div style={styles.zoneMeta}>
          {mode === 'regions' ? `${customers} KH · ${orders} đơn · ${isAssigned ? 'Đã phân cụm' : 'Chưa phân cụm'}` : `${districtId >= 0 ? `C${districtId}` : '—'} · ${customers} KH`}
        </div>
      </div>
    </div>
  )
})

function AdminSidebar({ zones, assignments, onCreateSnapshot, islandZoneIds, disconnectedDistrictIds, onFlyTo, mode }: {
  zones: Zone[]; assignments: Assignment[]; onCreateSnapshot?: (() => void) | undefined;
  islandZoneIds?: Set<string> | undefined; disconnectedDistrictIds?: Set<number> | undefined;
  onFlyTo?: ((lat: number, lng: number, zoom: number) => void) | undefined;
  mode?: 'regions' | 'assignments';
}) {
  const { t } = useTranslation()
  const ctx                = useFacade()
  // ?? b? ph?n sales team kh?i m?n ph?n chia, nh?ng v?n gi? state/hook n?n b?n d??i
  // to avoid large refactors in this file.
  const highlightedSalesId = useUIStore((s) => s.highlightedSalesId)
  const setHighlightedSalesId = useUIStore((s) => s.setHighlightedSalesId)
  const allAgents = useDataStore((s) => s.agents)
  const currentRegionId = useDataStore((s) => s.currentRegionId)
  const agents = currentRegionId
    ? allAgents.filter((a) => (a as any).region_id === currentRegionId || (a as any).regionId === currentRegionId)
    : allAgents
  const [agentModalOpen, setAgentModalOpen] = useState(false)

  if (ctx.role !== 'admin') return null
  const mgmt = ctx.facade.getSalesManagement(zones, assignments, agents)
  const districtCount = new Set(assignments.map((a) => a.districtId)).size

  if (mode === 'regions') {
    return (
      <div style={styles.content}>
        <MapDataWorkspacePanel zones={zones} assignments={assignments} />
        <div style={styles.divider} />
        <RegionManager onFlyTo={onFlyTo} />
        <div style={styles.divider} />
        <ZoneCardList zones={zones} assignments={assignments} islandZoneIds={islandZoneIds} onFlyTo={onFlyTo} mode="regions" />
      </div>
    )
  }

  // Per request: remove the Sales team section from "Phân chia lãnh thổ" sidebar.
  return (
    <div style={styles.content}>
      <AssignmentWorkspacePanel
        zoneCount={zones.length}
        districtCount={new Set(assignments.map((assignment) => assignment.districtId)).size}
      />
      <div style={styles.divider} />
      <DistrictAgentAssigner />

      <div style={styles.divider} />
      <ZoneCardList zones={zones} assignments={assignments} islandZoneIds={islandZoneIds} onFlyTo={onFlyTo} mode="assignments" />

      <div style={styles.divider} />
      <button style={styles.primaryBtn} id="btn-create-snapshot" onClick={onCreateSnapshot} disabled={!onCreateSnapshot}>
        📸 {t('sidebar.create_snapshot')}
      </button>
    </div>
  )
}

function CoordinatorSidebar({ zones, assignments, mode }: { zones: Zone[]; assignments: Assignment[]; mode?: 'regions' | 'assignments' }) {
  const { t } = useTranslation()
  const ctx                    = useFacade()
  const highlightedSalesId     = useUIStore((s) => s.highlightedSalesId)
  const setHighlightedSalesId  = useUIStore((s) => s.setHighlightedSalesId)
  const allAgents = useDataStore((s) => s.agents)
  const currentRegionId = useDataStore((s) => s.currentRegionId)
  const agents = currentRegionId
    ? allAgents.filter((a) => (a as any).region_id === currentRegionId || (a as any).regionId === currentRegionId)
    : allAgents

  if (ctx.role !== 'coordinator') return null
  const overview = ctx.facade.getTeamOverview(zones, assignments, agents)

  if (mode === 'regions') {
    return (
      <div style={styles.content}>
        <MapDataWorkspacePanel zones={zones} assignments={assignments} canExport={false} />
        <div style={styles.divider} />
        <ZoneCardList zones={zones} assignments={assignments} mode="regions" />
      </div>
    )
  }

  return (
    <div style={styles.content} data-testid="team-overview">
      <h2 style={styles.sectionTitle}>📋 {t('sidebar.team_overview')}</h2>
      <div style={styles.statsGrid}>
        <StatCard label={t('sidebar.customers_total')} value={overview.totalKH} />
        <StatCard label={t('sidebar.orders_total')} value={overview.totalOrders} />
      </div>

      <div style={styles.divider} />
      {overview.sales.map((s) => {
        const isActive = highlightedSalesId === s.salesId
        return (
          <div
            key={s.salesId}
            data-testid={`sales-card-${s.salesId}`}
            style={{
              ...styles.agentCard,
              borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
              boxShadow: isActive ? '0 0 0 2px var(--color-accent-light)' : 'none',
              cursor: 'pointer',
            }}
            onClick={() => setHighlightedSalesId(s.salesId)}
          >
            <div style={styles.agentAvatar}>{s.salesName.charAt(0)}</div>
            <div>
              <div style={styles.agentName}>{s.salesName}</div>
              <div style={styles.agentMeta}>
                {s.assignedZones.length} {t('sidebar.zones_count')} ·{' '}
                {s.assignedZones.reduce((acc, z) => acc + z.customers, 0)} KH
              </div>
            </div>
          </div>
        )
      })}

      <div style={styles.divider} />
      <DistrictAgentAssigner />

      <div style={styles.divider} />
      <ZoneCardList zones={zones} assignments={assignments} mode="assignments" />

      {/* Update History */}
      <div style={styles.divider} />
      <CoordinatorHistory />
    </div>
  )
}

// ── Coordinator History ────────────────────────────────────────────────────────

function CoordinatorHistory() {
  const { t } = useTranslation()
  const ctx = useFacade()

  if (ctx.role !== 'coordinator') return null

  let history: HistoryEntry[] = []
  try {
    history = ctx.facade.getUpdateHistory({ period: 'month' })
  } catch {
    // No history available
  }

  return (
    <>
      <h2 style={styles.sectionTitle}>📅 {t('sidebar.update_history')}</h2>
      {history.length === 0 ? (
        <div style={styles.emptyMsg}>Chưa có lịch sử cập nhật</div>
      ) : (
        history.map((entry, i) => (
          <div key={i} style={styles.historyCard} data-testid={`history-entry-${i}`}>
            <div style={styles.historyLabel}>{entry.label}</div>
            <div style={styles.historyMeta}>
              v{entry.version} · {entry.zoneCount} zones · {new Date(entry.timestamp).toLocaleDateString('vi-VN')}
            </div>
          </div>
        ))
      )}
    </>
  )
}

// ── Sales Sidebar ──────────────────────────────────────────────────────────────


function SalesSidebar() {
  const { t } = useTranslation()
  const ctx = useFacade()
  if (ctx.role !== 'sales') return null

  let district = null
  let forecast = null
  let error = ''
  try {
    district = ctx.facade.getMyDistrict()
    forecast = ctx.facade.getMyOrderForecast()
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : 'Lỗi không xác định'
  }

  return (
    <div style={styles.content}>
      <h2 style={styles.sectionTitle}>🗺️ {t('sidebar.my_district')}</h2>
      {error && <div style={styles.errorMsg}>{error}</div>}

      {district && (
        <>
          <div style={styles.statsGrid}>
            <StatCard label="Vùng" value={district.zones.length} />
            <StatCard label="KH" value={district.summary.totalCustomers} />
            <StatCard label="Đơn" value={district.summary.totalOrders} />
          </div>

          {forecast && (
            <>
              <div style={styles.divider} />
              <h2 style={styles.sectionTitle}>📈 {t('sidebar.forecast')}</h2>
              <div style={styles.forecastCard} data-testid="order-forecast">
                <div style={styles.forecastRow}>
                  <span style={{ color: 'var(--color-text-2)' }}>Hiện tại</span>
                  <strong>{forecast.currentOrders}</strong>
                </div>
                <div style={styles.forecastRow}>
                  <span style={{ color: 'var(--color-text-2)' }}>Dự báo tháng tới</span>
                  <strong style={{ color: 'var(--color-success)' }}>
                    {forecast.forecastedOrders}
                  </strong>
                </div>
                <div style={{ ...styles.forecastRow, marginTop: 4 }}>
                  <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                    Cập nhật: {new Date(forecast.forecastedAt).toLocaleDateString('vi-VN')}
                  </span>
                  <span style={{ color: 'var(--color-success)', fontSize: 11, fontWeight: 600 }}>
                    +5%
                  </span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-w)',
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    overflowY: 'auto',
    flexShrink: 0,
    height: '100%',
  },
  content: {
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-3)',
    marginTop: 4,
    marginBottom: 4,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statCard: {
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 8px',
    textAlign: 'center' as const,
    border: '1px solid var(--color-border)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-accent)',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: 10,
    color: 'var(--color-text-3)',
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  divider: {
    height: 1,
    background: 'var(--color-border)',
    margin: '4px 0',
  },
  agentList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  agentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--color-accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  agentName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  agentMeta: {
    fontSize: 11,
    color: 'var(--color-text-3)',
    marginTop: 1,
  },
  primaryBtn: {
    padding: '10px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: 4,
  },
  errorMsg: {
    padding: '10px',
    background: 'rgba(220,38,38,.1)',
    color: 'var(--color-danger)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    borderLeft: '3px solid var(--color-danger)',
  },
  forecastCard: {
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  forecastRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
  },
  // Zone cards
  zoneList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  zoneCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  districtDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  zoneName: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  zoneMeta: {
    fontSize: 10,
    color: 'var(--color-text-3)',
    marginTop: 1,
  },
  // History entries (Coordinator)
  emptyMsg: {
    fontSize: 12,
    color: 'var(--color-text-3)',
    fontStyle: 'italic',
    padding: '6px 0',
  },
  historyCard: {
    padding: '8px 10px',
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    marginBottom: 4,
  },
  historyLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  historyMeta: {
    fontSize: 10,
    color: 'var(--color-text-3)',
    marginTop: 2,
  },
  // L4b-2 edge case badges
  islandBadge: {
    fontSize: 12,
    marginLeft: 4,
    cursor: 'help',
  },
  disconnectedBadge: {
    fontSize: 11,
    marginLeft: 4,
    cursor: 'help',
  },
}
