import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'
import type { User, Session } from '@supabase/supabase-js'
import { useDataStore } from './dataStore.js'
import { useUIStore } from './uiStore.js'

export interface Profile {
  id: string
  email: string
  full_name: string
  date_of_birth?: string | null
  phone?: string | null
  avatar_url: string | null
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'admin' | 'coordinator' | 'sales'
  region_id: string | null
  joined_at: string
  status?: 'active' | 'blocked' | string | null
  blocked_reason?: string | null
  blocked_at?: string | null
  blocked_by?: string | null
  unblocked_at?: string | null
  profile?: {
    id: string
    email: string
    full_name: string
    date_of_birth?: string | null
    phone?: string | null
  } | null
}

interface AuthStore {
  // State
  user: User | null
  session: Session | null
  profile: Profile | null
  projects: Project[]
  currentProjectId: string | null
  membership: ProjectMember | null
  loading: boolean
  authError: string | null

  // Auth actions
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>
  signOut: () => Promise<void>
  deselectProject: () => void
  clearError: () => void

  // Data actions
  initialize: () => Promise<void>
  loadProfile: () => Promise<void>
  loadProjects: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  createProject: (name: string, description?: string) => Promise<string | null>
  updateProject: (projectId: string, data: { name: string; description?: string }) => Promise<boolean>
  deleteProject: (projectId: string) => Promise<boolean>

  // Quản lý thành viên
  inviteMember: (email: string, role: string, regionId?: string) => Promise<boolean>
  updateMemberRole: (memberId: string, newRole: string) => Promise<boolean>
  removeMember: (memberId: string) => Promise<boolean>
  blockMember: (memberId: string, reason?: string) => Promise<boolean>
  unblockMember: (memberId: string) => Promise<boolean>
  loadMembers: (includeBlocked?: boolean) => Promise<ProjectMember[]>
  updateProfile: (data: string | { full_name: string; date_of_birth?: string | null; phone?: string | null }) => Promise<boolean>
}

function normalizeDateInput(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return trimmed.slice(0, 10)
}

const DEFAULT_PROJECT_ID = 'test-project-terrimap'
const DEFAULT_PROJECT_OWNER_EMAIL = 'admin.test@terrimap.vn'
const PROJECT_MEMBER_SELECT_COLUMNS = 'id, project_id, user_id, role, region_id, joined_at, status, blocked_reason, blocked_at, blocked_by, unblocked_at'
const PROJECT_MEMBER_CACHE_TTL_MS = 30_000

type CachedProjectMembers = {
  rows: ProjectMember[]
  fetchedAt: number
}

const projectMembersCache = new Map<string, CachedProjectMembers>()
const projectMembersInFlight = new Map<string, Promise<ProjectMember[]>>()

function getCachedProjectMembers(projectId: string): ProjectMember[] | null {
  const cached = projectMembersCache.get(projectId)
  if (!cached) return null
  if (Date.now() - cached.fetchedAt > PROJECT_MEMBER_CACHE_TTL_MS) return null
  return cached.rows
}

function setCachedProjectMembers(projectId: string, rows: ProjectMember[]): void {
  projectMembersCache.set(projectId, { rows, fetchedAt: Date.now() })
}

function invalidateProjectMembersCache(projectId: string): void {
  projectMembersCache.delete(projectId)
  projectMembersInFlight.delete(projectId)
}

