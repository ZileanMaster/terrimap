import { describe, expect, it } from 'vitest'
import { resolveUserKey } from '../src/utils/userIdentity.js'

describe('resolveUserKey', () => {
  it('prefers project agent email when it matches current user', () => {
    const agents = [{ id: 'sales.test@terrimap.vn' }, { id: 'other@terrimap.vn' }] as any
    const key = resolveUserKey(
      { id: 'uuid-123', email: 'sales.test@terrimap.vn' } as any,
      { id: 'profile-1', email: 'sales.test@terrimap.vn' } as any,
      agents,
    )
    expect(key).toBe('sales.test@terrimap.vn')
  })

  it('falls back to the first usable identity when no agent match exists', () => {
    const key = resolveUserKey(
      { id: 'uuid-123', email: 'sales.test@terrimap.vn' } as any,
      { id: 'profile-1', email: 'sales.test@terrimap.vn' } as any,
      [],
    )
    expect(key).toBe('sales.test@terrimap.vn')
  })
})
