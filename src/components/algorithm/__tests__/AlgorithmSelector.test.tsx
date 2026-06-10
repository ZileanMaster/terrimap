/**
 * AlgorithmSelector.test.tsx - Unit tests AS-1 -> AS-5
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AlgorithmSelector from '../AlgorithmSelector'

//  Module-level mocks 

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'vi' },
  }),
}))

//  Tests 

describe('AlgorithmSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[AS-1] 3 thuật toán hiển thị đủ', () => {
    render(
      <AlgorithmSelector value="greedy" onChange={vi.fn()} disabled={false} />,
    )
    expect(screen.getByText('algo.greedy')).toBeInTheDocument()
    // Local Search uses hardcoded label, not i18n key
    expect(screen.getByText('Tìm kiếm cục bộ')).toBeInTheDocument()
    expect(screen.getByText('algo.sa')).toBeInTheDocument()
  })

  it('[AS-2] Local Search card không có warning badge', () => {
    render(
      <AlgorithmSelector value="greedy" onChange={vi.fn()} disabled={false} />,
    )
    // Local Search card exists
    const lsCard = document.querySelector('[data-algo="local-search"]')
    expect(lsCard).toBeInTheDocument()
    // No warning badge anywhere
    expect(screen.queryByText('⚠')).not.toBeInTheDocument()
  })

  it('[AS-3] click Local Search -> onChange("local-search")', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AlgorithmSelector value="greedy" onChange={onChange} disabled={false} />,
    )
    await user.click(screen.getByText('Tìm kiếm cục bộ'))
    expect(onChange).toHaveBeenCalledWith('local-search')
  })

  it('[AS-4] disabled=true -> click không gọi onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AlgorithmSelector value="greedy" onChange={onChange} disabled={true} />,
    )
    const lsCard = document.querySelector('[data-algo="local-search"]') as HTMLElement
    await user.click(lsCard)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('[AS-5] selected algo có data-selected="true"', () => {
    render(
      <AlgorithmSelector value="sa" onChange={vi.fn()} disabled={false} />,
    )
    expect(document.querySelector('[data-algo="sa"]')).toHaveAttribute('data-selected', 'true')
    expect(document.querySelector('[data-algo="greedy"]')).toHaveAttribute('data-selected', 'false')
    expect(document.querySelector('[data-algo="local-search"]')).toHaveAttribute('data-selected', 'false')
  })
})
