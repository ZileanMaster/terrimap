import { supabase, isOnline } from '../lib/supabase.js'
import { loadZones, loadAssignments, loadAgents, loadRegions } from './db.js'
import type { Zone, Assignment, SalesAgent } from '../../facades/viewmodels.js'
import type { Region } from '../data/regions.js'

export interface RestoredLegacyDataset {
  zones: Zone[]
  assignments: Assignment[]
  agents: SalesAgent[]
  regions: Region[]
}

function scopedKey(base: string, projectId?: string): string {
  return projectId ? `${base}_${projectId}` : base
}

function readJsonArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('[LegacyRestore] localStorage write error:', error)
  }
}

export async function restoreLegacyDataset(projectId?: string): Promise<RestoredLegacyDataset> {
  const [zones, assignments, agents, regions] = await Promise.all([
    loadZones(projectId),
    loadAssignments(projectId),
    loadAgents(projectId),
    loadRegions(projectId),
  ])

  writeJsonArray(scopedKey('terrimap_zones', projectId), zones)
  writeJsonArray(scopedKey('terrimap_assignments', projectId), assignments)
  writeJsonArray(scopedKey('terrimap_agents', projectId), agents)
  writeJsonArray(scopedKey('terrimap_regions', projectId), regions)

  if (!isOnline()) {
    return { zones, assignments, agents, regions }
  }

  try {
    if (regions.length > 0) {
      const regionRows = regions.map((region) => ({
        id:             region.id,
        name:           region.name,
        coordinator_id: region.coordinatorId ?? null,
        center:         region.center,
        zoom:           region.zoom,
        ...(projectId ? { project_id: projectId } : {}),
      }))
      const { error } = await supabase!.from('regions').upsert(regionRows)
      if (error) console.error('[LegacyRestore] regions error:', error)
    }

    if (agents.length > 0) {
      const agentRows = agents.map((agent) => ({
        id:            agent.id,
        name:          agent.name,
        active_region: agent.activeRegion,
        capacity:      agent.capacity,
        ...(projectId ? { project_id: projectId } : {}),
      }))
      const { error } = await supabase!.from('sales_agents').upsert(agentRows)
      if (error) console.error('[LegacyRestore] agents error:', error)
    }

    if (zones.length > 0) {
      const zoneRows = zones.map((zone) => ({
        id:       zone.id,
        name:     zone.name,
        status:   zone.status,
        polygon:  zone.polygon,
        centroid: zone.centroid,
        region_id: (zone as any).regionId ?? null,
        ...(projectId ? { project_id: projectId } : {}),
      }))
      const { error: zoneErr } = await supabase!.from('zones').upsert(zoneRows)
      if (zoneErr) {
        console.error('[LegacyRestore] zones error:', zoneErr)
      } else {
        await supabase!.from('activities').delete().in('zone_id', zones.map((zone) => zone.id))
        const activityRows = zones.flatMap((zone) =>
          zone.activities.map((activity) => ({
            id:      activity.id,
            zone_id: zone.id,
            type:    activity.type,
            value:   activity.value,
          })),
        )
        if (activityRows.length > 0) {
          const { error: activityErr } = await supabase!.from('activities').insert(activityRows)
          if (activityErr) console.error('[LegacyRestore] activities error:', activityErr)
        }
      }
    }

    if (assignments.length > 0) {
      let deleteQuery = supabase!.from('assignments').delete().neq('zone_id', '')
      if (projectId) deleteQuery = deleteQuery.eq('project_id', projectId)
      const { error: deleteErr } = await deleteQuery
      if (deleteErr) console.error('[LegacyRestore] assignments delete error:', deleteErr)

      const assignmentRows = assignments.map((assignment) => ({
        zone_id:        assignment.zoneId,
        district_id:    assignment.districtId,
        sales_agent_id: assignment.salesAgentId ?? `sa${assignment.districtId}`,
        ...(projectId ? { project_id: projectId } : {}),
      }))
      const { error: insertErr } = await supabase!.from('assignments').insert(assignmentRows)
      if (insertErr) console.error('[LegacyRestore] assignments insert error:', insertErr)
    }
  } catch (error) {
    console.error('[LegacyRestore] unexpected error:', error)
  }

  return { zones, assignments, agents, regions }
}
