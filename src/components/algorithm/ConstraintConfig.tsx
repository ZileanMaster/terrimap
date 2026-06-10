import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ConstraintConfigPanel() {
  const { t }                          = useTranslation()
  const [expanded, setExpanded]        = useState(false)
  const [adjThreshold, setAdjThreshold] = useState(50)
  const [balanceThreshold, setBalanceThreshold] = useState(1.5)
  const [maxDiameter, setMaxDiameter]  = useState<number | ''>('')

  return (
    <div style={styles.wrapper}>
      <button
        style={styles.toggle}
        onClick={() => setExpanded((v) => !v)}
        id="btn-toggle-constraints"
      >
        <span>{t('algo.constraints')}</span>
        <span style={{ transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 200ms' }}>
          ▾
        </span>
      </button>

      {expanded && (
        <div style={styles.body}>
          <FieldRow
            label={t('algo.adj_threshold')}
            value={adjThreshold}
            onChange={setAdjThreshold}
            min={10}
            max={200}
          />
          <FieldRow
            label={t('algo.balance_threshold')}
            value={balanceThreshold}
            onChange={setBalanceThreshold}
            min={1}
            max={5}
            step={0.1}
          />
          <FieldRow
            label={t('algo.max_diameter')}
            value={maxDiameter}
            onChange={(v) => setMaxDiameter(v)}
            min={10}
            max={500}
            placeholder="Không giới hạn"
          />
        </div>
      )}
    </div>
  )
}

function FieldRow({
  label, value, onChange, min, max, step = 1, placeholder,
}: {
  label: string
  value: number | ''
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  placeholder?: string
}) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      <input
        type="number"
        style={styles.input}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  toggle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: 'var(--color-surface-2)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  body: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    color: 'var(--color-text-2)',
    fontWeight: 500,
  },
  input: {
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
    width: '100%',
  },
}
