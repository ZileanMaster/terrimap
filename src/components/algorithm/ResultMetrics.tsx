/**
 * ResultMetrics — Hiển thị kết quả AlgorithmResultVM
 * balanceScore < 60 → red + suggestSA banner
 * 60-79 → amber, ≥ 80 → green
 *
 * L4b-2: + violation expandable list + enhanced suggestSA banner with action button
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { AlgorithmResultVM } from '../../../facades/viewmodels.js'

export interface ResultMetricsProps {
  result: AlgorithmResultVM | null
  onRunSA?: () => void    // L4b-2 EC-3: callback to auto-run SA
}

export default function ResultMetrics({ result, onRunSA }: ResultMetricsProps) {
  const { t } = useTranslation()
  const [showViolations, setShowViolations] = React.useState(false)

  if (!result) return null

  const { balanceScore, maxDiameter, violationCount, algo, durationMs, suggestSA, violations } = result
  const balance = balanceScore ?? 0

  const balanceColor =
    balance >= 80 ? 'var(--color-success)' :
    balance >= 60 ? 'var(--color-warning)' :
                   'var(--color-danger)'

  const balanceLabel =
    balance >= 80 ? t('metrics.balance_good') :
    balance >= 60 ? t('metrics.balance_medium') :
                   t('metrics.balance_low')

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>📊 Kết quả</span>
        <span style={styles.algo}>{algo.toUpperCase()}</span>
      </div>

      {/* Balance Score — prominent */}
      <div style={styles.balanceBox}>
        <div style={{ ...styles.scoreNum, color: balanceColor }}>
          {balance.toFixed(1)}
        </div>
        <div style={styles.scoreLabel}>{t('metrics.balance')}</div>
        <div style={{ ...styles.scoreBadge, color: balanceColor, borderColor: balanceColor }}>
          {balanceLabel}
        </div>
      </div>

      {/* Orders Balance Score */}
      {(result as any).ordersBalanceScore != null && (
        <div style={{ ...styles.balanceBox, marginTop: 6, padding: '8px 10px' }}>
          <div style={{ ...styles.scoreNum, fontSize: 18, color: (result as any).ordersBalanceScore >= 80 ? 'var(--color-success)' : (result as any).ordersBalanceScore >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
            {((result as any).ordersBalanceScore as number).toFixed(1)}
          </div>
          <div style={styles.scoreLabel}>Balance ĐH (Orders)</div>
        </div>
      )}

      {/* Other metrics */}
      <div style={styles.grid}>
        <MetricRow
          label={t('metrics.diameter')}
          value={`${(maxDiameter ?? 0).toFixed(1)} km`}
        />
        <MetricRow
          label={t('metrics.duration')}
          value={`${durationMs} ms`}
        />
        <MetricRow
          label={t('metrics.violations')}
          value={violationCount}
          valueColor={violationCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
        />
      </div>

      {/* L4b-2 EC-2: Violation expandable list */}
      {violations.length > 0 && (
        <div data-testid="violations-section">
          <button
            style={styles.violationToggle}
            onClick={() => setShowViolations(!showViolations)}
            data-testid="violations-toggle"
          >
            {showViolations ? '▾' : '▸'} {violations.length} vi phạm
          </button>

          {showViolations && (
            <div style={styles.violationList}>
              {violations.map((v, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.violationItem,
                    borderLeftColor: v.severity === 'error' ? 'var(--color-danger)' : 'var(--color-warning)',
                  }}
                  data-testid={`violation-item-${i}`}
                >
                  <span>{v.severity === 'error' ? '🔴' : '⚠️'}</span>
                  <span style={{ fontSize: 12 }}>{v.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* L4b-2 EC-3: Enhanced suggestSA banner */}
      {suggestSA && (
        <div style={styles.suggestBanner} data-testid="suggest-sa-banner">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            ⚡ Balance thấp ({balance.toFixed(1)})
          </div>
          <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.9 }}>
            Thuật toán {algo.toUpperCase()} chưa tối ưu được cân bằng.
            Simulated Annealing thường cho kết quả tốt hơn.
          </div>
          {onRunSA && (
            <button
              style={styles.suggestBtn}
              onClick={onRunSA}
              data-testid="suggest-sa-run-btn"
            >
              🔄 Chạy SA tự động
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function MetricRow({
  label, value, valueColor,
}: {
  label: string
  value: string | number
  valueColor?: string
}) {
  return (
    <div style={styles.metricRow}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={{ color: valueColor ?? 'var(--color-text)' }}>{value}</strong>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  algo: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 99,
    background: 'var(--color-accent-light)',
    color: 'var(--color-accent)',
    letterSpacing: '0.06em',
  },
  balanceBox: {
    textAlign: 'center' as const,
    padding: '8px 0',
  },
  scoreNum: {
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  scoreLabel: {
    fontSize: 11,
    color: 'var(--color-text-3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginTop: 4,
  },
  scoreBadge: {
    display: 'inline-block',
    marginTop: 6,
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: 99,
    border: '1.5px solid',
  },
  suggestBanner: {
    padding: '10px 12px',
    background: 'rgba(217,119,6,.1)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '3px solid var(--color-warning)',
    fontSize: 12,
    color: 'var(--color-warning)',
    lineHeight: 1.5,
  },
  suggestBtn: {
    padding: '6px 12px',
    background: 'var(--color-warning)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--color-text-2)',
  },
  metricLabel: {
    color: 'var(--color-text-2)',
  },
  violationToggle: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-2)',
    padding: '4px 0',
    width: '100%',
    textAlign: 'left' as const,
  },
  violationList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    marginTop: 4,
  },
  violationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '6px 8px',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '3px solid',
    fontSize: 12,
    lineHeight: 1.4,
  },
}
