/**
 * DistrictAgentAssigner — Phase 3 update
 *
 * - Color dot + zone count + total customers per district
 * - Agent dropdown filtered by same regionId as selected region
 * - Lưu ngay khi thay đổi
 */

import React, { useCallback, useMemo } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { getDistrictFillColor } from '../../data/district-colors.js'
import type { Zone } from '../../../facades/viewmodels.js'

interface DistrictAgentAssignerProps {
  /** Optional: filter agents by this regionId (Phase 3 — 3B) */
  regionId?: string
  zones?:    Zone[]
}

export default function DistrictAgentAssigner({ regionId, zones: propZones }: DistrictAgentAssignerProps = {}) {
  const assignments        = useDataStore((s) => s.assignments)
  const agents             = useDataStore((s) => s.agents)
  const storeZones         = useDataStore((s) => s.zones)
  const persistAssignments = useDataStore((s) => s.persistAssignments)

  const zones = propZones ?? storeZones

  // Phase 3: filter agents by region (if regionId provided)
  // Note 4: nếu agent chưa có regionId → hiện ở tất cả regions
  const filteredAgents = useMemo(() => {
    if (!regionId) return agents
    return agents.filter((a) => {
      const agentRegion = (a as any).regionId
      return !agentRegion || agentRegion === regionId
    })
  }, [agents, regionId])

  // Build district stats
  const districts = useMemo(() => {
    const ids = [...new Set(assignments.map((a) => a.districtId))].sort((a, b) => a - b)
    return ids.map((d) => {
      const distAssignments = assignments.filter((a) => a.districtId === d)
      const distZones       = zones.filter((z) => distAssignments.some((a) => a.zoneId === z.id))

      // Total customers
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
          {/* District info */}
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

          {/* Agent dropdown — filtered by region */}
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
            {/* Show current agent even if outside region */}
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
