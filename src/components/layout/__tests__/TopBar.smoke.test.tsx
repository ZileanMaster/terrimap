import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TopBar from '../TopBar'

// Mock UIStore
vi.mock('../../../store/uiStore', () => ({
  useUIStore: vi.fn((selector: (s: object) => unknown) =>
    selector({
      role: 'admin',
      theme: 'light',
      locale: 'vi',
      setRole: vi.fn(),
      setTheme: vi.fn(),
      toggleLocale: vi.fn(),
    }),
  ),
}))

// Mock authStore
vi.mock('../../../store/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      profile: null,
      membership: null,
      signOut: vi.fn(),
      selectProject: vi.fn(),
    }),
  ),
}))

// Mock supabase as offline
vi.mock('../../../lib/supabase', () => ({
  isOnline: () => false,
  supabase: null,
}))

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

// Mock i18n/index to avoid side-effects
vi.mock('../../../i18n/index', () => ({ default: {} }))

describe('TopBar smoke test', () => {
  it('renders without crash', () => {
    render(<TopBar />)
    // Logo text xuất hiện
    expect(screen.getByText('⬡')).toBeInTheDocument()
    // Role tabs xuất hiện (offline mode)
    expect(screen.getByText('nav.admin')).toBeInTheDocument()
    expect(screen.getByText('nav.coordinator')).toBeInTheDocument()
    expect(screen.getByText('nav.sales')).toBeInTheDocument()
  })

  it('has role tab buttons with correct ids', () => {
    render(<TopBar />)
    expect(document.getElementById('role-tab-admin')).toBeTruthy()
    expect(document.getElementById('role-tab-coordinator')).toBeTruthy()
    expect(document.getElementById('role-tab-sales')).toBeTruthy()
  })
})
