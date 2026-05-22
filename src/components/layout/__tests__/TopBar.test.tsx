/**
 * TopBar.test.tsx — Unit tests cho TopBar component
 * Tests: TB-1 → TB-6
 *
 * Updated to mock authStore + supabase (online mode detection)
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TopBar from '../TopBar'
import { makeStore, type MockStoreState } from '../../../test-utils'

// ── Module-level mocks (hoisted by Vitest) ────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'vi' },
  }),
}))

vi.mock('../../../store/uiStore', () => ({
  useUIStore: vi.fn(),
}))

vi.mock('../../../store/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      profile: null,
      membership: null,
      signOut: vi.fn(),
      selectProject: vi.fn(),
    }),
  ),
  // Expose setState mock
  setState: vi.fn(),
}))

// Mock supabase as offline (so TopBar shows original role tabs)
vi.mock('../../../lib/supabase', () => ({
  isOnline: () => false,
  supabase: null,
}))

vi.mock('../../../i18n/index', () => ({ default: { changeLanguage: vi.fn() } }))

// ── Helpers ───────────────────────────────────────────────────────────────────

import { useUIStore } from '../../../store/uiStore'

let store: MockStoreState

function setupStore(overrides: Partial<MockStoreState> = {}) {
  store = makeStore(overrides)
  vi.mocked(useUIStore).mockImplementation((selector: (s: MockStoreState) => unknown) =>
    selector(store),
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TopBar', () => {
  beforeEach(() => {
    setupStore()
  })

  it('[TB-1] render logo TerriMap', () => {
    render(<TopBar />)
    // Logo container tồn tại với data-testid
    expect(screen.getByTestId('logo')).toBeInTheDocument()
    // Hex ký hiệu ⬡ có trong logo
    expect(screen.getByTestId('logo')).toHaveTextContent('⬡')
    // nav.title (key) xuất hiện vì mockT trả về key
    expect(screen.getByText('nav.title')).toBeInTheDocument()
  })

  it('[TB-2] 3 role tabs hiển thị đủ (offline mode)', () => {
    render(<TopBar />)
    // mockT('nav.admin') → 'nav.admin', etc.
    expect(screen.getByText('nav.admin')).toBeInTheDocument()
    expect(screen.getByText('nav.coordinator')).toBeInTheDocument()
    expect(screen.getByText('nav.sales')).toBeInTheDocument()
  })

  it('[TB-3] tab admin active khi role = admin', () => {
    setupStore({ role: 'admin' })
    render(<TopBar />)
    const adminBtn = document.getElementById('role-tab-admin')
    expect(adminBtn).toHaveAttribute('data-active', 'true')
    expect(document.getElementById('role-tab-coordinator')).toHaveAttribute('data-active', 'false')
    expect(document.getElementById('role-tab-sales')).toHaveAttribute('data-active', 'false')
  })

  it('[TB-4] click tab coordinator → setRole("coordinator")', async () => {
    setupStore({ role: 'admin' })
    const user = userEvent.setup()
    render(<TopBar />)
    await user.click(screen.getByText('nav.coordinator'))
    expect(store.setRole).toHaveBeenCalledWith('coordinator')
  })

  it('[TB-5] click theme dark button → setTheme("dark")', async () => {
    setupStore({ theme: 'light' })
    const user = userEvent.setup()
    render(<TopBar />)
    // Theme buttons có id="theme-btn-{id}" và title=t('theme.dark') → 'theme.dark'
    await user.click(screen.getByTitle('theme.dark'))
    expect(store.setTheme).toHaveBeenCalledWith('dark')
  })

  it('[TB-6] LocaleToggle click → toggleLocale()', async () => {
    setupStore({ locale: 'vi' })
    const user = userEvent.setup()
    render(<TopBar />)
    // locale='vi' → button text = '🇻🇳 VI'
    await user.click(document.getElementById('locale-toggle')!)
    expect(store.toggleLocale).toHaveBeenCalled()
  })
})
