/**
 * src/services/db.ts — Database CRUD layer (Supabase ↔ App)
 *
 * All functions are async and gracefully fall back to MOCK data when
 * Supabase is not configured (VITE_SUPABASE_URL missing).
 *
 * SAVE functions are fire-and-forget (no await in callers) — UI updates
 * optimistically and DB syncs in background.
 *
 * Architecture note: This file lives in L4 (src/) and is the ONLY place
 * that touches Supabase. L0-L3 remain untouched.
 */

import { supabase, isOnline } from '../lib/supabase.js'
import { MOCK_ZONES, MOCK_ASSIGNMENTS } from '../data/mock-zones.js'
import { MOCK_AGENTS } from '../data/mock-agents.js'
import { DEFAULT_REGIONS, type Region } from '../data/regions.js'
import type { Zone, Assignment, SalesAgent } from '../../facades/viewmodels.js'
import { assertNoPolygonTopologyViolations } from '../../lib/geometry.js'


// ── Project-scoped localStorage key helper ────────────────────────────────────
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
  const scoped = readJsonArray<T>(scopedKey(base, projectId))
  if (scoped.length > 0) return scoped
  const legacy = readJsonArray<T>(base)
  return legacy
}

// ── DB row shapes (snake_case) ────────────────────────────────────────────────

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
  capacity:      number
}

interface DbRegion {
  id:             string
  name:           string
  coordinator_id: string | null
  center:         { lat: number; lng: number }
  zoom:           number
}

// ── LOAD ──────────────────────────────────────────────────────────────────────

/**
 * Load zones + activities from Supabase, optionally filtered by project.
 * Offline fallback: MOCK_ZONES.
 */
export async function loadZones(projectId?: string): Promise<Zone[]> {
  if (!isOnline()) return readScopedCollections<Zone>('terrimap_zones', projectId).length > 0
    ? readScopedCollections<Zone>('terrimap_zones', projectId)
    : MOCK_ZONES

  let query = supabase!.from('zones').select('*').order('id')
  if (projectId) query = query.eq('project_id', projectId)

  const { data: zoneData, error: zErr } = await query
  let zones = zoneData

  if (zErr || !zones || zones.length === 0) {
    if (zErr) console.error('[DB] loadZones error:', zErr)
    const cached = readScopedCollections<Zone>('terrimap_zones', projectId)
    if (cached.length > 0) return cached
    if (projectId) {
      const { data: legacyZones, error: legacyErr } = await supabase!
        .from('zones')
        .select('*')
        .is('project_id', null)
        .order('id')
      if (legacyErr) {
        console.error('[DB] loadZones legacy error:', legacyErr)
      } else if (legacyZones && legacyZones.length > 0) {
        zones = legacyZones as DbZone[]
      } else {
        return []
      }
    } else {
      return []
    }
  }

  // Load activities for these zones
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

  return loadedZones
}

/**
 * Load assignments, optionally filtered by project.
 * Offline fallback: MOCK_ASSIGNMENTS.
 */
export async function loadAssignments(projectId?: string): Promise<Assignment[]> {
  if (!isOnline()) return readScopedCollections<Assignment>('terrimap_assignments', projectId).length > 0
    ? readScopedCollections<Assignment>('terrimap_assignments', projectId)
    : MOCK_ASSIGNMENTS

  let query = supabase!.from('assignments').select('*')
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    if (error) console.error('[DB] loadAssignments error:', error)
    const cached = readScopedCollections<Assignment>('terrimap_assignments', projectId)
    if (cached.length > 0) return cached
    if (projectId) {
      const { data: legacyData, error: legacyErr } = await supabase!
        .from('assignments')
        .select('*')
        .is('project_id', null)
      if (legacyErr) {
        console.error('[DB] loadAssignments legacy error:', legacyErr)
        return []
      }
      if (legacyData && legacyData.length > 0) {
        return (legacyData as DbAssignment[]).map((a) => ({
          zoneId:       a.zone_id,
          districtId:   a.district_id,
          salesAgentId: a.sales_agent_id,
        }))
      }
    }
    return []
  }

  return (data as DbAssignment[]).map((a) => ({
    zoneId:       a.zone_id,
    districtId:   a.district_id,
    salesAgentId: a.sales_agent_id,
  }))
}

/**
 * Load sales agents (ordered canonical — OPEN-4), optionally filtered by project.
 * Offline fallback: MOCK_AGENTS.
 */
