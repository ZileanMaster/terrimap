/**
 * FacadeContext — L4 React Context
 *
 * Cung cấp đúng Facade instance theo role hiện tại từ UIStore.
 * Import ONLY từ facades/ (L3). Không import từ lib/, services/, types/ trực tiếp.
 *
 * CRITICAL (OPEN-4): Khi role === 'sales', MOCK_AGENTS phải được pass
 * theo thứ tự canonical — KHÔNG sort trước khi inject.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { AdminFacade } from '../../facades/AdminFacade.js'
import { CoordinatorFacade } from '../../facades/CoordinatorFacade.js'
import { SalesFacade } from '../../facades/SalesFacade.js'
import { TerritoryService } from '../../services/TerritoryService.js'
import { VersionService } from '../../services/VersionService.js'
import { ActivityService } from '../../services/ActivityService.js'
import { MapService } from '../../services/MapService.js'
import { useAuthStore } from '../store/authStore.js'
import { useDataStore } from '../store/dataStore.js'
import { useUIStore, type Role } from '../store/uiStore.js'
import { resolveUserKey } from '../utils/userIdentity.js'

// ── Type ──────────────────────────────────────────────────────────────────────

type FacadeContextValue =
  | { role: 'admin';       facade: AdminFacade }
  | { role: 'coordinator'; facade: CoordinatorFacade }
  | { role: 'sales';       facade: SalesFacade }

// ── Context ───────────────────────────────────────────────────────────────────

const FacadeContext = createContext<FacadeContextValue | null>(null)

// ── Create shared services (singleton) ───────────────────────────────────────

const territorySvc = new TerritoryService()
const versionSvc   = new VersionService()
const activitySvc  = new ActivityService()
const mapSvc       = new MapService()

// ── Provider ──────────────────────────────────────────────────────────────────

export function FacadeProvider({ children }: { children: ReactNode }) {
  const role = useUIStore((s) => s.role)
  const authUser = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const zones = useDataStore((s) => s.zones)
  const assignments = useDataStore((s) => s.assignments)
  const agents = useDataStore((s) => s.agents)

  const value = useMemo((): FacadeContextValue => {
    switch (role) {
      case 'admin':
        return {
          role: 'admin',
          facade: new AdminFacade(territorySvc, versionSvc, activitySvc, mapSvc),
        }
      case 'coordinator':
        return {
          role: 'coordinator',
          facade: new CoordinatorFacade(territorySvc, versionSvc, activitySvc),
        }
      case 'sales': {
        const salesId = resolveUserKey(authUser, profile, agents)
        return {
          role: 'sales',
          facade: new SalesFacade(
            salesId,
            activitySvc,
            zones,
            assignments,
            agents,
          ),
        }
      }
    }
  }, [role, authUser, profile, zones, assignments, agents])

  return (
    <FacadeContext.Provider value={value}>
      {children}
    </FacadeContext.Provider>
  )
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFacade(): FacadeContextValue {
  const ctx = useContext(FacadeContext)
  if (!ctx) throw new Error('useFacade must be used within FacadeProvider')
  return ctx
}

export function useAdminFacade(): AdminFacade {
  const ctx = useFacade()
  if (ctx.role !== 'admin')
    throw new Error(`useAdminFacade called with role="${ctx.role}"`)
  return ctx.facade
}

export function useCoordinatorFacade(): CoordinatorFacade {
  const ctx = useFacade()
  if (ctx.role !== 'coordinator')
    throw new Error(`useCoordinatorFacade called with role="${ctx.role}"`)
  return ctx.facade
}

export function useSalesFacade(): SalesFacade {
  const ctx = useFacade()
  if (ctx.role !== 'sales')
    throw new Error(`useSalesFacade called with role="${ctx.role}"`)
  return ctx.facade
}
