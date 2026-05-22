/**
 * src/test-utils.tsx — Shared test helpers
 *
 * KHÔNG chứa vi.mock() (phải gọi ở top-level trong từng test file).
 * Chỉ export: mock data factories + custom render.
 */

import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'

// ── Mock i18n key → identity ──────────────────────────────────────────────────

/** Mock translation function: returns the key as-is */
export const mockT = (key: string) => key

// ── Mock store factories ───────────────────────────────────────────────────────

export type MockStoreState = {
  role:                'admin' | 'coordinator' | 'sales'
  selectedZoneId:      string | null
  isAlgorithmRunning:  boolean
  theme:               'light' | 'dark' | 'system'
  locale:              'vi' | 'en'
  setRole:             ReturnType<typeof vi.fn>
  selectZone:          ReturnType<typeof vi.fn>
  setAlgorithmRunning: ReturnType<typeof vi.fn>
  setTheme:            ReturnType<typeof vi.fn>
  toggleLocale:        ReturnType<typeof vi.fn>
}

export function makeStore(
  overrides: Partial<MockStoreState> = {},
): MockStoreState {
  return {
    role:               'admin',
    selectedZoneId:     null,
    isAlgorithmRunning: false,
    theme:              'light',
    locale:             'vi',
    setRole:            vi.fn(),
    selectZone:         vi.fn(),
    setAlgorithmRunning: vi.fn(),
    setTheme:           vi.fn(),
    toggleLocale:       vi.fn(),
    ...overrides,
  }
}

// ── Facade mock factories ──────────────────────────────────────────────────────

export function makeAdminFacade() {
  return {
    runAlgorithm:          vi.fn(),
    getSalesManagement:    vi.fn().mockReturnValue({ sales: [], districtMap: {} }),
    getVersionHistory:     vi.fn().mockReturnValue([]),
    createVersion:         vi.fn(),
    exportReport:          vi.fn(),
    configureConstraints:  vi.fn(),
  }
}

export function makeCoordinatorFacade() {
  return {
    getTeamOverview:  vi.fn().mockReturnValue({ sales: [], totalKH: 0, totalOrders: 0 }),
    assignZone:       vi.fn(),
    getUpdateHistory: vi.fn().mockReturnValue([]),
    flagForReview:    vi.fn(),
    getSuggestions:   vi.fn().mockReturnValue([]),
  }
}

export function makeSalesFacade() {
  return {
    getMyDistrict: vi.fn().mockReturnValue({
      zones: [],
      summary: {
        districtId: 0, zoneCount: 0,
        totalCustomers: 0, totalOrders: 0,
        diameter: 0, balanceScore: 80,
      },
    }),
    getMyCustomers:      vi.fn().mockReturnValue([]),
    getMyOrderForecast:  vi.fn().mockReturnValue({
      districtId: 0, currentOrders: 100,
      forecastedOrders: 105,
      forecastedAt: new Date().toISOString(),
    }),
  }
}

// ── Custom render ─────────────────────────────────────────────────────────────

/**
 * Custom render wrapper.
 * Providers ít — mỗi test file mock riêng những gì nó cần.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions,
) {
  return render(ui, options)
}
