/**
 * src/store/dataStore.ts — Kho dữ liệu Zustand toàn cục
 *
 * Single source of truth cho zones, assignments, agents.
 * Dùng chung giữa AdminPage, CoordinatorPage, SalesPage — không bị mất
 * khi chuyển tab vì Zustand store sống ngoài React component tree.
 *
 * Init chỉ chạy 1 lần (được chặn bằng cờ `initialized`).
 * Các thao tác lưu sẽ chờ DB hoàn tất để đảm bảo tính toàn vẹn dữ liệu.
 */

import { create } from 'zustand'
import type { Zone, Assignment, SalesAgent } from '../../facades/viewmodels.js'
import {
  loadZones, loadAssignments, loadAgents,
  saveZone, saveAssignments,
  deleteZone as dbDeleteZone,
  saveAgent, deleteAgent,
  loadRegions, saveRegion, deleteRegion as dbDeleteRegion,
  setActiveProject,
} from '../services/db.js'
import { MOCK_ZONES, MOCK_ASSIGNMENTS } from '../data/mock-zones.js'
import { MOCK_AGENTS } from '../data/mock-agents.js'
import type { Region } from '../data/regions.js'
import { assertNoPolygonTopologyViolations } from '../../lib/geometry.js'

interface DataStore {
  // ── State ──────────────────────────────────────────────────────────────────────
  zones:           Zone[]
  assignments:     Assignment[]
  agents:          SalesAgent[]
  regions:         Region[]       // danh sách vùng
  currentRegionId: string | null  // vùng đang xem / lọc
  currentProjectId: string | undefined       // project ?ang t?i d? li?u
  loading:         boolean
  initialized:     boolean  // true sau l?n t?i th?nh c?ng ??u ti?n
  saving:          boolean  // true while awaiting DB write

  // ── Actions ────────────────────────────────────────────────────────────────

  /** T?i t? DB cho project ?? cho. Reset d? li?u khi ??i project. */
  init: (projectId?: string) => Promise<void>

  /** Bulk setters (used by SnapshotManager restore) */
  setZones:       (zones: Zone[]) => void
  setAssignments: (assignments: Assignment[]) => void

  /** Regions management */
  setRegions:       (regions: Region[]) => void
  setCurrentRegion: (regionId: string | null) => void
  updateRegion:     (region: Region) => Promise<void>
  addRegion:        (name: string, center: { lat: number; lng: number }, zoom: number) => Promise<Region>
  deleteRegion:     (regionId: string) => Promise<void>

  /** Await save, then update state (prevents tab-switch data loss) */
  addZone:    (zone: Zone) => Promise<void>
  removeZone: (zoneId: string) => Promise<void>
  updateZone: (zone: Zone) => Promise<void>

  /** Replace all assignments + await DB persist */
  persistAssignments: (assignments: Assignment[]) => Promise<void>

  addAgent:    (agent: SalesAgent) => Promise<void>
  updateAgent: (agent: SalesAgent) => Promise<void>
  removeAgent: (agentId: string)   => Promise<void>
}

export const useDataStore = create<DataStore>((set, get) => ({
  zones:           [],
  assignments:     [],
  agents:          [],
  regions:         [],
  currentRegionId: null,
  currentProjectId: undefined,
  loading:         true,
  initialized:     false,
  saving:          false,

  init: async (projectId) => {
    const prev = get().currentProjectId
    // If same project already initialized, skip
    if (get().initialized && prev === projectId) return
    // ??t project hi?n t?i cho ph?m vi localStorage TR??C m?i l?n t?i
    setActiveProject(projectId)
    // Reset on project change
    set({ loading: true, initialized: false, currentProjectId: projectId })
    try {
      // 10s timeout: if Supabase queries hang, fallback to mock data
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Data load timeout (10s)')), 10_000),
      )
      const [z, a, ag, rg] = await Promise.race([
        Promise.all([
          loadZones(projectId),
          loadAssignments(projectId),
          loadAgents(projectId),
          loadRegions(projectId),
        ]),
        timeout,
      ]) as [typeof MOCK_ZONES, typeof MOCK_ASSIGNMENTS, typeof MOCK_AGENTS, never[]]
      // Gi? nguy?n regionId; null = ch?a g?n (kh?ng ?p m?c ??nh)
      set({ zones: z, assignments: a, agents: ag, regions: rg })
    } catch (e) {
      console.error('[DataStore] init error:', e)
      // Important: never leak MOCK data into real accounts/projects when online.
      // Ch? ?? offline ???c x? l? trong services/db.ts khi Supabase ch?a c?u h?nh.
      set({ zones: [], assignments: [], agents: [], regions: [] })
    } finally {
      set({ loading: false, initialized: true })
    }
  },

  setZones:       (zones)       => set({ zones }),
  setAssignments: (assignments) => set({ assignments }),
  setRegions:     (regions)     => set({ regions }),
  setCurrentRegion: (currentRegionId) => set({ currentRegionId }),

  updateRegion: async (region) => {
    set((s) => ({
      regions: s.regions.map((r) => r.id === region.id ? region : r),
    }))
    await saveRegion(region, get().currentProjectId)
  },

  addRegion: async (name, center, zoom) => {
    const region: Region = {
      id:     `region-${Date.now()}`,
      name:   name.trim(),
      center,
      zoom,
    }
    set((s) => ({ regions: [...s.regions, region] }))
    await saveRegion(region, get().currentProjectId)
    return region
  },

  deleteRegion: async (regionId) => {
    set((s) => ({
      regions: s.regions.filter((r) => r.id !== regionId),
      // Bỏ chọn nếu vùng bị xóa đang là vùng hiện tại
      currentRegionId: s.currentRegionId === regionId ? null : s.currentRegionId,
    }))
    await dbDeleteRegion(regionId)
  },

  addZone: async (zone) => {
    assertNoPolygonTopologyViolations([...get().zones, zone] as any)
    // Optimistic update first so map renders immediately
    set((s) => ({ zones: [...s.zones, zone], saving: true }))
    await saveZone(zone, get().currentProjectId)  // await — ensures DB write before tab switch
    set({ saving: false })
  },

  removeZone: async (zoneId) => {
    set((s) => ({
      zones:       s.zones.filter((z) => z.id !== zoneId),
      assignments: s.assignments.filter((a) => a.zoneId !== zoneId),
      saving:      true,
    }))
    await dbDeleteZone(zoneId)
    set({ saving: false })
  },

  updateZone: async (zone) => {
    assertNoPolygonTopologyViolations(
      get().zones.map((z) => z.id === zone.id ? zone : z) as any,
    )
    // State is source of truth — update immediately, DB syncs async
    set((s) => ({
      zones: s.zones.map((z) => z.id === zone.id ? zone : z),
    }))
    await saveZone(zone, get().currentProjectId)
  },

  persistAssignments: async (assignments) => {
    set({ assignments, saving: true })
    await saveAssignments(assignments, get().currentProjectId)
    set({ saving: false })
  },

  addAgent: async (agent) => {
    set((s) => ({ agents: [...s.agents, agent] }))
    await saveAgent(agent, get().currentProjectId)
  },

  updateAgent: async (agent) => {
    set((s) => ({
      agents: s.agents.map((a) => a.id === agent.id ? agent : a),
    }))
    await saveAgent(agent, get().currentProjectId)
  },

  removeAgent: async (agentId) => {
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== agentId),
      // Xóa agent khỏi assignments
      assignments: s.assignments.map((a) =>
        a.salesAgentId === agentId ? { ...a, salesAgentId: '' } : a,
      ),
    }))
    await deleteAgent(agentId)
  },
}))
