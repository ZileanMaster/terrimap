import type { Assignment, Zone } from '../../facades/viewmodels.js'

export interface DistrictSummary {
  districtId: number
  zoneCount: number
  totalCustomers: number
  totalOrders: number
  currentAgentId: string
}

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

export function buildDistrictSummaries(assignments: Assignment[], zones: Zone[]): DistrictSummary[] {
  const zoneById = new Map(zones.map((zone) => [zone.id, zone] as const))
  const summaryByDistrict = new Map<number, DistrictSummary>()

  for (const assignment of assignments) {
    const zone = zoneById.get(assignment.zoneId)
    if (!zone) continue

    const current = summaryByDistrict.get(assignment.districtId) ?? {
      districtId: assignment.districtId,
      zoneCount: 0,
      totalCustomers: 0,
      totalOrders: 0,
      currentAgentId: '',
    }

    current.zoneCount += 1
    current.totalCustomers += getZoneCustomers(zone)
    current.totalOrders += getZoneOrders(zone)
    if (!current.currentAgentId && assignment.salesAgentId) {
      current.currentAgentId = assignment.salesAgentId
    }

    summaryByDistrict.set(assignment.districtId, current)
  }

  return [...summaryByDistrict.values()].sort((a, b) => a.districtId - b.districtId)
}

export function getActiveDistrictIds(assignments: Assignment[], zones: Zone[]): number[] {
  return buildDistrictSummaries(assignments, zones).map((summary) => summary.districtId)
}

