/**
 * src/services/db.ts - Lớp CRUD cho database (Supabase ↔ App)
 *
 * Tất cả hàm đều async và sẽ fallback mượt sang dữ liệu MOCK khi
 * Supabase chưa được cấu hình (thiếu VITE_SUPABASE_URL).
 *
 * Các hàm SAVE là fire-and-forget (caller không await) - UI cập nhật
 * theo kiểu optimistic và DB sync ở nền.
 *
 * Ghi chú kiến trúc: file này nằm ở L4 (src/) và là nơi DUY NHẤT
 * chạm vào Supabase. L0-L3 không bị đụng tới.
 */

import { supabase, isOnline } from '../lib/supabase.js'
import { MOCK_ZONES, MOCK_ASSIGNMENTS } from '../data/mock-zones.js'
import { MOCK_AGENTS } from '../data/mock-agents.js'
import { DEFAULT_REGIONS, type Region } from '../data/regions.js'
import type { Zone, Assignment, SalesAgent } from '../../facades/viewmodels.js'
import { assertNoPolygonTopologyViolations } from '../../lib/geometry.js'


//  Project-scoped localStorage key helper 
// Prevents data leakage between different accounts/projects on same browser.
let _currentProjectId: string | undefined

/** Set the active project for localStorage scoping. Called by dataStore.init(). */
export function setActiveProject(projectId?: string) {
  _currentProjectId = projectId
}

/** Get current active project ID (used by metricsDb, PartitionFeedback). */
export function getActiveProjectId(): string | undefined {
  return _currentProjectId
}

/** Get project-scoped localStorage key. Falls back to global key if no project. */
function lsKey(base: string): string {
  return _currentProjectId ? `${base}_${_currentProjectId}` : base
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
    console.error('[DB] localStorage write error:', error)
  }
}

function readScopedCollections<T>(base: string, projectId?: string): T[] {
  if (projectId) {
    return readJsonArray<T>(scopedKey(base, projectId))
  }
  return readJsonArray<T>(base)
}

export function readCachedZones(projectId?: string): Zone[] {
  return readScopedCollections<Zone>('terrimap_zones', projectId)
}

export function readCachedAssignments(projectId?: string): Assignment[] {
  return readScopedCollections<Assignment>('terrimap_assignments', projectId)
}

export function readCachedAgents(projectId?: string): SalesAgent[] {
  return readScopedCollections<SalesAgent>('terrimap_agents', projectId)
}

export function readCachedRegions(projectId?: string): Region[] {
  return readScopedCollections<Region>('terrimap_regions', projectId)
}

function dispatchSnapshotChange(projectId?: string, snapshotId?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('terrimap:snapshots-updated', {
      detail: { projectId, snapshotId },
    }),
  )
}

export function readSnapshotCache(projectId?: string): Array<{
  id: string
  label: string
  data: { zones: Zone[]; assignments: Assignment[]; regionId?: string | null }
  created_at: string
  period?: string
}> {
  const scopedProjectId = projectId ?? _currentProjectId
  const key = scopedKey('terrimap_snapshots', scopedProjectId)
  return readJsonArray<any>(key)
}

export function inferSnapshotRegionId(snapshot: {
  data?: { zones?: Array<{ regionId?: string; region_id?: string }>; regionId?: string | null }
}): string | null {
  const explicitRegionId = snapshot?.data?.regionId ?? null
  if (explicitRegionId) return explicitRegionId

  const zones = snapshot?.data?.zones ?? []
  const regionIds = new Set(
    zones
      .map((zone) => zone.regionId ?? zone.region_id ?? null)
      .filter((value): value is string => Boolean(value)),
  )
  return regionIds.size === 1 ? [...regionIds][0] ?? null : null
}

//  DB row shapes (snake_case) 

interface DbZone {
  id:         string
  name:       string
  status:     string
  polygon:    object
  centroid:   { lat: number; lng: number }
  region_id?: string | null
  project_id?: string | null
  created_at?: string
}

interface DbActivity {
  id:         string
  zone_id:    string
  type:       string
  value:      number
}

interface DbAssignment {
  zone_id:        string
  district_id:    number
  sales_agent_id: string
}

interface DbSalesAgent {
  id:            string
  name:          string
  active_region: string
  region_id?:    string | null
  capacity:      number
}

