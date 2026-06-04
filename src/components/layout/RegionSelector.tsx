/**
 * RegionSelector - workflow entry for choosing an operating region.
 */

import React, { useMemo } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { findPolygonTopologyViolations, buildAdjacencyMatrix } from '../../../lib/geometry.js'

function componentCount(zoneIds: string[], adj: Record<string, string[]>): number {
  if (zoneIds.length === 0) return 0
  const ids = new Set(zoneIds)
  const visited = new Set<string>()
  let count = 0

  for (const id of zoneIds) {
    if (visited.has(id)) continue
    count += 1
    const queue = [id]
    visited.add(id)
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]!
      for (const next of adj[current] ?? []) {
        if (ids.has(next) && !visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
  }

  return count
}

export default function RegionSelector() {
  const regions = useDataStore((s) => s.regions)
  const zones = useDataStore((s) => s.zones)
  const agents = useDataStore((s) => s.agents)
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)

  const regionCards = useMemo(
    () =>
      regions.map((region) => {
        const regionZones = zones.filter((z) => (z as any).regionId === region.id)
        const adjacency = buildAdjacencyMatrix(regionZones, 50)
        const topologyErrors = findPolygonTopologyViolations(regionZones).length
        const components = componentCount(regionZones.map((z) => z.id), adjacency)
        const islandCount = regionZones.filter((z) => (adjacency[z.id] ?? []).length === 0).length
        const regionAgents = agents.filter(
          (agent) =>
            agent.activeRegion === region.id ||
            agent.activeRegion === region.name ||
            (agent as any).regionId === region.id ||
            (agent as any).region_id === region.id,
        )
        return { region, regionZones, topologyErrors, components, islandCount, regionAgents }
      }),
    [regions, zones, agents],
  )

  return (
    <div style={styles.container}>
      <section style={styles.hero}>
        <div>
          <h1 style={styles.title}>Chọn khu vực vận hành</h1>
          <p style={styles.subtitle}>
            Mọi thao tác vẽ zone, kiểm tra liên thông và chạy thuật toán đều nên bắt đầu từ một khu vực cụ thể.
          </p>
        </div>
      </section>

      {regions.length === 0 ? (
        <section style={styles.emptyBand}>
          <h2 style={styles.emptyTitle}>Dự án chưa có khu vực nào</h2>
          <p style={styles.emptyText}>Hãy tạo khu vực ở màn quản lý khu vực nếu dự án chưa có dữ liệu.</p>
        </section>
      ) : null}

      <section style={styles.grid}>
        {regionCards.map(({ region, regionZones, topologyErrors, components, islandCount, regionAgents }) => {
          const blocked = topologyErrors > 0 || components > 1
          return (
            <button key={region.id} style={styles.card} onClick={() => setCurrentRegion(region.id)}>
              <div style={styles.cardTop}>
                <div>
                  <span style={styles.kicker}>Khu vực</span>
                  <h3 style={styles.cardTitle}>{region.name}</h3>
                </div>
                <span
                  style={{
                    ...styles.status,
                    border: `1px solid ${
                      blocked
                        ? 'color-mix(in srgb, var(--color-danger) 28%, transparent)'
                        : 'color-mix(in srgb, var(--color-success) 28%, transparent)'
                    }`,
                    background: blocked
                      ? 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))'
                      : 'color-mix(in srgb, var(--color-success) 12%, var(--color-surface))',
                    color: blocked ? 'var(--color-danger)' : 'var(--color-success)',
                  }}
                >
                  {blocked ? 'Cần xử lý' : 'Sẵn sàng'}
                </span>
              </div>

              <div style={styles.metrics}>
                <Metric label="Vùng" value={regionZones.length} />
                <Metric label="Nhân sự" value={regionAgents.length} />
                <Metric label="Liên thông" value={topologyErrors} warn={topologyErrors > 0} />
                <Metric label="Cụm liên thông" value={components} warn={components > 1} />
              </div>

              <div style={styles.cardFooter}>
                <span>{islandCount} vùng cô lập</span>
                <strong>Mở khu vực</strong>
              </div>
            </button>
          )
        })}
      </section>
    </div>
  )
}

function Metric({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricValue}>{value}</span>
      <span style={{ ...styles.metricLabel, color: warn ? '#b91c1c' : 'var(--color-text-2)' }}>{label}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    maxWidth: 1280,
    margin: '0 auto',
  },
  hero: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: '10px 0 4px',
    flexWrap: 'wrap',
  },
  kicker: {
    color: 'var(--color-text-2)',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 28,
    lineHeight: 1.15,
    margin: '4px 0 8px',
  },
  subtitle: {
    maxWidth: 680,
    color: 'var(--color-text-2)',
    fontSize: 15,
  },
  emptyBand: {
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    background: 'var(--color-surface)',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 6,
  },
  emptyText: {
    color: 'var(--color-text-2)',
    marginBottom: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    textAlign: 'left',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    padding: 18,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: 'var(--shadow-sm)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    marginTop: 4,
  },
  status: {
    height: 28,
    borderRadius: 999,
    padding: '5px 9px',
    fontSize: 12,
    fontWeight: 800,
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  metric: {
    border: '1px solid var(--color-border)',
    borderRadius: 7,
    padding: 10,
    background: 'var(--color-surface)',
  },
  metricValue: {
    display: 'block',
    fontWeight: 900,
    fontSize: 20,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 750,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--color-text-2)',
    fontSize: 13,
  },
}
