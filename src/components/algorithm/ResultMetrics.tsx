/**
 * ResultMetrics — Hiển thị kết quả AlgorithmResultVM
 * Tập trung vào chất lượng: balanceScore, vi phạm, liên thông và đường kính cực đại.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { AlgorithmResultVM } from '../../../facades/viewmodels.js'

export interface ResultMetricsProps {
  result: AlgorithmResultVM | null
}

export default function ResultMetrics({ result }: ResultMetricsProps) {
  const { t } = useTranslation()
  const [showViolations, setShowViolations] = React.useState(false)

  if (!result) return null

  const { balanceScore, maxDiameter, violationCount, algo, suggestSA, violations } = result
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

      <div style={styles.balanceBox}>
        <div style={{ ...styles.scoreNum, color: balanceColor }}>
          {balance.toFixed(1)}
        </div>
        <div style={styles.scoreLabel}>{t('metrics.balance')}</div>
        <div style={{ ...styles.scoreBadge, color: balanceColor, borderColor: balanceColor }}>
          {balanceLabel}
        </div>
      </div>

      {(result as any).ordersBalanceScore != null && (
        <div style={{ ...styles.balanceBox, marginTop: 6, padding: '8px 10px' }}>
          <div style={{ ...styles.scoreNum, fontSize: 18, color: (result as any).ordersBalanceScore >= 80 ? 'var(--color-success)' : (result as any).ordersBalanceScore >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
            {((result as any).ordersBalanceScore as number).toFixed(1)}
          </div>
          <div style={styles.scoreLabel}>Balance ĐH (Orders)</div>
        </div>
      )}

      <div style={styles.grid}>
        <MetricRow
          label={t('metrics.diameter')}
          value={`${(maxDiameter ?? 0).toFixed(1)} km`}
        />
        <MetricRow
          label={t('metrics.violations')}
          value={violationCount}
          valueColor={violationCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
        />
      </div>

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

      {suggestSA && (
        <div style={styles.suggestBanner} data-testid="suggest-sa-banner">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            ⚡ Chất lượng chưa đạt kỳ vọng ({balance.toFixed(1)})
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            Thuật toán {algo.toUpperCase()} chưa đạt mức cân bằng mong muốn.
            Hãy thử thuật toán khác hoặc tăng tiêu chí chất lượng để ưu tiên kết quả tốt hơn.
          </div>
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
    flexDirection: 'column',
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
    textAlign: 'center',
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
    textTransform: 'uppercase',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 10px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
  },
  metricLabel: {
    color: 'var(--color-text-2)',
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
  violationToggle: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  violationList: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  violationItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    borderLeft: '3px solid var(--color-warning)',
    padding: '8px 10px',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
  },
}