interface DbProjectMember {
  user_id:   string
  role:      string | null
  region_id: string | null
  status?:   string | null
}

interface DbProfile {
  id:        string
  email?:    string | null
  full_name?: string | null
}

interface DbRegion {
  id:             string
  name:           string
  coordinator_id: string | null
  center:         { lat: number; lng: number }
  zoom:           number
}

//  LOAD 

export async function loadZones(projectId?: string): Promise<Zone[]> {
  const localZones = readScopedCollections<Zone>('terrimap_zones', projectId)

  if (!isOnline()) return localZones.length > 0
    ? localZones
    : MOCK_ZONES

  let query = supabase!.from('zones').select('*').order('id')
  if (projectId) query = query.eq('project_id', projectId)

  const { data: zoneData, error: zErr } = await query
  let zones = zoneData

  if (zErr || !zones || zones.length === 0) {
    if (zErr) console.error('[DB] loadZones error:', zErr)
    if (localZones.length > 0) return localZones
    return []
  }


  const zoneIds = (zones as DbZone[]).map(z => z.id)
  let activities: DbActivity[] = []
  if (zoneIds.length > 0) {
    const { data: actData, error: aErr } = await supabase!
      .from('activities')
      .select('*')
      .in('zone_id', zoneIds)
    if (aErr) console.error('[DB] loadActivities error:', aErr)
    activities = (actData ?? []) as DbActivity[]
  }

  // Build activity map by zone_id
  const actMap = new Map<string, DbActivity[]>()
  for (const a of activities) {
    const list = actMap.get(a.zone_id) ?? []
    list.push(a)
    actMap.set(a.zone_id, list)
  }

  const loadedZones: Zone[] = (zones as DbZone[]).map((z) => ({
    id:       z.id,
    name:     z.name,
    status:   z.status as Zone['status'],
    polygon:  z.polygon as Zone['polygon'],
    centroid: z.centroid,
    regionId: z.region_id ?? undefined,
    activities: (actMap.get(z.id) ?? []).map((a) => ({
      id:    a.id,
      type:  a.type as 'CUSTOMER' | 'ORDER' | 'REVENUE',
      value: a.value,
    })),
  } as any))

  try {
    assertNoPolygonTopologyViolations(loadedZones as any)
  } catch (e) {
    console.error('[DB] loadZones topology error:', e)
    return []
  }

  try {
    writeJsonArray(scopedKey('terrimap_zones', projectId), loadedZones)
  } catch (error) {
    console.error('[DB] loadZones cache sync error:', error)
  }

  return loadedZones
}

export async function loadAssignments(projectId?: string): Promise<Assignment[]> {
  const localAssignments = readScopedCollections<Assignment>('terrimap_assignments', projectId)

  if (!isOnline()) return localAssignments.length > 0
    ? localAssignments
    : MOCK_ASSIGNMENTS

  let query = supabase!.from('assignments').select('*')
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    if (error) console.error('[DB] loadAssignments error:', error)
    if (localAssignments.length > 0) return localAssignments
    return []
  }

  const remoteAssignments: Assignment[] = (data as DbAssignment[]).map((a) => ({
    zoneId:       a.zone_id,
    districtId:   a.district_id,
    salesAgentId: a.sales_agent_id,
  }))

  // Khi đã đọc được dữ liệu online hợp lệ, dùng remote làm nguồn sự thật
  // và đồng bộ lại cache local để tránh local cache cũ làm lệch số cụm.
  writeJsonArray(scopedKey('terrimap_assignments', projectId), remoteAssignments)

  return remoteAssignments
}

/**
 * Tải sales agents (giữ thứ tự canonical - OPEN-4), có thể lọc theo project.
 * Offline fallback: MOCK_AGENTS.
 */
