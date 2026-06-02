import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TopBar from '../TopBar'
import { makeStore, type MockStoreState } from '../../../test-utils'
import { useUIStore } from '../../../store/uiStore'

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
  setState: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  isOnline: () => false,
  supabase: null,
}))

let store: MockStoreState

function setupStore(overrides: Partial<MockStoreState> = {}) {
  store = makeStore(overrides)
  vi.mocked(useUIStore).mockImplementation((selector: (s: MockStoreState) => unknown) =>
    selector(store),
  )
}

describe('TopBar', () => {
  beforeEach(() => {
    setupStore()
  })

  it('renders logo and role tabs', () => {
    render(<TopBar />)
    expect(screen.getByTestId('logo')).toBeInTheDocument()
    expect(screen.getByText('nav.title')).toBeInTheDocument()
    expect(screen.getByText('nav.admin')).toBeInTheDocument()
    expect(screen.getByText('nav.coordinator')).toBeInTheDocument()
    expect(screen.getByText('nav.sales')).toBeInTheDocument()
  })

  it('marks the active role tab', () => {
    setupStore({ role: 'admin' })
    render(<TopBar />)
    expect(document.getElementById('role-tab-admin')).toHaveAttribute('data-active', 'true')
    expect(document.getElementById('role-tab-coordinator')).toHaveAttribute('data-active', 'false')
    expect(document.getElementById('role-tab-sales')).toHaveAttribute('data-active', 'false')
  })

  it('switches role when clicking a tab', async () => {
    setupStore({ role: 'admin' })
    const user = userEvent.setup()
    render(<TopBar />)
    await user.click(screen.getByText('nav.coordinator'))
    expect(store.setRole).toHaveBeenCalledWith('coordinator')
  })

  it('switches theme when clicking theme control', async () => {
    setupStore({ theme: 'light' })
    const user = userEvent.setup()
    render(<TopBar />)
    await user.click(screen.getByTitle('theme.dark'))
    expect(store.setTheme).toHaveBeenCalledWith('dark')
  })
})
