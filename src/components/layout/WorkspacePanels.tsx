import React from 'react'

function TinyStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value.toLocaleString('vi-VN')}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

export function AssignmentWorkspacePanel({
  zoneCount,
  districtCount,
}: {
  zoneCount: number
  districtCount: number
}) {
  return (
    <div style={styles.card}>
      <div style={styles.eyebrow}>Không gian vận hành</div>
      <div style={styles.title}>Phân chia lãnh thổ</div>
      <div style={styles.desc}>
        Màn này dành cho phân cụm, gán nhân sự, cân bằng tải và lưu phương án triển khai. Phần dữ liệu nền
        được chỉnh ngay trong cùng một màn Phân chia lãnh thổ.
      </div>
      <div style={styles.statsGrid}>
        <TinyStat label="Vùng trong khu vực" value={zoneCount} />
        <TinyStat label="Cụm đang có" value={districtCount} />
        <TinyStat label="Trạng thái" value={zoneCount > 0 ? 1 : 0} />
      </div>
    </div>
  )
}

const styles: Record<string, any> = {
  card: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-3)',
    fontWeight: 700,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--color-text)',
    marginTop: 2,
  },
  desc: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--color-text-2)',
    marginTop: 2,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 8px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--color-accent)',
    lineHeight: 1.15,
  },
  statLabel: {
    fontSize: 10,
    color: 'var(--color-text-3)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
}