export async function loadAgents(projectId?: string): Promise<SalesAgent[]> {
  if (!isOnline()) return readScopedCollections<SalesAgent>('terrimap_agents', projectId).length > 0
    ? readScopedCollections<SalesAgent>('terrimap_agents', projectId)
    : MOCK_AGENTS

  // IMPORTANT: never leak demo/legacy (NULL project_id) agents into other projects.

  let query = supabase!.from('sales_agents').select('*').order('id')
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query

  const memberAgents = await loadAgentsFromProjectMembers(projectId)

  if (error || !data || data.length === 0) {
    if (error) console.error('[DB] loadAgents error or empty:', error)
    const cached = readScopedCollections<SalesAgent>('terrimap_agents', projectId)
    const fallbackAgents = mergeAgents(cached, memberAgents)
    if (fallbackAgents.length > 0) {
      writeJsonArray(scopedKey('terrimap_agents', projectId), fallbackAgents)
      return fallbackAgents
    }
    return []
  }

  // Deduplicate by id - prefer the one WITH project_id
  const agentMap = new Map<string, DbSalesAgent>()
  for (const a of data as DbSalesAgent[]) {
    const existing = agentMap.get(a.id)
    if (!existing || (a as any).project_id) {
      agentMap.set(a.id, a)
    }
  }

  const remoteAgents = Array.from(agentMap.values()).map((a) => ({
    id:           a.id,
    name:         a.name,
    activeRegion: a.active_region,
    ...(a.region_id != null ? { regionId: a.region_id } : {}),
    capacity:     a.capacity,
  }))

  const mergedAgents = mergeAgents(remoteAgents, memberAgents)
  writeJsonArray(scopedKey('terrimap_agents', projectId), mergedAgents)
  return mergedAgents
}

function mergeAgents(primary: SalesAgent[], fallback: SalesAgent[]): SalesAgent[] {
  const map = new Map<string, SalesAgent>()
  for (const agent of fallback) map.set(agent.id, agent)
  for (const agent of primary) map.set(agent.id, agent)
  return [...map.values()]
}

async function loadAgentsFromProjectMembers(projectId?: string): Promise<SalesAgent[]> {
  if (!isOnline() || !projectId) return []

  const { data: members, error } = await supabase!
    .from('project_members')
    .select('user_id, role, region_id, status')
    .eq('project_id', projectId)
    .or('role.eq.sales,role.is.null')
    .or('status.is.null,status.neq.blocked')

  if (error || !members || members.length === 0) {
    if (error) console.warn('[DB] loadAgentsFromProjectMembers warning:', error)
    return []
  }

  const userIds = [...new Set((members as DbProjectMember[]).map((member) => member.user_id).filter(Boolean))]
  const profileMap = new Map<string, DbProfile>()

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase!
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)

    if (profileError) {
      console.warn('[DB] loadAgentsFromProjectMembers profile warning:', profileError)
    } else {
      for (const profile of (profiles ?? []) as DbProfile[]) {
        profileMap.set(profile.id, profile)
      }
    }
  }

  const agents = (members as DbProjectMember[]).map((member) => {
    const profile = profileMap.get(member.user_id)
    return {
      id: member.user_id,
      name: profile?.full_name || profile?.email?.split('@')[0] || member.user_id,
      activeRegion: member.region_id ?? '',
      ...(member.region_id ? { regionId: member.region_id } : {}),
      capacity: 500,
    }
  })

  if (agents.length > 0) {
    const { error: upsertError } = await supabase!.from('sales_agents').upsert(
      agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        active_region: agent.activeRegion,
        region_id: (agent as any).regionId ?? null,
        capacity: agent.capacity,
        project_id: projectId,
      })),
    )
    if (upsertError) {
      console.warn('[DB] loadAgentsFromProjectMembers sales agent sync warning:', upsertError)
    }
  }

  return agents
}

//  SAVE 

/**
 * Upsert a single zone + replace its activities.
 * Local cache is written first, then Supabase is awaited when online.
 */
export async function saveZone(zone: Zone, projectId?: string): Promise<void> {
  const zonesKey = scopedKey('terrimap_zones', projectId)
  try {
    const stored = readJsonArray<Zone>(zonesKey)
    const idx = stored.findIndex((z) => z.id === zone.id)
    if (idx >= 0) stored[idx] = zone; else stored.push(zone)
    writeJsonArray(zonesKey, stored)
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    const row: Record<string, unknown> = {
      id:       zone.id,
      name:     zone.name,
      status:   zone.status,
      polygon:  zone.polygon,
      centroid: zone.centroid,
    }
    if ((zone as any).regionId) row.region_id = (zone as any).regionId
    if (projectId) row.project_id = projectId

    const { error: zErr } = await supabase!.from('zones').upsert(row)
    if (zErr) {
      console.error('[DB] saveZone upsert error:', zErr)
      return
    }

    await supabase!.from('activities').delete().eq('zone_id', zone.id)

    if (zone.activities.length > 0) {
      const { error: aErr } = await supabase!.from('activities').insert(
        zone.activities.map((a) => ({
          id:      a.id,
          zone_id: zone.id,
          type:    a.type,
          value:   a.value,
        })),
      )
      if (aErr) console.error('[DB] saveZone activities error:', aErr)
    }
  } catch (e) {
    console.error('[DB] saveZone unexpected error:', e)
  }
}