async function resolveDefaultProject(): Promise<Project | null> {
  if (!supabase) return null

  const { data: fixedProject } = await supabase
    .from('projects')
    .select('id, name, description, owner_id, created_at')
    .eq('id', DEFAULT_PROJECT_ID)
    .maybeSingle()

  if (fixedProject) return fixedProject as Project

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', DEFAULT_PROJECT_OWNER_EMAIL)
    .maybeSingle()

  if (!adminProfile?.id) return null

  const { data: adminProject } = await supabase
    .from('projects')
    .select('id, name, description, owner_id, created_at')
    .eq('owner_id', adminProfile.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (adminProject as Project | null) ?? null
}

async function pickFallbackProject(projects: Project[]): Promise<string | null> {
  return pickInitialProject(projects)
}

function isBlockedMember(member?: Pick<ProjectMember, 'status'> | null): boolean {
  return member?.status === 'blocked'
}

async function syncSalesAgentMembership(member: ProjectMember, projectId: string, active: boolean): Promise<void> {
  if (!supabase || member.role !== 'sales') return

  if (!active) {
    await supabase.from('assignments').delete().eq('sales_agent_id', member.user_id)
    await supabase.from('sales_agents').delete().eq('id', member.user_id)
    return
  }

  const [{ data: profile }, { data: region }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', member.user_id)
      .maybeSingle(),
    member.region_id
      ? supabase
          .from('regions')
          .select('id, name')
          .eq('id', member.region_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const activeRegionName = (region as any)?.name ?? ''
  const { error } = await supabase.from('sales_agents').upsert({
    id: member.user_id,
    name: (profile as any)?.full_name || (profile as any)?.email?.split('@')[0] || 'Sales Agent',
    active_region: activeRegionName,
    capacity: 500,
    region_id: member.region_id ?? null,
    project_id: projectId,
  })

  if (error) {
    console.warn('[AuthStore] syncSalesAgentMembership warning:', error)
  }
}

async function ensureDefaultProjectMembership(userId: string): Promise<void> {
  if (!supabase) return

  const defaultProject = await resolveDefaultProject()
  if (!defaultProject) return

  
  const { data: existing } = await supabase
    .from('project_members')
    .select(PROJECT_MEMBER_SELECT_COLUMNS)
    .eq('project_id', defaultProject.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (isBlockedMember(existing as unknown as ProjectMember)) {
    if (defaultProject.owner_id !== userId) return

    const { error: restoreError } = await supabase
      .from('project_members')
      .upsert({
        project_id: defaultProject.id,
        user_id: userId,
        role: 'admin',
        region_id: null,
        status: 'active',
      }, { onConflict: 'project_id,user_id' })

    if (restoreError) {
      console.warn('[AuthStore] ensureDefaultProjectMembership restore warning:', restoreError)
    } else {
      invalidateProjectMembersCache(defaultProject.id)
    }
    return
  }
  if (existing) return

  const { error } = await supabase
    .from('project_members')
    .upsert({
      project_id: defaultProject.id,
      user_id: userId,
      role: defaultProject.owner_id === userId ? 'admin' : 'sales',
      region_id: null,
      status: 'active',
    }, { onConflict: 'project_id,user_id' })

  if (error) {
    console.warn('[AuthStore] ensureDefaultProjectMembership warning:', error)
  } else {
    invalidateProjectMembersCache(defaultProject.id)
  }
}

function pickInitialProject(projects: Project[]): string | null {
  const lastProject = localStorage.getItem('terrimap_project')
  const preferred = [lastProject, DEFAULT_PROJECT_ID]

  for (const projectId of preferred) {
    if (projectId && projects.some((project) => project.id === projectId)) {
      return projectId
    }
  }

  return projects[0]?.id ?? null
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  projects: [],
  currentProjectId: null,
  membership: null,
  loading: true,
  authError: null,

  // Kiểm tra session khi khởi động
  initialize: async () => {
    if (!supabase) {
      set({ loading: false })
      return
    }

    // 8s hard timeout: if Supabase is slow/down, show login instead of infinite splash
    const timeout = setTimeout(() => {
      console.warn('[AuthStore] initialize timeout (8s) - showing login')
      set({ loading: false })
    }, 8_000)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user, session })
        await ensureDefaultProjectMembership(session.user.id)
        await Promise.all([
          get().loadProfile(),
          get().loadProjects(),
        ])

        const nextProjectId = await pickFallbackProject(get().projects)
        if (nextProjectId) {
          await get().selectProject(nextProjectId)
        }
      }
    } catch (e) {
      console.error('[AuthStore] initialize error:', e)
    } finally {
      clearTimeout(timeout)
      set({ loading: false })
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ user: session?.user ?? null, session })
      if (!session) {
        set({ profile: null, projects: [], currentProjectId: null, membership: null })
      } else {
        await ensureDefaultProjectMembership(session.user.id)
        await get().loadProfile()
        await get().loadProjects()
        const nextProjectId = await pickFallbackProject(get().projects)
        if (nextProjectId && get().currentProjectId !== nextProjectId) {
          await get().selectProject(nextProjectId)
        }
      }
    })
  },

  //  Sign In 
  //  Sign In 
  signIn: async (email, password) => {
    if (!supabase) {
      set({ authError: 'Supabase ch?a ???c c?u h?nh' })
      return false
    }
    set({ authError: null, loading: true })

    // 10s timeout: prevent infinite spinner
    const timeout = setTimeout(() => {
      set({ authError: '??ng nh?p qu? l?u. Vui l?ng th? l?i.', loading: false })
    }, 10_000)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        clearTimeout(timeout)
        set({ authError: error.message, loading: false })
        return false
      }

      set({ user: data.user, session: data.session })
      if (data.user) {
        await ensureDefaultProjectMembership(data.user.id)
      }
      await Promise.all([
        get().loadProfile(),
        get().loadProjects(),
      ])
      const nextProjectId = await pickFallbackProject(get().projects)
      if (nextProjectId) {
        await get().selectProject(nextProjectId)
      }
      clearTimeout(timeout)
      set({ loading: false })
      return true
    } catch (e: any) {
      clearTimeout(timeout)
      set({ authError: e?.message || 'L?i ??ng nh?p', loading: false })
      return false
    }
  },

  //  Sign Up 
  //  Sign Up 
  signUp: async (email, password, fullName) => {
    if (!supabase) {
      set({ authError: 'Supabase ch?a ???c c?u h?nh' })
      return false
    }
    set({ authError: null, loading: true })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) {
      set({ authError: error.message, loading: false })
      return false
    }

    // If session is null, email confirmation is required
    if (!data.session) {
      set({
        authError: 'T?i kho?n ?? ???c t?o. Vui l?ng ki?m tra email v? x?c nh?n t?i kho?n, sau ?? ??ng nh?p l?i.',
        loading: false,
      })
      return false
    }

    set({ user: data.user, session: data.session })
    if (data.user) {
      await ensureDefaultProjectMembership(data.user.id)
    }

    // Wait for the trigger to create the profile (retry loop instead of brittle setTimeout)
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(r => setTimeout(r, 300))
      await get().loadProfile()
      if (get().profile) break
    }
    await get().loadProjects()
    const nextProjectId = await pickFallbackProject(get().projects)
    if (nextProjectId) {
      await get().selectProject(nextProjectId)
    }
    set({ loading: false })
    return true
  },

  //  Sign Out 
  //  Sign Out 
  signOut: async () => {
    localStorage.removeItem('terrimap_project')
    set({
      user: null,
      session: null,
      profile: null,
      projects: [],
      currentProjectId: null,
      membership: null,
      authError: null,
    })

    if (!supabase) return

    const timeout = setTimeout(() => {
      console.warn('[AuthStore] signOut timeout - local state already cleared')
    }, 5_000)

    try {
      void supabase.auth.signOut()
        .catch((error) => {
          console.warn('[AuthStore] signOut background error:', error)
        })
        .finally(() => clearTimeout(timeout))
    } catch (error) {
      clearTimeout(timeout)
      console.warn('[AuthStore] signOut unexpected error:', error)
    }
  },

  deselectProject: () => {
    localStorage.removeItem('terrimap_project')
    set({
      currentProjectId: null,
      membership: null,
    })
  },

  clearError: () => set({ authError: null }),

  //  Tải profile 
  loadProfile: async () => {
    if (!supabase) return
    const user = get().user
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,avatar_url,created_at,date_of_birth,phone')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      set({ profile: data as Profile })
    }
  },

  //  Tải projects (nơi user là thành viên) 
  loadProjects: async () => {
    if (!supabase) return
    const user = get().user
    if (!user) return

    const { data: memberData } = await supabase
      .from('project_members')
      .select(PROJECT_MEMBER_SELECT_COLUMNS)
      .eq('user_id', user.id)

    const memberProjectIds = (memberData ?? [])
      .filter((member: any) => !isBlockedMember(member))
      .map((m: any) => m.project_id)

    const { data: ownedProjects } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', user.id)

    const owned = (ownedProjects ?? []) as Project[]

    let memberProjects: Project[] = []
    if (memberProjectIds.length > 0) {
      const ownedIds = new Set(owned.map(p => p.id))
      const otherIds = memberProjectIds.filter(id => !ownedIds.has(id))
      if (otherIds.length > 0) {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .in('id', otherIds)
        memberProjects = (data ?? []) as Project[]
      }
    }

    const mergedProjects = [...owned, ...memberProjects]
    if (mergedProjects.length === 0) {
      const fallbackProject = await resolveDefaultProject()
      if (fallbackProject) {
        const blockedDefaultProject = (memberData ?? []).some((member: any) =>
          member.project_id === fallbackProject.id && isBlockedMember(member),
        )
        if (!blockedDefaultProject) {
          mergedProjects.push(fallbackProject)
        }
      }
    }

    set({ projects: mergedProjects })
  },

  //  Select Project 
  selectProject: async (projectId) => {
    if (!supabase) return
    const user = get().user
    if (!user) return
    
    const project = get().projects.find((p) => p.id === projectId)
    const { data } = await supabase
      .from('project_members')
      .select(PROJECT_MEMBER_SELECT_COLUMNS)
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()

    const isOwner = project?.owner_id === user.id

    if (isBlockedMember(data as unknown as ProjectMember) && !isOwner) {
      set({
        authError: 'Tài khoản đang bị hạn chế trong dự án này',
        membership: null,
      })
      if (get().currentProjectId === projectId) {
        set({ currentProjectId: null })
        localStorage.removeItem('terrimap_project')
      }
      return
    }

    useDataStore.getState().setCurrentRegion(null)
    set({ currentProjectId: projectId, membership: null, authError: null })
    if (isOwner) {
      useUIStore.getState().setRole('admin')
    }
    localStorage.setItem('terrimap_project', projectId)
    void get().loadMembers(true)

    if (data && !(isOwner && isBlockedMember(data as unknown as ProjectMember))) {
      set({ membership: data as unknown as ProjectMember })
    } else {

      const projects = get().projects
      const project = projects.find(p => p.id === projectId)
      if (project?.owner_id === user.id) {
        set({
          membership: {
            id: 'owner',
            project_id: projectId,
            user_id: user.id,
            role: 'admin',
            region_id: null,
            joined_at: new Date().toISOString(),
          },
        })
      }
    }
  },

  //  Create Project 
  createProject: async (name, description = '') => {
    void name
    void description
    set({ authError: 'Tạo dự án mới đang tạm tắt. Mọi tài khoản mới sẽ tự động vào dự án mặc định.' })
    return null
  },

  updateProject: async (projectId, data) => {
    const user = get().user
    const project = get().projects.find((item) => item.id === projectId)
    if (!user || !project) return false
    if (project.owner_id !== user.id) {
      set({ authError: 'Chỉ chủ dự án mới có thể sửa thông tin dự án' })
      return false
    }

    const updatedProject: Project = {
      ...project,
      name: data.name.trim(),
      description: data.description?.trim() ?? '',
    }

    set((state) => ({
      projects: state.projects.map((item) => (item.id === projectId ? updatedProject : item)),
      authError: null,
    }))

    if (!supabase) return true

    void (async () => {
      try {
        const { error } = await supabase
          .from('projects')
          .upsert(updatedProject, { onConflict: 'id' })

        if (error) {
          console.warn('[AuthStore] updateProject sync warning:', error)
        }
      } catch (error) {
        console.warn('[AuthStore] updateProject unexpected:', error)
      }
    })()

    return true
  },

  deleteProject: async (projectId) => {
    const user = get().user
    const project = get().projects.find((item) => item.id === projectId)
    if (!user || !project) return false
    if (project.owner_id !== user.id) {
      set({ authError: 'Chỉ chủ dự án mới có thể xoá dự án' })
      return false
    }

    if (get().currentProjectId === projectId) {
      get().deselectProject()
      useDataStore.getState().setCurrentRegion(null)
    }

    set((state) => ({
      projects: state.projects.filter((item) => item.id !== projectId),
      authError: null,
    }))

    if (!supabase) return true

    void (async () => {
      try {
        const { error: membersError } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)

        if (membersError) {
          console.warn('[AuthStore] deleteProject members warning:', membersError)
        }

        const { error: projectError } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId)

        if (projectError) {
          console.warn('[AuthStore] deleteProject project warning:', projectError)
        }
      } catch (error) {
        console.warn('[AuthStore] deleteProject unexpected:', error)
      }
    })()

    return true
  },

  //  Invite Member 
  inviteMember: async (email, role, regionId) => {
    if (!supabase) { set({ authError: 'Không có kết nối cơ sở dữ liệu' }); return false }
    const client = supabase
    const projectId = get().currentProjectId
    if (!projectId) { set({ authError: 'Chưa chọn dự án' }); return false }

    try {
      // 8s timeout for all DB operations
      const deadline = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8_000),
      )

      const doInvite = async (): Promise<boolean> => {
        // Find user by email - try direct query first, fallback to RPC
        let profileId: string | null = null

        const { data: profile } = await client
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()

        if (profile) {
          profileId = profile.id
        } else {
          const { data: rpcResult } = await client
            .rpc('lookup_profile_by_email', { lookup_email: email })

          if (rpcResult && rpcResult.length > 0) {
            profileId = rpcResult[0].id
          }
        }

        if (!profileId) {
          set({ authError: `Không tìm thấy tài khoản với email: ${email}` })
          return false
        }


        const { data: existing } = await client
          .from('project_members')
          .select(PROJECT_MEMBER_SELECT_COLUMNS)
          .eq('project_id', projectId)
          .eq('user_id', profileId)
          .maybeSingle()

        if (existing) {
          if (isBlockedMember(existing as unknown as ProjectMember)) {
            set({ authError: 'Người dùng đang bị hạn chế trong dự án này. Hãy bỏ chặn trước khi mời lại.' })
            return false
          }
          set({ authError: 'Người dùng đã là thành viên của dự án' })
          return false
        }

        const { error } = await client
          .from('project_members')
          .insert({
            project_id: projectId,
            user_id: profileId,
            role,
            region_id: regionId || null,
            status: 'active',
          })

        if (error) {
          set({ authError: error.message })
          return false
        }

        return true
      }

      return await Promise.race([doInvite(), deadline])
    } catch (e: any) {
      const msg = e?.message === 'TIMEOUT'
        ? 'Thao tác quá lâu (8s). Vui lòng thử lại.'
        : `Lỗi: ${e?.message ?? 'Không xác định'}`
      set({ authError: msg })
      return false
    }
  },

  //  Update Member Role 
  updateMemberRole: async (memberId, newRole) => {
    if (!supabase) return false
    const projectId = get().currentProjectId
    if (!projectId) return false

    const { data: member } = await supabase
      .from('project_members')
      .select(PROJECT_MEMBER_SELECT_COLUMNS)
      .eq('id', memberId)
      .single()

    if ((member as any)?.status === 'blocked') {
      set({ authError: 'Vui lòng bỏ chặn thành viên trước khi đổi vai trò' })
      return false
    }

    if ((member as any)?.role === 'admin' && newRole !== 'admin') {
      const { data: adminMembers } = await supabase
        .from('project_members')
        .select(PROJECT_MEMBER_SELECT_COLUMNS)
        .eq('project_id', projectId)
        .eq('role', 'admin')

      const activeAdminCount = (adminMembers ?? []).filter((item: any) => !isBlockedMember(item)).length
      if (activeAdminCount <= 1) {
        set({ authError: 'Phải có ít nhất 1 quản trị viên trong dự án' })
        return false
      }
    }

    const { error } = await supabase
      .from('project_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (error) {
      set({ authError: error.message })
      return false
    }
    invalidateProjectMembersCache(projectId)
    return true
  },

  //  Remove Member 
  removeMember: async (memberId) => {
    if (!supabase) return false
    const projectId = get().currentProjectId
    if (!projectId) return false

    const { data: member } = await supabase
      .from('project_members')
      .select(PROJECT_MEMBER_SELECT_COLUMNS)
      .eq('id', memberId)
      .single()

    if ((member as any)?.role === 'admin') {
      const { data: adminMembers } = await supabase
        .from('project_members')
        .select(PROJECT_MEMBER_SELECT_COLUMNS)
        .eq('project_id', projectId)
        .eq('role', 'admin')

      const activeAdminCount = (adminMembers ?? []).filter((item: any) => !isBlockedMember(item)).length
      if (activeAdminCount <= 1) {
        set({ authError: 'Không thể xóa quản trị viên duy nhất' })
        return false
      }
    }

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      set({ authError: error.message })
      return false
    }
    invalidateProjectMembersCache(projectId)
    return true
  },

  blockMember: async (memberId, reason = '') => {
    if (!supabase) return false
    const projectId = get().currentProjectId
    const actor = get().user
    if (!projectId || !actor) return false
    const { data: member } = await supabase
      .from('project_members')
      .select(PROJECT_MEMBER_SELECT_COLUMNS)
      .eq('id', memberId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (!member) {
      set({ authError: 'Không tìm thấy thành viên cần hạn chế' })
      return false
    }

    if (isBlockedMember(member as unknown as ProjectMember)) {
      set({ authError: 'Thành viên này đã bị hạn chế' })
      return false
    }

    if ((member as any)?.role === 'admin') {
      const { data: adminMembers } = await supabase
        .from('project_members')
        .select(PROJECT_MEMBER_SELECT_COLUMNS)
        .eq('project_id', projectId)
        .eq('role', 'admin')

      const activeAdminCount = (adminMembers ?? []).filter((item: any) => !isBlockedMember(item)).length
      if (activeAdminCount <= 1) {
        set({ authError: 'Phải có ít nhất 1 quản trị viên trong dự án' })
        return false
      }
    }

    const { error } = await supabase
      .from('project_members')
      .update({
        status: 'blocked',
        blocked_reason: reason.trim() || null,
        blocked_at: new Date().toISOString(),
        blocked_by: actor.id,
        unblocked_at: null,
      })
      .eq('id', memberId)

    if (error) {
      set({ authError: error.message })
      return false
    }

    await syncSalesAgentMembership(member as unknown as ProjectMember, projectId, false)
    invalidateProjectMembersCache(projectId)
    return true
  },

  unblockMember: async (memberId) => {
    if (!supabase) return false
    const projectId = get().currentProjectId
    if (!projectId) return false
    const { data: member } = await supabase
      .from('project_members')
      .select(PROJECT_MEMBER_SELECT_COLUMNS)
      .eq('id', memberId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (!member) {
      set({ authError: 'Không tìm thấy thành viên cần bỏ chặn' })
      return false
    }

    if (!isBlockedMember(member as unknown as ProjectMember)) {
      return true
    }

    const { error } = await supabase
      .from('project_members')
      .update({
        status: 'active',
        unblocked_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    if (error) {
      set({ authError: error.message })
      return false
    }

    await syncSalesAgentMembership(member as unknown as ProjectMember, projectId, true)
    invalidateProjectMembersCache(projectId)
    return true
  },

  //  Tải thành viên 
  loadMembers: async (includeBlocked = false) => {
    if (!supabase) return []
    const client = supabase
    const projectId = get().currentProjectId
    if (!projectId) return []

    const cachedMembers = getCachedProjectMembers(projectId)
    if (cachedMembers) {
      return includeBlocked
        ? cachedMembers
        : cachedMembers.filter((member) => !isBlockedMember(member))
    }

    const existingRequest = projectMembersInFlight.get(projectId)
    if (existingRequest) {
      const rows = await existingRequest
      return includeBlocked
        ? rows
        : rows.filter((member) => !isBlockedMember(member))
    }

    const memberRequest = (async (): Promise<ProjectMember[]> => {
      const localProject = get().projects.find((p) => p.id === projectId)

      const [memberResult, remoteProjectResult] = await Promise.all([
        client
          .from('project_members')
          .select(PROJECT_MEMBER_SELECT_COLUMNS)
          .eq('project_id', projectId)
          .order('joined_at', { ascending: true }),
        localProject
          ? Promise.resolve({ data: localProject, error: null })
          : client
              .from('projects')
              .select('id, name, description, owner_id, created_at')
              .eq('id', projectId)
              .maybeSingle(),
      ])

      const { data, error } = memberResult
      if (error) {
        console.warn('[AuthStore] loadMembers error:', error.message)
        return []
      }

      let members = (data ?? []) as ProjectMember[]
      const project = (remoteProjectResult as any)?.data ?? localProject ?? null

      if (project?.owner_id) {
        const ownerExists = members.some((member) => member.user_id === project.owner_id)
        if (!ownerExists) {
          const ownerMember = {
            project_id: projectId,
            user_id: project.owner_id,
            role: 'admin' as const,
            region_id: null,
            joined_at: project.created_at ?? new Date().toISOString(),
            status: 'active' as const,
            profile: null,
          }

          const { error: repairError } = await client
            .from('project_members')
            .upsert(ownerMember, { onConflict: 'project_id,user_id' })

          if (!repairError) {
            const { data: repaired } = await client
              .from('project_members')
              .select(PROJECT_MEMBER_SELECT_COLUMNS)
              .eq('project_id', projectId)
              .order('joined_at', { ascending: true })

            members = (repaired ?? []) as ProjectMember[]
          } else {
            console.warn('[AuthStore] owner membership repair warning:', repairError.message)
            members = [
              {
                id: `owner-${projectId}`,
                ...ownerMember,
              },
              ...members,
            ] as ProjectMember[]
          }
        }
      }

      setCachedProjectMembers(projectId, members)
      return members
    })()

    projectMembersInFlight.set(projectId, memberRequest)
    try {
      const members = await memberRequest
      return includeBlocked
        ? members
        : members.filter((member) => !isBlockedMember(member))
    } finally {
      projectMembersInFlight.delete(projectId)
    }
  },

  //  Update Profile 

  updateProfile: async (data) => {
    const payload = typeof data === 'string'
      ? { full_name: data }
      : {
          full_name: data.full_name,
          date_of_birth: normalizeDateInput(data.date_of_birth),
          phone: data.phone ?? null,
        }
    if (!supabase) {
      // Offline mode: update mock profile in store
      const currentProfile = get().profile
      if (currentProfile) {
        set({ profile: { ...currentProfile, ...payload } })
      } else {
        set({
          profile: {
            id: 'mock-user',
            email: 'admin.test@terrimap.vn',
            full_name: payload.full_name,
            date_of_birth: (payload as any).date_of_birth ?? null,
            phone: (payload as any).phone ?? null,
            avatar_url: null,
            created_at: new Date().toISOString(),
          },
        })
      }
      return true
    }
    const user = get().user
    if (!user) return false
    const currentProfile = get().profile
    const profileId = currentProfile?.id ?? user.id
    const profileEmail = currentProfile?.email ?? user.email ?? ''
    const profilePatch = {
      id: profileId,
      email: profileEmail,
      full_name: payload.full_name,
      date_of_birth: payload.date_of_birth ?? null,
      phone: payload.phone ?? null,
    }
    const optimisticProfile: Profile = {
      ...(currentProfile ?? {
        id: profileId,
        email: profileEmail,
        avatar_url: null,
        created_at: new Date().toISOString(),
      }),
      ...profilePatch,
    } as Profile


    // auth/session flows (initialize/signIn/signUp), not ordinary profile updates.
    set({ authError: null, profile: optimisticProfile })

    void (async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert(profilePatch, { onConflict: 'id' })

        if (error) {
          console.warn('[AuthStore] updateProfile sync warning:', error)
          set({ authError: error.message })
        }
      } catch (e: any) {
        console.warn('[AuthStore] updateProfile unexpected:', e)
        set({ authError: e?.message || 'Lỗi cập nhật thông tin' })
      }
    })()

    return true
  },
}))