export async function loadAgents(projectId?: string): Promise<SalesAgent[]> {
  if (!isOnline()) return readScopedCollections<SalesAgent>('terrimap_agents', projectId).length > 0
    ? readScopedCollections<SalesAgent>('terrimap_agents', projectId)
    : MOCK_AGENTS

  // IMPORTANT: never leak demo/legacy (NULL project_id) agents into other projects.
  // In online mode, data must be project-scoped.
  let query = supabase!.from('sales_agents').select('*').order('id')
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    if (error) console.error('[DB] loadAgents error or empty:', error)
    const cached = readScopedCollections<SalesAgent>('terrimap_agents', projectId)
    if (cached.length > 0) return cached
    if (projectId) {
      const { data: legacyData, error: legacyErr } = await supabase!
        .from('sales_agents')
        .select('*')
        .is('project_id', null)
        .order('id')
      if (legacyErr) {
        console.error('[DB] loadAgents legacy error:', legacyErr)
        return []
      }
      if (legacyData && legacyData.length > 0) {
        return (legacyData as DbSalesAgent[]).map((a) => ({
          id:           a.id,
          name:         a.name,
          activeRegion: a.active_region,
          capacity:     a.capacity,
        }))
      }
    }
    return []
  }

  // Deduplicate by id — prefer the one WITH project_id
  const agentMap = new Map<string, DbSalesAgent>()
  for (const a of data as DbSalesAgent[]) {
    const existing = agentMap.get(a.id)
    if (!existing || (a as any).project_id) {
      agentMap.set(a.id, a)
    }
  }

  return Array.from(agentMap.values()).map((a) => ({
    id:           a.id,
    name:         a.name,
    activeRegion: a.active_region,
    capacity:     a.capacity,
  }))
}

// ── SAVE ──────────────────────────────────────────────────────────────────────

/**
 * Upsert a single zone + replace its activities.
 * Fire-and-forget — does not throw.
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
    void (async () => {
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
    })()
  } catch (e) {
    console.error('[DB] saveZone unexpected error:', e)
  }
}

/**
 * Delete a zone and its activities/assignments (cascade).
 * Fire-and-forget.
 */
export async function deleteZone(zoneId: string): Promise<void> {
  try {
    const zonesKey = lsKey('terrimap_zones')
    const stored = readJsonArray<Zone>(zonesKey)
    writeJsonArray(zonesKey, stored.filter((z) => z.id !== zoneId))

    const assignmentsKey = lsKey('terrimap_assignments')
    const storedAssignments = readJsonArray<Assignment>(assignmentsKey)
    writeJsonArray(assignmentsKey, storedAssignments.filter((a) => a.zoneId !== zoneId))
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    // assignments ON DELETE CASCADE handles automatically via FK,
    // but we delete explicitly for safety (in case RLS blocks cascade)
    await supabase!.from('assignments').delete().eq('zone_id', zoneId)
    await supabase!.from('activities').delete().eq('zone_id', zoneId)
    const { error } = await supabase!.from('zones').delete().eq('id', zoneId)
    if (error) console.error('[DB] deleteZone error:', error)
  } catch (e) {
    console.error('[DB] deleteZone unexpected error:', e)
  }
}

/**
 * Replace all assignments in DB with the given array.
 * Fire-and-forget.
 */
export async function saveAssignments(assignments: Assignment[], projectId?: string): Promise<void> {
  writeJsonArray(scopedKey('terrimap_assignments', projectId), assignments)

  if (!isOnline()) return

  try {
    void (async () => {
      try {
        let delQuery = supabase!.from('assignments').delete().neq('zone_id', '')
        if (projectId) delQuery = delQuery.eq('project_id', projectId)
        await delQuery

        if (assignments.length > 0) {
          const { error } = await supabase!.from('assignments').insert(
            assignments.map((a) => ({
              zone_id:        a.zoneId,
              district_id:    a.districtId,
              sales_agent_id: a.salesAgentId ?? `sa${a.districtId}`,
              ...(projectId ? { project_id: projectId } : {}),
            })),
          )
          if (error) console.error('[DB] saveAssignments error:', error)
        }
      } catch (e) {
        console.error('[DB] saveAssignments unexpected error:', e)
      }
    })()
  } catch (e) {
    console.error('[DB] saveAssignments unexpected error:', e)
  }
}

/**
 * Save a snapshot with full zones + assignments data.
 * Offline fallback: project-scoped localStorage.
 */