/**
 * Delete a zone and its activities/assignments (cascade).
 */
export async function deleteZone(zoneId: string, projectId?: string): Promise<void> {
  try {
    const zonesKey = scopedKey('terrimap_zones', projectId ?? _currentProjectId)
    const stored = readJsonArray<Zone>(zonesKey)
    writeJsonArray(zonesKey, stored.filter((z) => z.id !== zoneId))

    const assignmentsKey = scopedKey('terrimap_assignments', projectId ?? _currentProjectId)
    const storedAssignments = readJsonArray<Assignment>(assignmentsKey)
    writeJsonArray(assignmentsKey, storedAssignments.filter((a) => a.zoneId !== zoneId))
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    // assignments ON DELETE CASCADE handles automatically via FK,
    // but we delete explicitly for safety (in case RLS blocks cascade)
    let assignmentsQuery = supabase!.from('assignments').delete().eq('zone_id', zoneId)
    if (projectId ?? _currentProjectId) assignmentsQuery = assignmentsQuery.eq('project_id', projectId ?? _currentProjectId)
    await assignmentsQuery
    await supabase!.from('activities').delete().eq('zone_id', zoneId)
    let zoneQuery = supabase!.from('zones').delete().eq('id', zoneId)
    if (projectId ?? _currentProjectId) zoneQuery = zoneQuery.eq('project_id', projectId ?? _currentProjectId)
    const { error } = await zoneQuery
    if (error) console.error('[DB] deleteZone error:', error)
  } catch (e) {
    console.error('[DB] deleteZone unexpected error:', e)
  }
}

/**
 * Replace all assignments in DB with the given array.
 * Fire-and-forget.
 */
export async function saveAssignments(
  assignments: Assignment[],
  projectId?: string,
  replaceZoneIds?: string[],
): Promise<void> {
    for (const assignment of assignments) {
      if (!assignment.salesAgentId?.trim()) {
        throw new Error(`[DB] saveAssignments rejected: district ${assignment.districtId} is missing salesAgentId`)
      }
    }

  const assignmentsKey = scopedKey('terrimap_assignments', projectId)
  writeJsonArray(assignmentsKey, assignments)

  if (!isOnline()) return

  try {
    const replaceIds = replaceZoneIds?.filter(Boolean) ?? []

    if (assignments.length > 0) {
      const { error } = await supabase!.from('assignments').upsert(
        assignments.map((a) => ({
          zone_id:        a.zoneId,
          district_id:    a.districtId,
          sales_agent_id: a.salesAgentId,
          ...(projectId ? { project_id: projectId } : {}),
        })),
        { onConflict: 'zone_id' },
      )
      if (error) {
        console.error('[DB] saveAssignments upsert error:', error)
        throw error
      }
    }

    if (replaceIds.length > 0) {
      const keptZoneIds = new Set(assignments.map((assignment) => assignment.zoneId))
      const staleZoneIds = replaceIds.filter((zoneId) => !keptZoneIds.has(zoneId))
      if (staleZoneIds.length > 0) {
        let delQuery = supabase!.from('assignments').delete().in('zone_id', staleZoneIds)
        if (projectId) delQuery = delQuery.eq('project_id', projectId)
        const { error: deleteError } = await delQuery
        if (deleteError) {
          console.warn('[DB] saveAssignments stale delete warning:', deleteError)
        }
      }
    }
  } catch (e) {
    console.error('[DB] saveAssignments unexpected error:', e)
    throw e
  }
}

