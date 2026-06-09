/**
 * src/store/authStore.ts — Auth + Project Zustand store
 *
 * Manages:
 * - Supabase Auth session (sign in / sign up / sign out)
 * - User profile (from `profiles` table)
 * - Project membership (from `project_members` table)
 * - Current project context
 *
 * Flow:
 * 1. User signs in → session established
 * 2. loadProfile() → fetch from profiles table
 * 3. loadProjects() → fetch all projects user belongs to
 * 4. selectProject(id) → load membership (role) for that project
 */

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

  // Member management
  inviteMember: (email: string, role: string, regionId?: string) => Promise<boolean>
  updateMemberRole: (memberId: string, newRole: string) => Promise<boolean>
  removeMember: (memberId: string) => Promise<boolean>
  loadMembers: () => Promise<ProjectMember[]>
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

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  projects: [],
  currentProjectId: null,
  membership: null,
  loading: true,
  authError: null,

  // ── Initialize: check existing session ──────────────────────────────────
  initialize: async () => {
    if (!supabase) {
      set({ loading: false })
      return
    }

    // 8s hard timeout: if Supabase is slow/down, show login instead of infinite splash
    const timeout = setTimeout(() => {
      console.warn('[AuthStore] initialize timeout (8s) — showing login')
      set({ loading: false })
    }, 8_000)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user, session })
        // Tải profile + projects song song (nhanh hơn)
        await Promise.all([
          get().loadProfile(),
          get().loadProjects(),
        ])

        // Auto-select last used project from localStorage
        const lastProject = localStorage.getItem('terrimap_project')
        if (lastProject) {
          const projects = get().projects
          if (projects.some(p => p.id === lastProject)) {
            await get().selectProject(lastProject)
          }
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
        await get().loadProfile()
        await get().loadProjects()
      }
    })
  },

  // ── Sign In ─────────────────────────────────────────────────────────────
  signIn: async (email, password) => {
    if (!supabase) {
      set({ authError: 'Supabase chưa được cấu hình' })
      return false
    }
    set({ authError: null, loading: true })

    // 10s timeout: prevent infinite spinner
    const timeout = setTimeout(() => {
      set({ authError: 'Đăng nhập quá lâu. Vui lòng thử lại.', loading: false })
    }, 10_000)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        clearTimeout(timeout)
        set({ authError: error.message, loading: false })
        return false
      }

      set({ user: data.user, session: data.session })
      // Tải profile + projects song song
      await Promise.all([
        get().loadProfile(),
        get().loadProjects(),
      ])
      clearTimeout(timeout)
      set({ loading: false })
      return true
    } catch (e: any) {
      clearTimeout(timeout)
      set({ authError: e?.message || 'Lỗi đăng nhập', loading: false })
      return false
    }
  },

  // ── Sign Up ─────────────────────────────────────────────────────────────
  signUp: async (email, password, fullName) => {
    if (!supabase) {
      set({ authError: 'Supabase chưa được cấu hình' })
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
        authError: 'Tài khoản đã được tạo. Vui lòng kiểm tra email và xác nhận tài khoản, sau đó đăng nhập lại.',
        loading: false,
      })
      return false
    }

    set({ user: data.user, session: data.session })

    // Wait for the trigger to create the profile (retry loop instead of brittle setTimeout)
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(r => setTimeout(r, 300))
      await get().loadProfile()
      if (get().profile) break
    }
    await get().loadProjects()
    set({ loading: false })
    return true
  },

  // ── Sign Out ────────────────────────────────────────────────────────────
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
      console.warn('[AuthStore] signOut timeout — local state already cleared')
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

  // ── Tải profile ─────────────────────────────────────────────────────────
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

  // ── Tải projects (nơi user là thành viên) ───────────────────────────────
  loadProjects: async () => {
    if (!supabase) return
    const user = get().user
    if (!user) return

    // L?y c?c project m? user l? ch? s? h?u HO?C th?nh vi?n
    const { data: memberData } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const memberProjectIds = (memberData ?? []).map(m => m.project_id)

    const { data: ownedProjects } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', user.id)

    const owned = (ownedProjects ?? []) as Project[]

    // ??ng th?i l?y project t? membership (n?u ch?a s? h?u)
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

    set({ projects: [...owned, ...memberProjects] })
  },

  // ── Select Project ──────────────────────────────────────────────────────
  selectProject: async (projectId) => {
    if (!supabase) return
    const user = get().user
    if (!user) return

    useDataStore.getState().setCurrentRegion(null)
    set({ currentProjectId: projectId, membership: null })
    const project = get().projects.find((p) => p.id === projectId)
    if (project?.owner_id === user.id) {
      useUIStore.getState().setRole('admin')
    }
    localStorage.setItem('terrimap_project', projectId)

    // Tải membership (vai trò)
    const { data } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (data) {
      set({ membership: data as ProjectMember })
    } else {
      // Ki?m tra user c? ph?i ch? d? ?n kh?ng (t? ??ng l? admin)
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

  // ── Create Project ──────────────────────────────────────────────────────
  createProject: async (name, description = '') => {
    if (!supabase) return null
    const user = get().user
    if (!user) return null

    const projectId = globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const project: Project = {
      id: projectId,
      name,
      description,
      owner_id: user.id,
      created_at: new Date().toISOString(),
    }

    localStorage.setItem('terrimap_project', project.id)
    useDataStore.getState().setCurrentRegion(null)
    useUIStore.getState().setRole('admin')
    set((state) => ({
      projects: state.projects.some((p) => p.id === project.id)
        ? state.projects
        : [...state.projects, project],
      currentProjectId: project.id,
      membership: {
        id: 'owner',
        project_id: project.id,
        user_id: user.id,
        role: 'admin',
        region_id: null,
        joined_at: new Date().toISOString(),
      },
      authError: null,
    }))

    void (async () => {
      try {
        const { error: projectError } = await supabase
          .from('projects')
          .upsert(project, { onConflict: 'id' })

        if (projectError) {
          console.warn('[AuthStore] createProject project sync warning:', projectError)
          return
        }

        const { error: memberError } = await supabase
          .from('project_members')
          .upsert({
            project_id: project.id,
            user_id: user.id,
            role: 'admin',
          }, { onConflict: 'project_id,user_id' })

        if (memberError) {
          console.warn('[AuthStore] createProject member sync warning:', memberError)
        }
      } catch (error) {
        console.warn('[AuthStore] createProject member sync unexpected:', error)
      }
    })()

    return project.id
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

  // ── Invite Member ───────────────────────────────────────────────────────
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
        // Find user by email — try direct query first, fallback to RPC
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

        // Ki?m tra xem ?? l? th?nh vi?n ch?a
        const { data: existing } = await client
          .from('project_members')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', profileId)
          .single()

        if (existing) {
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

  // ── Update Member Role ──────────────────────────────────────────────────
  updateMemberRole: async (memberId, newRole) => {
    if (!supabase) return false
    const projectId = get().currentProjectId
    if (!projectId) return false

    // Guard: n?u ??i T? admin, ??m b?o c?n ?t nh?t 1 admin
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('id', memberId)
      .single()

    if (member?.role === 'admin' && newRole !== 'admin') {
      const { count } = await supabase
        .from('project_members')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('role', 'admin')

      if ((count ?? 0) <= 1) {
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
    return true
  },

  // ── Remove Member ──────────────────────────────────────────────────────
  removeMember: async (memberId) => {
    if (!supabase) return false
    const projectId = get().currentProjectId
    if (!projectId) return false

    // Guard: n?u x?a admin, ??m b?o c?n ?t nh?t 1 admin
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('id', memberId)
      .single()

    if (member?.role === 'admin') {
      const { count } = await supabase
        .from('project_members')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('role', 'admin')

      if ((count ?? 0) <= 1) {
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
    return true
  },

  // ── Tải thành viên ──────────────────────────────────────────────────────
  loadMembers: async () => {
    if (!supabase) return []
    const client = supabase
    const projectId = get().currentProjectId
    if (!projectId) return []

    const readMembers = async (): Promise<ProjectMember[]> => {
      const { data, error } = await client
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true })

      if (error) {
        console.warn('[AuthStore] loadMembers error:', error.message)
        return []
      }

      return (data ?? []) as ProjectMember[]
    }

    const loadProjectById = async (): Promise<Project | null> => {
      const localProject = get().projects.find((p) => p.id === projectId)
      if (localProject) return localProject

      const { data: remoteProject, error } = await client
        .from('projects')
        .select('id, name, description, owner_id, created_at')
        .eq('id', projectId)
        .maybeSingle()

      if (error) {
        console.warn('[AuthStore] loadMembers project lookup warning:', error)
        return null
      }

      return (remoteProject as Project | null) ?? null
    }

    let members = await readMembers()
    const project = await loadProjectById()

    if (project?.owner_id) {
      const ownerExists = members.some((member) => member.user_id === project.owner_id)
      if (!ownerExists) {
        const ownerMember = {
          project_id: projectId,
          user_id: project.owner_id,
          role: 'admin' as const,
          region_id: null,
          joined_at: project.created_at ?? new Date().toISOString(),
        }

        const { error: repairError } = await client
          .from('project_members')
          .upsert(ownerMember, { onConflict: 'project_id,user_id' })

        if (!repairError) {
          members = await readMembers()
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

    return members
  },

  // ── Update Profile ───────────────────────────────────────────────────────
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
    // Kh?ng ???c b?t/t?t `loading` to?n c?c cho ch?nh s?a profile.
    // `loading` ?i?u khi?n splash to?n m?n h?nh trong App.tsx v? ph?i d?nh cho
    // auth/session flows (initialize/signIn/signUp), not ordinary profile updates.
    set({ authError: null })
    try {
      const selectFields = 'id,email,full_name,avatar_url,created_at,date_of_birth,phone'

      const updateResult = await supabase
        .from('profiles')
        .update(profilePatch)
        .eq('id', profileId)
        .select(selectFields)
        .maybeSingle()

      if (!updateResult.error && updateResult.data) {
        set({ profile: updateResult.data as Profile })
        return true
      }

      const upsertResult = await supabase
        .from('profiles')
        .upsert(profilePatch, { onConflict: 'id' })
        .select(selectFields)
        .maybeSingle()

      if (upsertResult.error) {
        set({ authError: upsertResult.error.message })
        return false
      }

      if (upsertResult.data) {
        set({ profile: upsertResult.data as Profile })
        return true
      }

      set({
        profile: {
          ...(currentProfile ?? {
            id: profileId,
            email: profileEmail,
            avatar_url: null,
            created_at: new Date().toISOString(),
          }),
          ...profilePatch,
        } as Profile,
      })
      return true
    } catch (e: any) {
      set({ authError: e?.message || 'Lỗi cập nhật thông tin' })
      return false
    }
  },
}))
