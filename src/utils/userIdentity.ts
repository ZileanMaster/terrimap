import type { User } from '@supabase/supabase-js'
import type { Profile } from '../store/authStore.js'
import type { SalesAgent } from '../../facades/viewmodels.js'

type IdentitySource = Pick<User, 'id' | 'email'> | null | undefined

export function getUserIdentityCandidates(
  user: IdentitySource,
  profile: Pick<Profile, 'id' | 'email'> | null | undefined,
): string[] {
  return [
    profile?.email,
    user?.email,
    profile?.id,
    user?.id,
  ].filter((value): value is string => Boolean(value && value.trim()))
}

/**
 * Resolve the most likely user key used by project data.
 *
 * We prefer email first because sales/reports assignments in TerriMap often
 * use email-shaped ids. If the loaded project data contains a different
 * identifier, we still fall back to the first value that actually matches one
 * of the current project agents.
 */
export function resolveUserKey(
  user: IdentitySource,
  profile: Pick<Profile, 'id' | 'email'> | null | undefined,
  agents: SalesAgent[] = [],
): string {
  const candidates = getUserIdentityCandidates(user, profile)

  if (candidates.length === 0) return ''

  if (agents.length > 0) {
    const agentIds = new Set(agents.map((agent) => agent.id))
    const matched = candidates.find((candidate) => agentIds.has(candidate))
    if (matched) return matched
  }

  return candidates[0] ?? ''
}