export async function saveSnapshot(
  id: string,
  label: string,
  data: { zones: Zone[]; assignments: Assignment[] } | object,
  period?: string,  // '2026-04' - tùy chọn, gắn tháng với snapshot
  projectId?: string,
  regionId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const scopedProjectId = projectId ?? _currentProjectId
  // LUÔN lưu localStorage (scoped by project)
  const key = scopedKey('terrimap_snapshots', scopedProjectId)
  try {
    const existing = readSnapshotCache(scopedProjectId) as unknown[]
    existing.unshift({
      id,
      label,
      data: { ...(data as Record<string, unknown>), regionId: regionId ?? null },
      period,
      created_at: new Date().toISOString(),
    })
    if (existing.length > 50) existing.pop()
    localStorage.setItem(key, JSON.stringify(existing))
    dispatchSnapshotChange(scopedProjectId, id)
  } catch (e) {
    console.error('[DB] saveSnapshot localStorage error:', e)
  }

  // If online -> sync to Supabase in background so the UI never waits on network.
  if (isOnline()) {
    try {
      const row: Record<string, unknown> = {
        id,
        label,
        data: { ...(data as Record<string, unknown>), regionId: regionId ?? null },
        period,
      }
      if (scopedProjectId) row.project_id = scopedProjectId
      void (async () => {
        try {
          const { error } = await supabase!.from('snapshots').upsert(row)
          if (error) {
            console.error('[DB] saveSnapshot supabase error:', error)
          }
        } catch (e) {
          console.error('[DB] saveSnapshot unexpected:', e)
        }
      })()
    } catch (e) {
      console.error('[DB] saveSnapshot unexpected:', e)
    }
  }
  return { ok: true }
}

export async function loadSnapshots(projectId?: string): Promise<Array<{
  id: string; label: string
  data: { zones: Zone[]; assignments: Assignment[]; regionId?: string | null }
  created_at: string
}>> {
  return loadSnapshotsForProject(projectId ?? _currentProjectId)
}