export async function saveSnapshot(
  id: string,
  label: string,
  data: { zones: Zone[]; assignments: Assignment[] } | object,
  period?: string,  // '2026-04' — optional, gắn tháng với snapshot
): Promise<{ ok: boolean; error?: string }> {
  // LUÔN lưu localStorage (scoped by project)
  const key = lsKey('terrimap_snapshots')
  try {
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
    existing.unshift({ id, label, data, period, created_at: new Date().toISOString() })
    if (existing.length > 50) existing.pop()
    localStorage.setItem(key, JSON.stringify(existing))
  } catch (e) {
    console.error('[DB] saveSnapshot localStorage error:', e)
  }

  // If online -> sync to Supabase in background so the UI never waits on network.
  if (isOnline()) {
    try {
      const row: Record<string, unknown> = { id, label, data, period }
      if (_currentProjectId) row.project_id = _currentProjectId
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

/**
 * Load snapshots with full data (newest first, max 50).
 * Offline fallback: localStorage.
 */
export async function loadSnapshots(): Promise<Array<{
  id: string; label: string
  data: { zones: Zone[]; assignments: Assignment[] }
  created_at: string
}>> {
  // Read project-scoped localStorage
  const key = lsKey('terrimap_snapshots')
  let localSnaps: any[] = []
  try {
    localSnaps = JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch { /* ignore */ }

  if (!isOnline()) return localSnaps

  // Online: also read Supabase (filtered by project) and merge
  try {
    let query = supabase!
      .from('snapshots')
      .select('id, label, data, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (_currentProjectId) query = query.eq('project_id', _currentProjectId)

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
  const key = scopedKey('terrimap_snapshots', projectId ?? _currentProjectId)
  try {
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
    const filtered = existing.filter((s: any) => s?.id !== id)
    localStorage.setItem(key, JSON.stringify(filtered))
  } catch (e) {
    console.error('[DB] deleteSnapshot localStorage error:', e)
  }

  if (!isOnline()) return

  try {
    let query = supabase!.from('snapshots').delete().eq('id', id)
    const scopedProjectId = projectId ?? _currentProjectId
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
  // Luôn update mock-agents trong localStorage (project-scoped)
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

// ── Regions ────────────────────────────────────────────────────────────────────

/**
 * Load regions, optionally filtered by project.
 */
export async function loadRegions(projectId?: string): Promise<Region[]> {
  // Load project-scoped localStorage overrides (coordinator assignments etc.)
  const local = readScopedCollections<Region>('terrimap_regions', projectId)

  if (!isOnline()) return local.length > 0 ? local : (projectId ? [] : DEFAULT_REGIONS)

  try {
    let query = supabase!
      .from('regions')
      .select('*')
      .order('name')
    
    // IMPORTANT: never leak global/legacy regions into a project.
    // In online mode, regions must be project-scoped.
    if (projectId) query = query.eq('project_id', projectId)

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      if (local.length > 0) return local
      if (projectId) {
        const { data: legacyData, error: legacyErr } = await supabase!
          .from('regions')
          .select('*')
          .is('project_id', null)
          .order('name')
        if (legacyErr) {
          console.error('[DB] loadRegions legacy error:', legacyErr)
        } else if (legacyData && legacyData.length > 0) {
          return (legacyData as DbRegion[]).map((r) => ({
            id:     r.id,
            name:   r.name,
            ...(r.coordinator_id ? { coordinatorId: r.coordinator_id } : {}),
            center: r.center,
            zoom:   r.zoom,
          }))
        }
        return []
      }
      return DEFAULT_REGIONS
    }

    return (data as DbRegion[]).map((r) => ({
      id:     r.id,
      name:   r.name,
      ...(r.coordinator_id ? { coordinatorId: r.coordinator_id } : {}),
      center: r.center,
      zoom:   r.zoom,
    }))
  } catch {
    return local.length > 0 ? local : (projectId ? [] : DEFAULT_REGIONS)
  }
}

/**
 * Save (upsert) a region. Also persists to localStorage.
 */
export async function saveRegion(region: Region, projectId?: string): Promise<void> {
  // Update project-scoped localStorage
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
export async function deleteRegion(regionId: string): Promise<void> {
  // Remove from localStorage
  const regionKey = lsKey('terrimap_regions')
  try {
    const stored = readJsonArray<Region>(regionKey)
    writeJsonArray(regionKey, stored.filter((r) => r.id !== regionId))
  } catch { /* ignore */ }

  if (!isOnline()) return

  try {
    const { error } = await supabase!.from('regions').delete().eq('id', regionId)
    if (error) console.error('[DB] deleteRegion error:', error)
  } catch (e) {
    console.error('[DB] deleteRegion unexpected:', e)
  }
}


