/**
 * RegionSelector - workflow entry for choosing or creating an operating region.
 */

import React, { useMemo, useState } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { useUIStore } from '../../store/uiStore.js'
import { findPolygonTopologyViolations, buildAdjacencyMatrix } from '../../../lib/geometry.js'

const cityPresets = [
  { name: 'Hà Nội', center: { lat: 21.03, lng: 105.83 }, zoom: 12 },
  { name: 'TP. Hồ Chí Minh', center: { lat: 10.82, lng: 106.63 }, zoom: 12 },
  { name: 'Đà Nẵng', center: { lat: 16.06, lng: 108.22 }, zoom: 12 },
  { name: 'Huế', center: { lat: 16.46, lng: 107.59 }, zoom: 13 },
]

const vnProvinces = [
  'An Giang',
  'Bà Rịa - Vũng Tàu',
  'Bắc Giang',
  'Bắc Kạn',
  'Bạc Liêu',
  'Bắc Ninh',
  'Bến Tre',
  'Bình Định',
  'Bình Dương',
  'Bình Phước',
  'Bình Thuận',
  'Cà Mau',
  'Cần Thơ',
  'Cao Bằng',
  'Đà Nẵng',
  'Đắk Lắk',
  'Đắk Nông',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Giang',
  'Hà Nam',
  'Hà Nội',
  'Hà Tĩnh',
  'Hải Dương',
  'Hải Phòng',
  'Hậu Giang',
  'Hòa Bình',
  'Hưng Yên',
  'Khánh Hòa',
  'Kiên Giang',
  'Kon Tum',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Long An',
  'Nam Định',
  'Nghệ An',
  'Ninh Bình',
  'Ninh Thuận',
  'Phú Thọ',
  'Phú Yên',
  'Quảng Bình',
  'Quảng Nam',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sóc Trăng',
  'Sơn La',
  'Tây Ninh',
  'Thái Bình',
  'Thái Nguyên',
  'Thanh Hóa',
  'Thừa Thiên Huế',
  'Tiền Giang',
  'TP. Hồ Chí Minh',
  'Trà Vinh',
  'Tuyên Quang',
  'Vĩnh Long',
  'Vĩnh Phúc',
  'Yên Bái',
]

const presetNameFix: Record<string, string> = {
  'Huế': 'Thừa Thiên Huế',
}

async function resolveCityCenter(city: string): Promise<{ center: { lat: number; lng: number }; zoom: number }> {
  const preset = cityPresets.find((p) => p.name === city || presetNameFix[p.name] === city)
  if (preset) return { center: preset.center, zoom: preset.zoom }

  const q = encodeURIComponent(`${city}, Viet Nam`)
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`
  const res = await fetch(url)
  const data = (await res.json()) as Array<{ lat: string; lon: string }>
  const first = data[0]
  if (!first) throw new Error(`Không tìm thấy tọa độ cho "${city}".`)
  return { center: { lat: Number(first.lat), lng: Number(first.lon) }, zoom: 12 }
}

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
  const addRegion = useDataStore((s) => s.addRegion)
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)
  const role = useUIStore((s) => s.role)

  const [creating, setCreating] = useState(false)
  const [city, setCity] = useState(vnProvinces[0] ?? 'Hà Nội')
  const [name, setName] = useState(vnProvinces[0] ?? 'Hà Nội')
  const [saving, setSaving] = useState(false)

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const resolved = await resolveCityCenter(city)
      const region = await addRegion(name.trim() || city, resolved.center, resolved.zoom)
      setCurrentRegion(region.id)
      setCreating(false)
      setName('')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể tạo khu vực.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <section style={styles.hero}>
        <div>
          <h1 style={styles.title}>Chọn khu vực vận hành</h1>
          <p style={styles.subtitle}>
            Mọi thao tác vẽ zone, kiểm tra liên thông và chạy thuật toán đều nên bắt đầu từ một khu vực cụ thể.
          </p>
        </div>
        {role === 'admin' && (
          <button style={styles.primaryBtn} onClick={() => setCreating((v) => !v)}>
            {creating ? 'Đóng tạo khu vực' : 'Tạo khu vực mới'}
          </button>
        )}
      </section>

      {creating && role === 'admin' && (
        <form onSubmit={handleCreate} style={styles.createBox}>
          <div style={styles.createHeader}>
            <strong style={styles.createTitle}>Tạo khu vực mới</strong>
            <span style={styles.createHint}>Chọn tỉnh/thành, đặt tên rồi bấm tạo.</span>
          </div>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span>Tỉnh/Thành phố</span>
              <select
                value={city}
                onChange={(e) => {
                  const next = e.target.value
                  setCity(next)
                  if (!name || vnProvinces.includes(name)) setName(next)
                }}
                style={styles.input}
              >
                {vnProvinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span>Tên khu vực</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                placeholder="VD: Hà Nội 1"
              />
            </label>
          </div>
          <div style={styles.createActions}>
            <button type="submit" style={styles.confirmBtn} disabled={saving}>
              {saving ? 'Đang tạo...' : 'Tạo ngay'}
            </button>
            <button
              type="button"
              style={styles.cancelBtn}
              onClick={() => {
                setCreating(false)
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {regions.length === 0 ? (
        <section style={styles.emptyBand}>
          <h2 style={styles.emptyTitle}>Dự án chưa có khu vực nào</h2>
          <p style={styles.emptyText}>
            Bạn có thể bấm <strong>Tạo khu vực mới</strong> ngay ở đây để khởi tạo dữ liệu ban đầu.
          </p>
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
  primaryBtn: {
    border: 0,
    borderRadius: 10,
    background: 'var(--color-accent)',
    color: '#fff',
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  createBox: {
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    background: 'var(--color-surface)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  createHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  createTitle: {
    fontSize: 16,
  },
  createHint: {
    color: 'var(--color-text-2)',
    fontSize: 13,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: 'var(--color-text-2)',
    fontWeight: 700,
    fontSize: 13,
  },
  input: {
    height: 40,
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: '0 12px',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  createActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  confirmBtn: {
    border: 0,
    borderRadius: 10,
    background: 'var(--color-accent)',
    color: '#fff',
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  cancelBtn: {
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  emptyBand: {
    border: '1px solid var(--color-border)',
    borderRadius: 12,
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
    borderRadius: 12,
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
  kicker: {
    color: 'var(--color-text-2)',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  metric: {
    border: '1px solid var(--color-border)',
    borderRadius: 7,
    padding: '14px 12px',
    background: 'var(--color-surface)',
    minHeight: 88,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
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