export async function loadSnapshotsForProject(projectId?: string): Promise<Array<{
  id: string; label: string
  data: { zones: Zone[]; assignments: Assignment[]; regionId?: string | null }
  created_at: string
}>> {

  const scopedProjectId = projectId ?? _currentProjectId
  const localSnaps = readSnapshotCache(scopedProjectId)

  if (!isOnline()) return localSnaps

  // Chế độ online: cũng đọc Supabase (lọc theo project) rồi ghép dữ liệu
  try {
    let query = supabase!
      .from('snapshots')
      .select('id, label, data, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (scopedProjectId) query = query.eq('project_id', scopedProjectId)

    const { data, error } = await query

    if (error || !data) return localSnaps

    // Merge: local wins on conflict
    const localIds = new Set(localSnaps.map((s: any) => s.id))
    const merged = [...localSnaps]
    for (const remote of data) {
      if (!localIds.has(remote.id)) merged.push(remote)
    }
    // Sort newest first
    merged.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return merged.slice(0, 50) as any
  } catch {
    return localSnaps
  }
}

/**
 * Delete a snapshot by id.
 * Removes localStorage first so the current session updates immediately,
 * then syncs Supabase in the background when online.
 */
export async function deleteSnapshot(id: string, projectId?: string): Promise<void> {
  const scopedProjectId = projectId ?? _currentProjectId
  const key = scopedKey('terrimap_snapshots', scopedProjectId)
  try {
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
    const filtered = existing.filter((s: any) => s?.id !== id)
    localStorage.setItem(key, JSON.stringify(filtered))
    dispatchSnapshotChange(scopedProjectId, id)
  } catch (e) {
    console.error('[DB] deleteSnapshot localStorage error:', e)
  }

  if (!isOnline()) return

  try {
    let query = supabase!.from('snapshots').delete().eq('id', id)
    if (scopedProjectId) {
      query = query.eq('project_id', scopedProjectId)
    }
    const { error } = await query
    if (error) {
      console.error('[DB] deleteSnapshot supabase error:', error)
    }
  } catch (e) {
    console.error('[DB] deleteSnapshot unexpected:', e)
  }
}

/**
 * Upsert (thêm hoặc cập nhật) một sales agent.
 */
export async function saveAgent(agent: SalesAgent, projectId?: string): Promise<void> {

  const agentKey = scopedKey('terrimap_agents', projectId)
  try {
    const stored = readJsonArray<SalesAgent>(agentKey)
    const idx = stored.findIndex((a) => a.id === agent.id)
    if (idx >= 0) stored[idx] = agent; else stored.push(agent)
    writeJsonArray(agentKey, stored)
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    const row: Record<string, unknown> = {
      id:            agent.id,
      name:          agent.name,
      active_region: agent.activeRegion,
      region_id:     agent.regionId ?? null,
      capacity:      agent.capacity,
    }
    if (projectId) row.project_id = projectId

    const { error } = await supabase!.from('sales_agents').upsert(row)
    if (error) console.error('[DB] saveAgent error:', error)
  } catch (e) {
    console.error('[DB] saveAgent unexpected:', e)
  }
}

/**
 * Xóa một sales agent. Cũng xóa assignments liên quan.
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const agentKey = lsKey('terrimap_agents')
  try {
    const stored = readJsonArray<SalesAgent>(agentKey)
    writeJsonArray(agentKey, stored.filter((a) => a.id !== agentId))
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    // Remove agent from assignments first
    await supabase!.from('assignments').delete().eq('sales_agent_id', agentId)
    const { error } = await supabase!.from('sales_agents').delete().eq('id', agentId)
    if (error) console.error('[DB] deleteAgent error:', error)
  } catch (e) {
    console.error('[DB] deleteAgent unexpected:', e)
  }
}

//  Regions 

export async function loadRegions(projectId?: string): Promise<Region[]> {

  const local = readScopedCollections<Region>('terrimap_regions', projectId)

  if (!isOnline()) return local.length > 0 ? local : (projectId ? [] : DEFAULT_REGIONS)

  try {
    let query = supabase!
      .from('regions')
      .select('*')
      .order('name')
    
    // Quan trọng: không bao giờ để vùng global/legacy rò vào project.

    if (projectId) query = query.eq('project_id', projectId)

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      if (local.length > 0) return local
      if (projectId) return []
      return DEFAULT_REGIONS
    }

    const remoteRegions: Region[] = (data as DbRegion[]).map((r): Region => ({
      id:     r.id,
      name:   r.name,
      ...(r.coordinator_id ? { coordinatorId: r.coordinator_id } : {}),
      center: r.center,
      zoom:   r.zoom,
    }))

    writeJsonArray(scopedKey('terrimap_regions', projectId), remoteRegions)
    return remoteRegions.sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  } catch {
    return local.length > 0 ? local : (projectId ? [] : DEFAULT_REGIONS)
  }
}

export async function saveRegion(region: Region, projectId?: string): Promise<void> {

  const regionKey = scopedKey('terrimap_regions', projectId)
  try {
    const stored = readJsonArray<Region>(regionKey)
    const idx = (stored as Region[]).findIndex((r) => r.id === region.id)
    if (idx >= 0) stored[idx] = region; else stored.push(region)
    writeJsonArray(regionKey, stored)
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    const row: Record<string, any> = {
      id:             region.id,
      name:           region.name,
      coordinator_id: region.coordinatorId ?? null,
      center:         region.center,
      zoom:           region.zoom,
    }
    const pId = projectId || _currentProjectId
    if (pId) {
      row.project_id = pId
    }

    const { error } = await supabase!.from('regions').upsert(row)
    if (error) console.error('[DB] saveRegion error:', error)
  } catch (e) {
    console.error('[DB] saveRegion unexpected:', e)
  }
}

/**
 * Delete a region from DB and localStorage.
 */
export async function deleteRegion(regionId: string, projectId?: string): Promise<void> {
  // Remove from localStorage
  const regionKey = scopedKey('terrimap_regions', projectId ?? _currentProjectId)
  try {
    const stored = readJsonArray<Region>(regionKey)
    writeJsonArray(regionKey, stored.filter((r) => r.id !== regionId))
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    let query = supabase!.from('regions').delete().eq('id', regionId)
    if (projectId ?? _currentProjectId) {
      query = query.eq('project_id', projectId ?? _currentProjectId)
    }
    const { error } = await query
    if (error) console.error('[DB] deleteRegion error:', error)
  } catch (e) {
    console.error('[DB] deleteRegion unexpected:', e)
  }
}


