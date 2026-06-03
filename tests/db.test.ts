import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../src/lib/supabase.js', () => ({
  supabase: mockSupabase,
  isOnline: () => true,
}))

import { loadRegions } from '../src/services/db.js'

function mockQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.then = (resolve: (value: unknown) => void) => resolve({ data, error })
  return chain
}

describe('db.loadRegions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns no default regions for a new project', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'regions') {
        return mockQuery([])
      }
      return mockQuery([])
    })

    const regions = await loadRegions('project-new')

    expect(regions).toEqual([])
  })
})
