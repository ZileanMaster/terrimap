/**
 * ResultMetrics.test.tsx — Unit tests RM-1 → RM-6
 *
 * ResultMetrics nhận AlgorithmResultVM | null — test thuần props-based,
 * không cần mock store hay facade.
 *
 * Updated (L4b-3): PartitionResult → AlgorithmResultVM, fields flat.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ResultMetrics from '../ResultMetrics'
import type { AlgorithmResultVM } from '../../../../facades/viewmodels'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'vi' },
  }),
}))

// ── Factory ───────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<AlgorithmResultVM> = {}): AlgorithmResultVM {
  return {
    assignments:    [],
    balanceScore:   75,    // flat — không còn metrics.balanceScore
    maxDiameter:    25,    // flat — không còn metrics.maxDiameter
    violationCount: 0,     // flat — không còn violations.length
    algo:           'local-search',
    durationMs:     42,
    suggestSA:      false,
    violations:     [],    // ViolationVM[] — dùng cho detail panel
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResultMetrics', () => {
  it('[RM-1] result=null → không render gì (empty)', () => {
    const { container } = render(<ResultMetrics result={null} />)
    // Component returns null → container chỉ có wrapper div rỗng
    expect(container.firstChild).toBeNull()
  })

  it('[RM-2] balanceScore >= 80 → label "metrics.balance_good"', () => {
    render(
      <ResultMetrics
        result={makeResult({ balanceScore: 85 })}
      />,
    )
    expect(screen.getByText('metrics.balance_good')).toBeInTheDocument()
  })

  it('[RM-3] balanceScore 60–79 → label "metrics.balance_medium"', () => {
    render(
      <ResultMetrics
        result={makeResult({ balanceScore: 70 })}
      />,
    )
    expect(screen.getByText('metrics.balance_medium')).toBeInTheDocument()
  })

  it('[RM-4] balanceScore < 60 → label "metrics.balance_low" + suggest SA banner', () => {
    render(
      <ResultMetrics
        result={makeResult({
          balanceScore: 45,
          suggestSA:    true,
        })}
      />,
    )
    expect(screen.getByText('metrics.balance_low')).toBeInTheDocument()
    // L4b-2: Enhanced banner renders with data-testid instead of simple i18n text
    expect(screen.getByTestId('suggest-sa-banner')).toBeInTheDocument()
  })

  it('[RM-5] durationMs hiển thị trong UI', () => {
    render(<ResultMetrics result={makeResult({ durationMs: 123 })} />)
    // MetricRow value: `${durationMs} ms` → '123 ms'
    expect(screen.getByText('123 ms')).toBeInTheDocument()
  })

  it('[RM-6] violationCount > 0 → hiển thị đúng số count', () => {
    render(
      <ResultMetrics
        result={makeResult({ violationCount: 2 })}
      />,
    )
    // MetricRow value = violationCount = 2
    // Kiểm tra strong element có text '2'
    const strong = [...document.querySelectorAll('strong')].find(
      (el) => el.textContent === '2',
    )
    expect(strong).toBeTruthy()
  })
})
