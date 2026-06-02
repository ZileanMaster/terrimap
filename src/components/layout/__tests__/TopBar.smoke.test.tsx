import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TopBar from '../TopBar'

vi.mock('../../../store/uiStore', () => ({
  useUIStore: vi.fn((selector: (s: object) => unknown) =>
    selector({
      role: 'admin',
      theme: 'light',
      setRole: vi.fn(),
      setTheme: vi.fn(),
    }),
  ),
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
}))

vi.mock('../../../lib/supabase', () => ({
  isOnline: () => false,
  supabase: null,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

describe('TopBar smoke test', () => {
  it('renders without crash', () => {
    render(<TopBar />)
    expect(screen.getByTestId('logo')).toBeInTheDocument()
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
