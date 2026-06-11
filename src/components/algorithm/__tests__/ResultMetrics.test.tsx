/**
 * ResultMetrics.test.tsx - Unit tests RM-1 -> RM-5
 *
 * ResultMetrics nhận AlgorithmResultVM | null - test thuần props-based,
 * không cần mock store hay facade.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ResultMetrics from '../ResultMetrics'
import type { AlgorithmResultVM } from '../../../../facades/viewmodels'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'vi' },
  }),
}))

function makeResult(overrides: Partial<AlgorithmResultVM> = {}): AlgorithmResultVM {
  const base: AlgorithmResultVM = {
    assignments: [],
    balanceScore: 75,
    avgCustomersPerDistrict: 100,
    maxDiameter: 25,
    violationCount: 0,
    algo: 'hill-climbing',
    durationMs: 1200,
    suggestSA: false,
    violations: [],
  }

  const merged = { ...base, ...overrides }

  return {
    ...merged,
    balanceScore: merged.balanceScore ?? base.balanceScore,
    avgCustomersPerDistrict: merged.avgCustomersPerDistrict ?? base.avgCustomersPerDistrict,
    maxDiameter: merged.maxDiameter ?? base.maxDiameter,
    violationCount: merged.violationCount ?? base.violationCount,
    durationMs: merged.durationMs ?? base.durationMs,
  }
}

describe('ResultMetrics', () => {
  it('[RM-1] result=null -> không render gì (empty)', () => {
    const { container } = render(<ResultMetrics result={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('[RM-2] balanceScore >= 80 -> label "metrics.balance_good"', () => {
    render(<ResultMetrics result={makeResult({ balanceScore: 85 })} />)
    expect(screen.getByText('metrics.balance_good')).toBeInTheDocument()
  })

  it('[RM-3] balanceScore 60–79 -> label "metrics.balance_medium"', () => {
    render(<ResultMetrics result={makeResult({ balanceScore: 70 })} />)
    expect(screen.getByText('metrics.balance_medium')).toBeInTheDocument()
  })

  it('[RM-4] balanceScore < 60 -> label "metrics.balance_low" + suggest SA banner', () => {
    render(
      <ResultMetrics
        result={makeResult({
          balanceScore: 45,
          suggestSA: true,
        })}
      />,
    )
    expect(screen.getByText('metrics.balance_low')).toBeInTheDocument()
    expect(screen.getByTestId('suggest-sa-banner')).toBeInTheDocument()
  })

  it('[RM-5] violationCount > 0 -> hiển thị đúng số count', () => {
    render(<ResultMetrics result={makeResult({ violationCount: 2 })} />)
    const strong = [...document.querySelectorAll('strong')].find(
      (el) => el.textContent === '2',
    )
    expect(strong).toBeTruthy()
  })

  it('[RM-6] hiển thị khách hàng trung bình mỗi cụm', () => {
    render(<ResultMetrics result={makeResult({ avgCustomersPerDistrict: 125.4 })} />)
    expect(screen.getByText('Khách hàng TB / cụm')).toBeInTheDocument()
    expect(screen.getByText('125.4')).toBeInTheDocument()
  })
})

