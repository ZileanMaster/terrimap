/**
 * AlgorithmSelector — 3 cards: Greedy | Local Search | SA
 */

import React from 'react'
import { useTranslation } from 'react-i18next'

type Algo = 'greedy' | 'local-search' | 'sa'

export interface AlgorithmSelectorProps {
  value:    Algo
  onChange: (algo: Algo) => void
  disabled?: boolean
}

interface AlgoCard {
  id:      Algo
  label:   string
  desc:    string
  icon:    string
}

export default function AlgorithmSelector({
  value, onChange, disabled = false,
}: AlgorithmSelectorProps) {
  const { t } = useTranslation()

  const CARDS: AlgoCard[] = [
    {
      id:   'greedy',
      label: t('algo.greedy'),
      icon: '⚡',
      desc: 'Nhanh nhất. Phù hợp khởi tạo.',
    },
    {
      id:   'local-search',
      label: 'Tìm kiếm cục bộ',
      icon: '🔄',
      desc: 'Cải thiện từ Greedy. Đảm bảo liên thông 100%.',
    },
    {
      id:   'sa',
      label: t('algo.sa'),
      icon: '🔥',
      desc: 'Cân bằng tốt nhất. Chậm hơn, đổi lấy chất lượng.',
    },
  ]

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>Thuật toán phân chia</label>
      <div style={styles.cards}>
        {CARDS.map((card) => {
          const isSelected = value === card.id
          return (
            <button
              key={card.id}
              id={`algo-card-${card.id}`}
              data-algo={card.id}
              data-selected={String(isSelected)}
              data-testid={`algo-${card.id}`}
              onClick={() => !disabled && onChange(card.id)}
              disabled={disabled}
              style={{
                ...styles.card,
                ...(isSelected ? styles.cardSelected : styles.cardUnselected),
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...(disabled && { opacity: 0.6 }),
              }}
            >
              <div style={styles.cardHeader}>
                <span style={styles.icon}>{card.icon}</span>
                <span style={{
                  ...styles.cardLabel,
                  fontWeight: isSelected ? 700 : 600,
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
                }}>{card.label}</span>
              </div>
              <div style={styles.cardDesc}>{card.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--color-text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  cards: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  card: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    width: '100%',
  },
  cardSelected: {
    border: '2px solid var(--color-accent)',
    borderLeft: '4px solid var(--color-accent)',
    background: 'rgba(59, 130, 246, 0.12)',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
  },
  cardUnselected: {
    opacity: 0.72,
    border: '1.5px solid var(--color-border)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  icon: {
    fontSize: 14,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text)',
    flex: 1,
  },
  cardDesc: {
    fontSize: 11,
    color: 'var(--color-text-3)',
    marginLeft: 20,
  },
  warningBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 99,
    background: 'rgba(217,119,6,.15)',
    color: 'var(--color-warning)',
    border: '1px solid rgba(217,119,6,.3)',
    cursor: 'help',
  },
}
