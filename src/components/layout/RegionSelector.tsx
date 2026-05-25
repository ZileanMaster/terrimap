/**
 * RegionSelector.tsx — Card-based region selector for Admin and Coordinator
 */

import React, { useState } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { useUIStore } from '../../store/uiStore.js'

export default function RegionSelector() {
  const regions = useDataStore((s) => s.regions)
  const zones = useDataStore((s) => s.zones)
  const agents = useDataStore((s) => s.agents)
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)
  const addRegion = useDataStore((s) => s.addRegion)
  const role = useUIStore((s) => s.role)

  // Creation form state
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [lat, setLat] = useState('21.0285')
  const [lng, setLng] = useState('105.8542')
  const [zoom, setZoom] = useState('12')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const region = await addRegion(
        name.trim(),
        { lat: parseFloat(lat), lng: parseFloat(lng) },
        parseInt(zoom),
      )
      setName('')
      setCreating(false)
      setCurrentRegion(region.id)
    } catch (err: any) {
      alert(`❌ Lỗi khi tạo khu vực: ${err.message}`)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>📍</span>
        <h2 style={styles.title}>Chọn Khu vực Hoạt động</h2>
        <p style={styles.subtitle}>
          Vui lòng chọn một khu vực địa lý để xem bản đồ, danh sách zone, phân công và chạy so sánh thuật toán.
        </p>
      </div>

      <div style={styles.grid}>
        {regions.map((region) => {
          const regionZones = zones.filter((z) => (z as any).regionId === region.id)
          const assignedCount = regionZones.filter((z) => z.status === 'assigned').length
          const coordinator = agents.find((a) => a.id === region.coordinatorId)

          return (
            <div
              key={region.id}
              style={styles.card}
              onClick={() => setCurrentRegion(region.id)}
            >
              <div style={styles.cardHeader}>
                <span style={styles.cardIcon}>🏙️</span>
                <h3 style={styles.cardTitle}>{region.name}</h3>
              </div>

              <div style={styles.stats}>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Tổng số Zones:</span>
                  <strong style={styles.statVal}>{regionZones.length} zones</strong>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Đã phân công:</span>
                  <strong style={styles.statVal}>
                    {assignedCount}/{regionZones.length} ({regionZones.length > 0 ? Math.round((assignedCount / regionZones.length) * 100) : 0}%)
                  </strong>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>Điều phối phụ trách:</span>
                  <strong style={styles.statVal}>
                    {coordinator ? coordinator.name : 'Chưa gán'}
                  </strong>
                </div>
              </div>

              <button style={styles.selectBtn}>
                Vào khu vực này →
              </button>
            </div>
          )
        })}

        {/* Create Region Card (Admin Only) */}
        {role === 'admin' && (
          <div style={{ ...styles.card, ...styles.createCard }}>
            {!creating ? (
              <div style={styles.createPlaceholder} onClick={() => setCreating(true)}>
                <span style={styles.plusIcon}>+</span>
                <span style={styles.createText}>Tạo Khu vực mới</span>
              </div>
            ) : (
              <form onSubmit={handleCreate} style={styles.form}>
                <h4 style={styles.formTitle}>➕ Thêm khu vực mới</h4>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Tên khu vực:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Đà Nẵng"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Vĩ độ (Lat):</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Kinh độ (Lng):</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      style={styles.input}
                      required
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Độ phóng (Zoom):</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={zoom}
                    onChange={(e) => setZoom(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formBtns}>
                  <button type="submit" style={styles.confirmBtn}>Lưu</button>
                  <button type="button" style={styles.cancelBtn} onClick={() => setCreating(false)}>Hủy</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {regions.length === 0 && role !== 'admin' && (
        <div style={styles.emptyState}>
          📭 Dự án hiện chưa được thiết lập khu vực hoạt động nào. Vui lòng liên hệ Admin để tạo.
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '40px 24px',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    minHeight: '100%',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  headerIcon: {
    fontSize: '48px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: 'var(--color-text)',
    margin: 0,
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--color-text-muted)',
    maxWidth: '600px',
    lineHeight: 1.6,
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
    marginTop: '16px',
  },
  card: {
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1.5px solid var(--color-border, #30363d)',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    cursor: 'pointer',
    transition: 'transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
    boxShadow: 'var(--shadow-sm)',
    ':hover': {
      transform: 'translateY(-4px)',
      borderColor: 'var(--color-accent, #1f6feb)',
      boxShadow: 'var(--shadow-lg)',
    },
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cardIcon: {
    fontSize: '24px',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: 0,
  },
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontSize: '13px',
    padding: '12px 0',
    borderTop: '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: 'var(--color-text-muted)',
  },
  statVal: {
    color: 'var(--color-text)',
  },
  selectBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'var(--color-accent-light, rgba(31, 111, 235, 0.1))',
    color: 'var(--color-accent, #1f6feb)',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background-color 150ms ease, color 150ms ease',
  },
  createCard: {
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '260px',
  },
  createPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--color-accent)',
  },
  plusIcon: {
    fontSize: '48px',
    fontWeight: 300,
    lineHeight: 1,
  },
  createText: {
    fontSize: '16px',
    fontWeight: 700,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  formTitle: {
    fontSize: '15px',
    fontWeight: 700,
    margin: '0 0 4px 0',
    color: 'var(--color-text)',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  formLabel: {
    fontSize: '12px',
    color: 'var(--color-text-muted)',
  },
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-2, #1f2937)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontSize: '13px',
    outline: 'none',
  },
  formBtns: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px',
  },
  confirmBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: 'var(--color-accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--color-text-muted)',
    border: '1.5px dashed var(--color-border)',
    borderRadius: '16px',
    backgroundColor: 'var(--color-surface-2)',
  },
}
