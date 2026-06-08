import React, { useState, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import type { SalesAgent } from '../../../facades/viewmodels.js'

interface AgentManagerProps {
  open: boolean
  onClose: () => void
}

export default function AgentManager({ open, onClose }: AgentManagerProps) {
  const agents      = useDataStore((s) => s.agents)
  const regions     = useDataStore((s) => s.regions)
  const addAgent    = useDataStore((s) => s.addAgent)
  const updateAgent = useDataStore((s) => s.updateAgent)
  const removeAgent = useDataStore((s) => s.removeAgent)

  const [editing, setEditing] = useState<SalesAgent | null>(null)
  const [form, setForm]       = useState({ name: '', activeRegion: '', regionId: '', capacity: 400 })

  // Mở form thêm mới
  const handleNew = useCallback(() => {
    setEditing(null)
    setForm({ name: '', activeRegion: '', regionId: '', capacity: 400 })
  }, [])

  // Mở form chỉnh sửa
  const handleEdit = useCallback((agent: SalesAgent) => {
    setEditing(agent)
    setForm({
      name:         agent.name,
      activeRegion: agent.activeRegion,
      regionId:     (agent as any).regionId ?? '',
      capacity:     agent.capacity,
    })
  }, [])

  // Submit form (thêm hoặc sửa)
  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) return alert('Tên nhân viên không được trống')

    // D?ng t?n region l?m activeRegion n?u ch?n t? dropdown
    const regionName = regions.find((r) => r.id === form.regionId)?.name ?? form.activeRegion.trim()

    if (editing) {
      await updateAgent({
        ...editing,
        name:         form.name.trim(),
        activeRegion: regionName || editing.activeRegion,
        capacity:     Number(form.capacity) || 400,
        // regionId ???c l?u nh? field ph? (safe cast ? L0 kh?ng ??i)
        ...({ regionId: form.regionId || undefined } as any),
      })
    } else {
      const newAgent: SalesAgent = {
        id:           `sa${Date.now()}`,
        name:         form.name.trim(),
        activeRegion: regionName || 'Hà Nội',
        capacity:     Number(form.capacity) || 400,
        // regionId ???c l?u nh? field ph?
        ...({ regionId: form.regionId || undefined } as any),
      }
      await addAgent(newAgent)
    }
    setEditing(null)
    setForm({ name: '', activeRegion: '', regionId: '', capacity: 400 })
  }, [editing, form, regions, addAgent, updateAgent])

  // Xóa
  const handleDelete = useCallback(async (agentId: string) => {
    if (!window.confirm('Xóa nhân viên này? Các assignments liên quan sẽ bị hủy.')) return
    await removeAgent(agentId)
  }, [removeAgent])

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>⚙️ Quản lý nhân viên</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {/* Danh sách hiện tại */}
        <div style={styles.listSection}>
          <h3 style={styles.sectionTitle}>
            Nhân viên hiện tại ({agents.length})
          </h3>
          {agents.map((agent) => (
            <div key={agent.id} style={styles.agentRow}>
              <div style={styles.agentInfo}>
                <div style={styles.agentAvatar}>{agent.name.charAt(0)}</div>
                <div>
                  <div style={styles.agentName}>{agent.name}</div>
                  <div style={styles.agentMeta}>
                    {agent.activeRegion} · Cap: {agent.capacity}
                  </div>
                </div>
              </div>
              <div style={styles.agentActions}>
                <button onClick={() => handleEdit(agent)} style={styles.editBtn} title="Sửa">✏️</button>
                <button onClick={() => handleDelete(agent.id)} style={styles.deleteBtn} title="Xóa">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* Form thêm/sửa */}
        <div style={styles.formSection}>
          <h3 style={styles.sectionTitle}>
            {editing ? `✏️ Sửa: ${editing.name}` : '➕ Thêm nhân viên mới'}
          </h3>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Tên
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={styles.input}
                placeholder="VD: Nguyễn Văn A"
              />
            </label>

            {/* Phase 3: Region dropdown */}
            <label style={styles.label}>
              Khu vực phụ trách
              <select
                value={form.regionId}
                onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
                style={styles.input}
              >
                <option value="">-- Chọn khu vực --</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Capacity (KH tối đa)
              <input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                style={styles.input}
                min={50}
                max={2000}
              />
            </label>
          </div>
          <div style={styles.formActions}>
            {editing && (
              <button onClick={handleNew} style={styles.cancelBtn}>
                Hủy sửa
              </button>
            )}
            <button onClick={handleSubmit} style={styles.submitBtn}>
              {editing ? '💾 Cập nhật' : '➕ Thêm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Styles cho modal (glassmorphism)
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 16,
    border: '1.5px solid var(--color-border)',
    width: '90%',
    maxWidth: 520,
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--color-border)',
  },
  headerTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    fontSize: 22,
    cursor: 'pointer',
    color: 'var(--color-text-3)',
    padding: '2px 6px',
    borderRadius: 6,
  },
  listSection: { padding: '12px 20px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-3)', margin: '0 0 10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  agentRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: 8,
    marginBottom: 4,
    transition: 'background 100ms',
  },
  agentInfo: { display: 'flex', alignItems: 'center', gap: 10, flex: 1 },
  agentAvatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'var(--color-accent)',
    color: '#fff', fontWeight: 700, fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  agentName: { fontSize: 13, fontWeight: 600, color: 'var(--color-text)' },
  agentMeta: { fontSize: 11, color: 'var(--color-text-3)', marginTop: 1 },
  agentActions: { display: 'flex', gap: 4 },
  editBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14,
    padding: '4px 6px', borderRadius: 6,
  },
  deleteBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14,
    padding: '4px 6px', borderRadius: 6, color: '#ef4444',
  },
  formSection: {
    padding: '12px 20px 20px',
    borderTop: '1px solid var(--color-border)',
  },
  formGrid: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  label: { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--color-text)' },
  input: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
    outline: 'none',
  },
  formActions: { display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '7px 16px', borderRadius: 8,
    border: '1.5px solid var(--color-border)',
    background: 'transparent', color: 'var(--color-text)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  submitBtn: {
    padding: '7px 16px', borderRadius: 8,
    border: 'none',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
}
