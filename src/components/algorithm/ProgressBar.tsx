import React, { useEffect, useRef, useState } from 'react'

export interface ProgressBarProps {
  isRunning:   boolean
  progress:    number       // 0-100
  currentCost: number | null
}

export default function ProgressBar({ isRunning, progress, currentCost }: ProgressBarProps) {
  // Animated pseudo-progress khi không có progress thực
  const [displayProgress, setDisplayProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isRunning) {
      setDisplayProgress(0)
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    if (progress > 0) {
      setDisplayProgress(progress)
      return
    }

    timerRef.current = setInterval(() => {
      setDisplayProgress((v) => {
        if (v >= 85) return 85
        return v + Math.random() * 3
      })
    }, 200)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, progress])

  if (!isRunning) return null

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.label}>⚙️ Đang tính toán...</span>
        {currentCost !== null && (
          <span style={styles.cost}>Cost: {currentCost.toFixed(2)}</span>
        )}
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${Math.min(100, displayProgress)}%`,
          }}
        />
      </div>
      <div style={styles.pct}>{Math.round(displayProgress)}%</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '12px',
    background: 'var(--color-surface-2)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: 'var(--color-text-2)',
    fontWeight: 500,
  },
  cost: {
    fontSize: 11,
    color: 'var(--color-info)',
    fontFamily: 'monospace',
  },
  track: {
    height: 6,
    background: 'var(--color-border)',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: {
    height: '100%',
    background: 'var(--color-accent)',
    borderRadius: 99,
    transition: 'width 300ms ease',
  },
  pct: {
    fontSize: 11,
    color: 'var(--color-text-3)',
    textAlign: 'right' as const,
  },
}
