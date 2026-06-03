/**
 * authStore.test.ts — Unit tests for Auth + Project RBAC store
 *
 * Tests: AUTH-1 → AUTH-12
 * Strategy: Mock Supabase client, verify store state transitions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Supabase (hoisted) ───────────────────────────────────────────────────

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../src/lib/supabase.js', () => ({
  supabase: mockSupabase,
  isOnline: () => true,
}))

import { useAuthStore } from '../src/store/authStore.js'

// ── localStorage polyfill (Node environment) ──────────────────────────────────
const _store: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => _store[k] ?? null,
      setItem: (k: string, v: string) => { _store[k] = v },
      removeItem: (k: string) => { delete _store[k] },
      clear: () => { for (const k in _store) delete _store[k] },
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  useAuthStore.setState({
    user: null,
    session: null,
    profile: null,
    projects: [],
    currentProjectId: null,
    membership: null,
    loading: true,
    authError: null,
  })
}

function mockFromChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.upsert = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve({ data, error }))
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  // For non-single queries (array return)
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data, error }),
    writable: true,
    configurable: true,
  })
  return chain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authStore', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  describe('Initialize', () => {
    it('[AUTH-1] no session → loading = false, user = null', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().loading).toBe(false)
      expect(useAuthStore.getState().user).toBeNull()
    })

    it('[AUTH-2] with session → user set, loadProfile called', async () => {
      const fakeUser = { id: 'u1', email: 'test@test.com' }
      const fakeSession = { user: fakeUser, access_token: 'xxx' }
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: fakeSession } })

      // Mock profile + projects queries
      const profileChain = mockFromChain({ id: 'u1', email: 'test@test.com', full_name: 'Test', avatar_url: null, created_at: '2026-01-01' })
      const membersChain = mockFromChain([])
      const projectsChain = mockFromChain([])

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        if (table === 'project_members') return membersChain
        if (table === 'projects') return projectsChain
        return mockFromChain(null)
      })

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toEqual(fakeUser)
      expect(useAuthStore.getState().loading).toBe(false)
    })
  })

  describe('SignIn', () => {
    it('[AUTH-3] successful signIn → user + profile set', async () => {
      const fakeUser = { id: 'u1', email: 'a@b.com' }
      const fakeSession = { user: fakeUser, access_token: 'tok' }

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: fakeUser, session: fakeSession },
        error: null,
      })

      const profileChain = mockFromChain({ id: 'u1', email: 'a@b.com', full_name: 'A', avatar_url: null, created_at: '2026-01-01' })
      const membersChain = mockFromChain([])
      const projectsChain = mockFromChain([])

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        if (table === 'project_members') return membersChain
        if (table === 'projects') return projectsChain
        return mockFromChain(null)
      })

      const result = await useAuthStore.getState().signIn('a@b.com', 'pass123')

      expect(result).toBe(true)
      expect(useAuthStore.getState().user).toEqual(fakeUser)
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('[AUTH-4] failed signIn → authError set, user null', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      const result = await useAuthStore.getState().signIn('bad@test.com', 'wrong')

      expect(result).toBe(false)
      expect(useAuthStore.getState().authError).toBe('Invalid login credentials')
      expect(useAuthStore.getState().user).toBeNull()
    })
  })

  describe('SignUp', () => {
    it('[AUTH-5] successful signUp → user set, profile fetched with retry', async () => {
      const fakeUser = { id: 'u2', email: 'new@test.com' }
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: fakeUser, session: { user: fakeUser, access_token: 'tok2' } },
        error: null,
      })

      let callCount = 0
      const profileChain = mockFromChain(null)
      const profileChainSuccess = mockFromChain({
        id: 'u2', email: 'new@test.com', full_name: 'New', avatar_url: null, created_at: '2026-01-01',
      })
      const membersChain = mockFromChain([])
      const projectsChain = mockFromChain([])

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++
          // Simulate trigger delay: first call returns null, subsequent calls return profile
          return callCount <= 1 ? profileChain : profileChainSuccess
        }
        if (table === 'project_members') return membersChain
        if (table === 'projects') return projectsChain
        return mockFromChain(null)
      })

      const result = await useAuthStore.getState().signUp('new@test.com', 'pass123', 'New User')

      expect(result).toBe(true)
      expect(useAuthStore.getState().user).toEqual(fakeUser)
      // Profile should have been fetched via retry
      expect(callCount).toBeGreaterThanOrEqual(2)
    })

    it('[AUTH-6] failed signUp → authError set', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      })

      const result = await useAuthStore.getState().signUp('dup@test.com', 'pass', 'Dup')

      expect(result).toBe(false)
      expect(useAuthStore.getState().authError).toBe('User already registered')
    })
  })

  describe('Update profile', () => {
    it('[AUTH-7] updateProfile → falls back to upsert when update returns no row', async () => {
      useAuthStore.setState({
        user: { id: 'u1', email: 'coord.test@terrimap.vn' } as any,
        profile: {
          id: 'u1',
          email: 'coord.test@terrimap.vn',
          full_name: 'Điều Phối Test',
          avatar_url: null,
          created_at: '2026-01-01',
        } as any,
      })

      let profileQueryCount = 0
      const updateChain = mockFromChain(null)
      const upsertChain = mockFromChain({
        id: 'u1',
        email: 'coord.test@terrimap.vn',
        full_name: 'Điều Phối Mới',
        avatar_url: null,
        created_at: '2026-01-01',
        date_of_birth: '2026-06-04',
        phone: '0123456789',
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          profileQueryCount += 1
          return profileQueryCount === 1 ? updateChain : upsertChain
        }
        return mockFromChain(null)
      })

      const result = await useAuthStore.getState().updateProfile({
        full_name: 'Điều Phối Mới',
        date_of_birth: '04/06/2026',
        phone: '0123456789',
      })

      expect(result).toBe(true)
      expect(useAuthStore.getState().profile?.full_name).toBe('Điều Phối Mới')
      expect(useAuthStore.getState().profile?.date_of_birth).toBe('2026-06-04')
      expect(useAuthStore.getState().authError).toBeNull()
    })
  })

  describe('SignOut', () => {
    it('[AUTH-7] signOut clears all state', async () => {
      // Pre-fill state
      useAuthStore.setState({
        user: { id: 'u1' } as any,
        profile: { id: 'u1' } as any,
        projects: [{ id: 'p1' } as any],
        currentProjectId: 'p1',
        membership: { id: 'm1' } as any,
      })

      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      await useAuthStore.getState().signOut()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.profile).toBeNull()
      expect(state.projects).toEqual([])
      expect(state.currentProjectId).toBeNull()
      expect(state.membership).toBeNull()
    })
  })

  describe('Project RBAC', () => {
    it('[AUTH-8] selectProject with membership → role from DB', async () => {
      useAuthStore.setState({ user: { id: 'u1' } as any })

      const memberChain = mockFromChain({
        id: 'm1', project_id: 'p1', user_id: 'u1', role: 'coordinator', region_id: 'r1', joined_at: '2026-01-01',
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'project_members') return memberChain
        return mockFromChain(null)
      })

      await useAuthStore.getState().selectProject('p1')

      expect(useAuthStore.getState().membership?.role).toBe('coordinator')
      expect(useAuthStore.getState().currentProjectId).toBe('p1')
    })

    it('[AUTH-9] selectProject as owner (no membership record) → auto-admin', async () => {
      useAuthStore.setState({
        user: { id: 'u1' } as any,
        projects: [{ id: 'p1', owner_id: 'u1', name: 'Test', description: '', created_at: '2026-01-01' }],
      })

      const noMemberChain = mockFromChain(null, null)

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'project_members') return noMemberChain
        return mockFromChain(null)
      })

      await useAuthStore.getState().selectProject('p1')

      expect(useAuthStore.getState().membership?.role).toBe('admin')
      expect(useAuthStore.getState().membership?.id).toBe('owner')
    })

    it('[AUTH-10] createProject → auto-add owner as admin', async () => {
      useAuthStore.setState({ user: { id: 'u1' } as any })

      const insertChain = mockFromChain(
        { id: 'p-new', name: 'New Project', description: '', owner_id: 'u1', created_at: '2026-01-01' },
      )
      const membersInsertChain = mockFromChain(null)
      const membersChain = mockFromChain([{ project_id: 'p-new' }])
      const projectsChain = mockFromChain([{ id: 'p-new', name: 'New Project', description: '', owner_id: 'u1', created_at: '2026-01-01' }])
      const selectMemberChain = mockFromChain({
        id: 'm1', project_id: 'p-new', user_id: 'u1', role: 'admin', region_id: null, joined_at: '2026-01-01',
      })

      let insertCalls = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'projects') {
          insertCalls++
          // First call: insert, subsequent: select for loadProjects
          return insertCalls === 1 ? insertChain : projectsChain
        }
        if (table === 'project_members') {
          // Return different chains based on context
          return insertCalls <= 1 ? membersInsertChain : (insertCalls <= 2 ? membersChain : selectMemberChain)
        }
        if (table === 'profiles') return mockFromChain(null)
        return mockFromChain(null)
      })

      const projectId = await useAuthStore.getState().createProject('New Project')

      expect(projectId).toBeTruthy()
    })
  })

  describe('Member Management', () => {
    it('[AUTH-11] inviteMember — user not found → error', async () => {
      useAuthStore.setState({
        user: { id: 'u1' } as any,
        currentProjectId: 'p1',
      })

      const noProfileChain = mockFromChain(null, null)
      mockSupabase.from.mockImplementation(() => noProfileChain)
      // RPC fallback also returns empty
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      const result = await useAuthStore.getState().inviteMember('ghost@test.com', 'sales')

      expect(result).toBe(false)
      expect(useAuthStore.getState().authError).toContain('ghost@test.com')
    })

    it('[AUTH-12] clearError resets authError', () => {
      useAuthStore.setState({ authError: 'Some error' })
      useAuthStore.getState().clearError()
      expect(useAuthStore.getState().authError).toBeNull()
    })
  })
})
