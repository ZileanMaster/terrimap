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

export interface Profile {
  id: string
  email: string
  full_name: string
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
  clearError: () => void

  // Data actions
  initialize: () => Promise<void>
  loadProfile: () => Promise<void>
  loadProjects: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  createProject: (name: string, description?: string) => Promise<string | null>

  // Member management
  inviteMember: (email: string, role: string, regionId?: string) => Promise<boolean>
  updateMemberRole: (memberId: string, newRole: string) => Promise<boolean>
  removeMember: (memberId: string) => Promise<boolean>
  loadMembers: () => Promise<ProjectMember[]>
  updateProfile: (fullName: string) => Promise<boolean>
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
        // Load profile + projects in parallel (faster)
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
      // Load profile + projects in parallel
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
    if (!supabase) return
    await supabase.auth.signOut()
    localStorage.removeItem('terrimap_project')
    set({
      user: null,
      session: null,
      profile: null,
      projects: [],
      currentProjectId: null,
      membership: null,
    })
  },

  clearError: () => set({ authError: null }),

  // ── Load Profile ────────────────────────────────────────────────────────
  loadProfile: async () => {
    if (!supabase) return
    const user = get().user
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      set({ profile: data as Profile })
    }
  },

  // ── Load Projects (user is member of) ───────────────────────────────────
  loadProjects: async () => {
    if (!supabase) return
    const user = get().user
    if (!user) return

    // Get projects where user is owner OR member
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

    // Also fetch projects from membership (if not already owned)
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

    set({ currentProjectId: projectId })
    localStorage.setItem('terrimap_project', projectId)

    // Load membership (role)
    const { data } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (data) {
      set({ membership: data as ProjectMember })
    } else {
      // Check if user is owner (auto-admin)
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

    const { data, error } = await supabase
      .from('projects')
      .insert({ name, description, owner_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('[AuthStore] createProject error:', error)
      set({ authError: error.message })
      return null
    }

    const project = data as Project

    // Auto-add owner as admin member
    await supabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: user.id,
        role: 'admin',
      })

    await get().loadProjects()
    await get().selectProject(project.id)
    return project.id
  },

  // ── Invite Member ───────────────────────────────────────────────────────
  inviteMember: async (email, role, regionId) => {
    if (!supabase) { set({ authError: 'Không có kết nối cơ sở dữ liệu' }); return false }
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()

        if (profile) {
          profileId = profile.id
        } else {
          const { data: rpcResult } = await supabase
            .rpc('lookup_profile_by_email', { lookup_email: email })

          if (rpcResult && rpcResult.length > 0) {
            profileId = rpcResult[0].id
          }
        }

        if (!profileId) {
          set({ authError: `Không tìm thấy tài khoản với email: ${email}` })
          return false
        }

        // Check if already a member
        const { data: existing } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', profileId)
          .single()

        if (existing) {
          set({ authError: 'Người dùng đã là thành viên của dự án' })
          return false
        }

        const { error } = await supabase
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

    // Guard: if changing FROM admin, ensure at least 1 admin remains
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

    // Guard: if removing an admin, ensure at least 1 admin remains
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

  // ── Load Members ───────────────────────────────────────────────────────
  loadMembers: async () => {
    if (!supabase) return []
    const projectId = get().currentProjectId
    if (!projectId) return []

    const { data } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true })

    return (data ?? []) as ProjectMember[]
  },

  // ── Update Profile ───────────────────────────────────────────────────────
  updateProfile: async (fullName) => {
    if (!supabase) {
      // Offline mode: update mock profile in store
      const currentProfile = get().profile
      if (currentProfile) {
        set({ profile: { ...currentProfile, full_name: fullName } })
      } else {
        set({ profile: { id: 'mock-user', email: 'admin.test@terrimap.vn', full_name: fullName, avatar_url: null, created_at: new Date().toISOString() } })
      }
      return true
    }
    const user = get().user
    if (!user) return false
    set({ loading: true, authError: null })
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)
      if (error) {
        set({ authError: error.message, loading: false })
        return false
      }
      const currentProfile = get().profile
      if (currentProfile) {
        set({ profile: { ...currentProfile, full_name: fullName } })
      }
      set({ loading: false })
      return true
    } catch (e: any) {
      set({ authError: e?.message || 'Lỗi cập nhật thông tin', loading: false })
      return false
    }
  },
}))
