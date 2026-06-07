import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../src/lib/supabase.js', () => ({
  supabase: mockSupabase,
  isOnline: () => true,
}))

import { deleteSnapshot, loadSnapshots, saveSnapshot } from '../src/services/db.js'

function createLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value)
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
}

function makeSnapshotQuery(data: unknown[] = [], error: unknown = null) {
  const chain: Record<string, any> = {}
  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.upsert = vi.fn(async () => ({ error: null }))
  chain.then = (resolve: (value: { data: unknown[]; error: unknown }) => void) => {
    resolve({ data, error })
  }
  return chain
}

describe('snapshot persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', createLocalStorageMock())
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'snapshots') return makeSnapshotQuery([])
      return makeSnapshotQuery([])
    })
  })

  it('stores and reloads snapshots by project', async () => {
    await saveSnapshot(
      'snap-1',
      'Bản lưu 1',
      { zones: [{ id: 'z1' }], assignments: [] },
      '2026-06',
      'project-a',
    )

    await Promise.resolve()

    const snapshots = await loadSnapshots('project-a')

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.id).toBe('snap-1')
    expect(snapshots[0]?.label).toBe('Bản lưu 1')
    expect(globalThis.localStorage.getItem('terrimap_snapshots_project-a')).not.toBeNull()
  })

  it('keeps snapshots isolated between projects', async () => {
    await saveSnapshot(
      'snap-1',
      'Bản lưu 1',
      { zones: [{ id: 'z1' }], assignments: [] },
      '2026-06',
      'project-a',
    )

    await Promise.resolve()

    const snapshots = await loadSnapshots('project-b')
    expect(snapshots).toEqual([])
  })

  it('deletes only the current project snapshot', async () => {
    await saveSnapshot(
      'snap-1',
      'Bản lưu 1',
      { zones: [{ id: 'z1' }], assignments: [] },
      '2026-06',
      'project-a',
    )
    await Promise.resolve()

    await deleteSnapshot('snap-1', 'project-a')
    const snapshots = await loadSnapshots('project-a')
    expect(snapshots).toEqual([])
  })
})
