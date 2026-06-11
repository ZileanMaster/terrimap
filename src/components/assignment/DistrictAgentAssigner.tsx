import React, { useCallback, useMemo } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { getDistrictFillColor } from '../../data/district-colors.js'
import type { Zone } from '../../../facades/viewmodels.js'

interface DistrictAgentAssignerProps {
  /** Tùy chọn: lọc nhân sự theo regionId này. */
  regionId?: string | undefined
  zones?: Zone[]
}

type AgentOption = {
  id: string
  name: string
  regionId?: string
}

export default function DistrictAgentAssigner({ regionId, zones: propZones }: DistrictAgentAssignerProps = {}) {
  const assignments        = useDataStore((s) => s.assignments)
  const agents             = useDataStore((s) => s.agents)
  const currentRegionId    = useDataStore((s) => s.currentRegionId)
  const storeZones         = useDataStore((s) => s.zones)
  const persistAssignments = useDataStore((s) => s.persistAssignments)

  const zones = propZones ?? storeZones
  const activeRegionId = regionId ?? currentRegionId ?? null

  const regionAgents = useMemo<AgentOption[]>(() => {
    const normalizedAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      regionId: (agent as any).regionId ?? (agent as any).region_id ?? undefined,
    }))

    if (!activeRegionId) return normalizedAgents
    return normalizedAgents.filter((agent) => agent.regionId === activeRegionId)
  }, [activeRegionId, agents])

  const districts = useMemo(() => {
    const ids = [...new Set(assignments.map((a) => a.districtId))].sort((a, b) => a - b)
    return ids.map((districtId) => {
      const distAssignments = assignments.filter((a) => a.districtId === districtId)
      const distZones = zones.filter((zone) => distAssignments.some((assignment) => assignment.zoneId === zone.id))

      const totalCustomers = distZones.reduce(
        (sum, zone) =>
          sum + zone.activities
            .filter((activity) => activity.type === 'CUSTOMER')
            .reduce((acc, activity) => acc + activity.value, 0),
        0,
      )

      return {
        districtId,
        zoneCount: distAssignments.length,
        totalCustomers,
        currentAgent: distAssignments[0]?.salesAgentId ?? '',
      }
    })
  }, [assignments, zones])

  const currentAgentByDistrict = useMemo(() => {
    const map = new Map<number, string>()
    for (const district of districts) {
      if (district.currentAgent) map.set(district.districtId, district.currentAgent)
    }
    return map
  }, [districts])

  const assignedAgentIds = useMemo(() => {
    return new Set(
      districts
        .map((district) => district.currentAgent)
        .filter((agentId): agentId is string => Boolean(agentId)),
    )
  }, [districts])

  const getAvailableAgentsForDistrict = useCallback((districtId: number) => {
    const currentAgentId = currentAgentByDistrict.get(districtId) ?? ''
    const usedElsewhere = new Set([...assignedAgentIds].filter((agentId) => agentId !== currentAgentId))
    return regionAgents.filter((agent) => !usedElsewhere.has(agent.id))
  }, [assignedAgentIds, currentAgentByDistrict, regionAgents])

  const handleChange = useCallback(async (districtId: number, newAgentId: string) => {
    const updated = assignments.map((assignment) =>
      assignment.districtId === districtId
        ? { ...assignment, salesAgentId: newAgentId }
        : assignment,
    )
    try {
      await persistAssignments(updated)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu phân công nhân viên'
      alert(message)
      throw error
    }
  }, [assignments, persistAssignments])

  if (districts.length === 0) return null

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>👥 Phân công nhân viên</h3>
      {districts.map((district) => {
        const availableAgents = getAvailableAgentsForDistrict(district.districtId)
        const currentValue = availableAgents.some((agent) => agent.id === district.currentAgent)
          ? district.currentAgent
          : ''

        return (
          <div key={district.districtId} style={styles.row}>
            <div style={styles.colorDot}>
              <span
                style={{
                  ...styles.dot,
                  background: getDistrictFillColor(district.districtId),
                }}
              />
              <div style={styles.labelCol}>
                <span style={styles.label}>Cụm {district.districtId}</span>
                <span style={styles.meta}>
                  {district.zoneCount} vùng · {district.totalCustomers.toLocaleString()} KH
                </span>
              </div>
            </div>

            <select
              value={currentValue}
              onChange={(e) => handleChange(district.districtId, e.target.value)}
              style={styles.select}
            >
              <option value="">-- Chọn nhân viên --</option>
              {availableAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        )
      })}
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
