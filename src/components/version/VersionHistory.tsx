import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Snapshot } from '../../../facades/viewmodels.js'

interface VersionHistoryProps {
  snapshots: Snapshot[]
}

/** Relative time display (simple). */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60)   return `${secs}s trước`
  const mins = Math.floor(secs / 60)
  if (mins < 60)   return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24)  return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

export default function VersionHistory({ snapshots }: VersionHistoryProps) {
  const { t } = useTranslation()

  return (
    <div style={styles.wrapper} data-testid="version-history">
      <div style={styles.title}>📜 {t('version.title')}</div>

      {snapshots.length === 0 ? (
        <div style={styles.empty}>{t('version.empty')}</div>
      ) : (
        <div style={styles.timeline}>
          {[...snapshots].reverse().map((snap, i) => (
            <div
              key={snap.version}
              style={styles.item}
              data-testid={`version-item-${i}`}
            >
              {/* Dot + vertical line */}
              <div style={styles.dotCol}>
                <div style={{
                  ...styles.dot,
                  background: i === 0 ? 'var(--color-accent)' : 'var(--color-text-3)',
                }} />
                {i < snapshots.length - 1 && <div style={styles.line} />}
              </div>

              {/* Content */}
              <div style={styles.content}>
                <div style={styles.label}>{snap.label}</div>
                <div style={styles.meta}>
                  v{snap.version} · {snap.zones.length} zones · {relativeTime(snap.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-3)',
    marginBottom: 10,
  },
  empty: {
    fontSize: 12,
    color: 'var(--color-text-3)',
    fontStyle: 'italic',
    padding: '8px 0',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
  },
  item: {
    display: 'flex',
    gap: 10,
    minHeight: 40,
  },
  dotCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: 12,
    paddingTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  line: {
    flex: 1,
    width: 1,
    background: 'var(--color-border)',
    marginTop: 4,
    marginBottom: 4,
  },
  content: {
    flex: 1,
    paddingBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text)',
    lineHeight: 1.3,
  },
  meta: {
    fontSize: 10,
    color: 'var(--color-text-3)',
    marginTop: 2,
  },
}
