/**
 * RegionSelector - workflow entry for choosing or creating an operating region.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { useUIStore } from '../../store/uiStore.js'
import { findPolygonTopologyViolations, buildAdjacencyMatrix } from '../../../lib/geometry.js'

const cityPresets = [
  { name: 'Hà Nội', center: { lat: 21.03, lng: 105.83 }, zoom: 12 },
  { name: 'TP. Hồ Chí Minh', center: { lat: 10.82, lng: 106.63 }, zoom: 12 },
  { name: 'Đà Nẵng', center: { lat: 16.06, lng: 108.22 }, zoom: 12 },
  { name: 'Huế', center: { lat: 16.46, lng: 107.59 }, zoom: 13 },
]

// Full Vietnam province/city list for region creation (63).
// Centers are resolved at creation time via OSM Nominatim (no hardcoded coordinates needed).
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

// Fix mojibake preset labels to real Vietnamese names (so presets work with the full dropdown list).
const presetNameFix: Record<string, string> = {
  'HÃ  Ná»™i': 'Hà Nội',
  'TP. Há»“ ChÃ­ Minh': 'TP. Hồ Chí Minh',
  'ÄÃ  Náºµng': 'Đà Nẵng',
  'Huáº¿': 'Thừa Thiên Huế',
}

async function resolveCityCenter(city: string): Promise<{ center: { lat: number; lng: number }; zoom: number }> {
  const preset = cityPresets.find((p) => p.name === city || presetNameFix[p.name] === city)
  if (preset) return { center: preset.center, zoom: preset.zoom }

  const q = encodeURIComponent(`${city}, Viet Nam`)
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`
  const res = await fetch(url)
  const data = (await res.json()) as Array<{ lat: string; lon: string }>
  const first = data[0]
  if (!first) throw new Error(`Không tìm thấy toạ độ cho \"${city}\".`)
  return { center: { lat: Number(first.lat), lng: Number(first.lon) }, zoom: 12 }
}

function componentCount(zoneIds: string[], adj: Record<string, string[]>): number {
  if (zoneIds.length === 0) return 0
  const ids = new Set(zoneIds)
  const visited = new Set<string>()
  let count = 0

  for (const id of zoneIds) {
    if (visited.has(id)) continue
    count++
    const queue = [id]
    visited.add(id)
    for (let head = 0; head < queue.length; head++) {
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
  const addRegion = useDataStore((s) => s.addRegion)
  const role = useUIStore((s) => s.role)

  const [creating, setCreating] = useState(false)
  const [city, setCity] = useState(vnProvinces[0] ?? 'Hà Nội')
  const [name, setName] = useState(vnProvinces[0] ?? 'Hà Nội')

  const regionCards = useMemo(
    () =>
      regions.map((region) => {
        const regionZones = zones.filter((z) => (z as any).regionId === region.id)
        const adj = buildAdjacencyMatrix(regionZones, 50)
        const topologyErrors = findPolygonTopologyViolations(regionZones).length
        const components = componentCount(
          regionZones.map((z) => z.id),
          adj,
        )
        const islandCount = regionZones.filter((z) => (adj[z.id] ?? []).length === 0).length
        const regionAgents = agents.filter(
          (a) =>
            a.activeRegion === region.id ||
            a.activeRegion === region.name ||
            (a as any).regionId === region.id ||
            (a as any).region_id === region.id,
        )
        return { region, regionZones, topologyErrors, components, islandCount, regionAgents }
      }),
    [regions, zones, agents],
  )

  const handlePreset = (preset: (typeof cityPresets)[number]) => {
    const normalized = presetNameFix[preset.name] ?? preset.name
    setCity(normalized)
    setName(normalized)
    setCreating(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const resolved = await resolveCityCenter(city)
    const region = await addRegion(
      name.trim() || city,
      { lat: resolved.center.lat, lng: resolved.center.lng },
      resolved.zoom,
    )
    setName('')
    setCreating(false)
    setCurrentRegion(region.id)
  }

  return (
    <div style={styles.container}>
      <section style={styles.hero}>
        <div>
          <h1 style={styles.title}>Chọn khu vực vận hành</h1>
          <p style={styles.subtitle}>Mọi thao tác vẽ zone, kiểm tra liên thông và chạy thuật toán đều nên bắt đầu từ một khu vực cụ thể.</p>
        </div>
        {role === 'admin' && (
          <button style={styles.primaryBtn} onClick={() => setCreating(true)}>
            Tạo khu vực
          </button>
        )}
      </section>

      {regions.length === 0 && (
        <section style={styles.emptyBand}>
          <h2 style={styles.emptyTitle}>Dự án chưa có khu vực nào</h2>
          <p style={styles.emptyText}>Tạo khu vực đầu tiên để bắt đầu nhập zones và phân chia lãnh thổ.</p>
          <div style={styles.presetRow}>
            {cityPresets.map((preset) => (
              <button key={preset.name} style={styles.secondaryBtn} onClick={() => handlePreset(preset)}>
                {preset.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {creating && role === 'admin' && (
        <form onSubmit={handleCreate} style={styles.form}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>Tạo khu vực mới</h2>
            <button type="button" style={styles.ghostBtn} onClick={() => setCreating(false)}>
              Đóng
            </button>
          </div>

          <div style={styles.presetRow}>
            {cityPresets.map((preset) => (
              <button key={preset.name} type="button" style={styles.secondaryBtn} onClick={() => handlePreset(preset)}>
                {preset.name}
              </button>
            ))}
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span>Tỉnh/Thành phố</span>
              <select
                value={city}
                onChange={(e) => {
                  const next = e.target.value
                  setCity(next)
                  // Auto-fill name to match city unless user already customized.
                  if (!name || cityPresets.some((p) => p.name === name || presetNameFix[p.name] === name)) {
                    setName(next)
                  }
                }}
                required
                style={styles.input}
              >
                {vnProvinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span>Tên khu vực</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required style={styles.input} />
            </label>
          </div>

          <button type="submit" style={styles.primaryBtn}>
            Lưu và mở khu vực
          </button>
        </form>
      )}

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
                    border: `1px solid ${blocked
                      ? 'color-mix(in srgb, var(--color-danger) 28%, transparent)'
                      : 'color-mix(in srgb, var(--color-success) 28%, transparent)'}`,
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
                <Metric label="Zones" value={regionZones.length} />
                <Metric label="Sales" value={regionAgents.length} />
                <Metric label="Topology" value={topologyErrors} warn={topologyErrors > 0} />
                <Metric label="Components" value={components} warn={components > 1} />
              </div>

              <div style={styles.cardFooter}>
                <span>{islandCount} zone cô lập</span>
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
  primaryBtn: {
    border: 0,
    borderRadius: 8,
    background: 'var(--color-accent)',
    color: '#fff',
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    padding: '8px 10px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  ghostBtn: {
    border: 0,
    background: 'transparent',
    color: 'var(--color-text-2)',
    fontWeight: 800,
    cursor: 'pointer',
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
    marginBottom: 14,
  },
  presetRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  form: {
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    background: 'var(--color-surface)',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  formTitle: {
    fontSize: 18,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
    height: 38,
    border: '1px solid var(--color-border)',
    borderRadius: 7,
    padding: '0 10px',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
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
