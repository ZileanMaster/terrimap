/**
 * DistrictAgentAssigner — cập nhật Giai đoạn 3
 *
 * - Chấm màu + số vùng + tổng khách hàng theo cụm
 * - Dropdown nhân sự được lọc theo regionId của vùng đang chọn
 * - Lưu ngay khi thay đổi
 */

import React, { useCallback, useMemo } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { getDistrictFillColor } from '../../data/district-colors.js'
import type { Zone } from '../../../facades/viewmodels.js'

interface DistrictAgentAssignerProps {
  /** Tùy chọn: lọc nhân sự theo regionId này (Giai đoạn 3 — 3B) */
  regionId?: string
  zones?:    Zone[]
}

export default function DistrictAgentAssigner({ regionId, zones: propZones }: DistrictAgentAssignerProps = {}) {
  const assignments        = useDataStore((s) => s.assignments)
  const agents             = useDataStore((s) => s.agents)
  const storeZones         = useDataStore((s) => s.zones)
  const persistAssignments = useDataStore((s) => s.persistAssignments)

  const zones = propZones ?? storeZones

  // Giai ?o?n 3: l?c nh?n s? theo v?ng (n?u c? regionId)
  // Ghi ch? 4: n?u nh?n s? ch?a c? regionId ? hi?n ? t?t c? v?ng
  const filteredAgents = useMemo(() => {
    if (!regionId) return agents
    return agents.filter((a) => {
      const agentRegion = (a as any).regionId
      return !agentRegion || agentRegion === regionId
    })
  }, [agents, regionId])

  // T?nh th?ng k? c?a c?m
  const districts = useMemo(() => {
    const ids = [...new Set(assignments.map((a) => a.districtId))].sort((a, b) => a - b)
    return ids.map((d) => {
      const distAssignments = assignments.filter((a) => a.districtId === d)
      const distZones       = zones.filter((z) => distAssignments.some((a) => a.zoneId === z.id))

      // T?ng s? kh?ch h?ng
      const totalCustomers = distZones.reduce((sum, z) =>
        sum + z.activities
          .filter((act) => act.type === 'CUSTOMER')
          .reduce((s, act) => s + act.value, 0),
        0,
      )

      return {
        districtId:    d,
        zoneCount:     distAssignments.length,
        totalCustomers,
        currentAgent:  distAssignments[0]?.salesAgentId ?? '',
      }
    })
  }, [assignments, zones])

  const handleChange = useCallback(async (districtId: number, newAgentId: string) => {
    const updated = assignments.map((a) =>
      a.districtId === districtId
        ? { ...a, salesAgentId: newAgentId }
        : a,
    )
    await persistAssignments(updated)
  }, [assignments, persistAssignments])

  if (districts.length === 0) return null

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>👥 Phân công nhân viên</h3>
      {districts.map((d) => (
        <div key={d.districtId} style={styles.row}>
          {/* Th?ng tin c?m */}
          <div style={styles.colorDot}>
            <span style={{
              ...styles.dot,
              background: getDistrictFillColor(d.districtId),
            }} />
            <div style={styles.labelCol}>
              <span style={styles.label}>Cụm {d.districtId}</span>
              <span style={styles.meta}>
                {d.zoneCount} vùng · {d.totalCustomers.toLocaleString()} KH
              </span>
            </div>
          </div>

          {/* Dropdown nhân sự — đã lọc theo vùng */}
          <select
            value={d.currentAgent}
            onChange={(e) => handleChange(d.districtId, e.target.value)}
            style={styles.select}
          >
            <option value="">-- Chọn nhân viên --</option>
            {filteredAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
            {/* V?n hi?n th? agent hi?n t?i k? c? khi ngo?i v?ng */}
            {d.currentAgent && !filteredAgents.some((a) => a.id === d.currentAgent) && (
              <option value={d.currentAgent}>
                {agents.find((a) => a.id === d.currentAgent)?.name ?? d.currentAgent} (ngoài vùng)
              </option>
            )}
          </select>
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 16px',
    borderTop: '1px solid var(--color-border)',
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: '0 0 10px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    gap: 8,
    borderBottom: '1px solid var(--color-border)',
  },
  colorDot: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
    border: '1.5px solid rgba(0,0,0,0.15)',
  },
  labelCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  meta: {
    fontSize: 10,
    color: 'var(--color-text-muted)',
  },
  select: {
    padding: '5px 8px',
    borderRadius: 6,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 12,
    cursor: 'pointer',
    maxWidth: 160,
    flexShrink: 0,
  },
}
