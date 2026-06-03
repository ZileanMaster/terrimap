/**
 * src/store/authStore.ts â€” Auth + Project Zustand store
 *
 * Manages:
 * - Supabase Auth session (sign in / sign up / sign out)
 * - User profile (from `profiles` table)
 * - Project membership (from `project_members` table)
 * - Current project context
 *
 * Flow:
 * 1. User signs in â†’ session established
 * 2. loadProfile() â†’ fetch from profiles table
 * 3. loadProjects() â†’ fetch all projects user belongs to
 * 4. selectProject(id) â†’ load membership (role) for that project
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'
import type { User, Session } from '@supabase/supabase-js'

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

  // â”€â”€ Initialize: check existing session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  initialize: async () => {
    if (!supabase) {
      set({ loading: false })
      return
    }

    // 8s hard timeout: if Supabase is slow/down, show login instead of infinite splash
    const timeout = setTimeout(() => {
      console.warn('[AuthStore] initialize timeout (8s) â€” showing login')
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

  // â”€â”€ Sign In â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  signIn: async (email, password) => {
    if (!supabase) {
      set({ authError: 'Supabase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh' })
      return false
    }
    set({ authError: null, loading: true })

    // 10s timeout: prevent infinite spinner
    const timeout = setTimeout(() => {
      set({ authError: 'ÄÄƒng nháº­p quÃ¡ lÃ¢u. Vui lÃ²ng thá»­ láº¡i.', loading: false })
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
      set({ authError: e?.message || 'Lá»—i Ä‘Äƒng nháº­p', loading: false })
      return false
    }
  },

  // â”€â”€ Sign Up â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  signUp: async (email, password, fullName) => {
    if (!supabase) {
      set({ authError: 'Supabase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh' })
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
        authError: 'TÃ i khoáº£n Ä‘Ã£ Ä‘Æ°á»£c táº¡o. Vui lÃ²ng kiá»ƒm tra email vÃ  xÃ¡c nháº­n tÃ i khoáº£n, sau Ä‘Ã³ Ä‘Äƒng nháº­p láº¡i.',
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

  // â”€â”€ Sign Out â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Load Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Load Projects (user is member of) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Select Project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Create Project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Invite Member â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  inviteMember: async (email, role, regionId) => {
    if (!supabase) { set({ authError: 'KhÃ´ng cÃ³ káº¿t ná»‘i cÆ¡ sá»Ÿ dá»¯ liá»‡u' }); return false }
    const client = supabase
    const projectId = get().currentProjectId
    if (!projectId) { set({ authError: 'ChÆ°a chá»n dá»± Ã¡n' }); return false }

    try {
      // 8s timeout for all DB operations
      const deadline = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8_000),
      )

      const doInvite = async (): Promise<boolean> => {
        // Find user by email â€” try direct query first, fallback to RPC
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
          set({ authError: `KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n vá»›i email: ${email}` })
          return false
        }

        // Check if already a member
        const { data: existing } = await client
          .from('project_members')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', profileId)
          .single()

        if (existing) {
          set({ authError: 'NgÆ°á»i dÃ¹ng Ä‘Ã£ lÃ  thÃ nh viÃªn cá»§a dá»± Ã¡n' })
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
        ? 'Thao tÃ¡c quÃ¡ lÃ¢u (8s). Vui lÃ²ng thá»­ láº¡i.'
        : `Lá»—i: ${e?.message ?? 'KhÃ´ng xÃ¡c Ä‘á»‹nh'}`
      set({ authError: msg })
      return false
    }
  },

  // â”€â”€ Update Member Role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        set({ authError: 'Pháº£i cÃ³ Ã­t nháº¥t 1 quáº£n trá»‹ viÃªn trong dá»± Ã¡n' })
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

  // â”€â”€ Remove Member â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        set({ authError: 'KhÃ´ng thá»ƒ xÃ³a quáº£n trá»‹ viÃªn duy nháº¥t' })
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

  // â”€â”€ Load Members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Update Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Do not toggle global `loading` for profile edits.
    // `loading` drives the full-page splash in App.tsx and must be reserved for
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
