/**
 * ProjectSelectPage — Project selection after login
 *
 * Shows list of projects user belongs to.
 * Option to create new project (user becomes owner/admin).
 */

import React, { useState } from 'react'
import { useAuthStore, type Project } from '../store/authStore.js'

export default function ProjectSelectPage() {
  const projects      = useAuthStore((s) => s.projects)
  const profile       = useAuthStore((s) => s.profile)
  const selectProject = useAuthStore((s) => s.selectProject)
  const createProject = useAuthStore((s) => s.createProject)
  const signOut       = useAuthStore((s) => s.signOut)
  const authError     = useAuthStore((s) => s.authError)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [creating, setCreating]     = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const id = await createProject(newName.trim(), newDesc.trim())
      if (id) {
        setShowCreate(false)
        setNewName('')
        setNewDesc('')
      }
    } finally {
      setCreating(false)
    }
  }

  const handleSelect = async (project: Project) => {
    await selectProject(project.id)
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgShape1} />
      <div style={styles.bgShape2} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logoIcon}>⬡</span>
            <span style={styles.logoText}>TerriMap</span>
          </div>
          <div style={styles.userRow}>
            <span style={styles.userAvatar}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
            <div>
              <div style={styles.userName}>{profile?.full_name || 'User'}</div>
              <div style={styles.userEmail}>{profile?.email}</div>
            </div>
            <button onClick={signOut} style={styles.signOutBtn}>
              Đăng xuất
            </button>
          </div>
        </div>

        <h2 style={styles.title}>Chọn dự án</h2>
        <p style={styles.desc}>
          Chọn một dự án để bắt đầu làm việc, hoặc tạo dự án mới.
        </p>

        {/* Error */}
        {authError && (
          <div style={styles.error}>⚠️ {authError}</div>
        )}

        {/* Project list */}
        <div style={styles.grid}>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              style={styles.projectCard}
            >
              <div style={styles.projectIcon}>📁</div>
              <div style={styles.projectName}>{p.name}</div>
              {p.description && (
                <div style={styles.projectDesc}>{p.description}</div>
              )}
              <div style={styles.projectDate}>
                Tạo: {new Date(p.created_at).toLocaleDateString('vi-VN')}
              </div>
            </button>
          ))}

          {/* Create new project button */}
          <button
            onClick={() => setShowCreate(true)}
            style={styles.createCard}
          >
            <div style={styles.createIcon}>＋</div>
            <div style={styles.createText}>Tạo dự án mới</div>
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>🗺️ Tạo dự án mới</h3>
              <form onSubmit={handleCreate} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Tên dự án</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ví dụ: Phân vùng Q1/2026"
                    required
                    style={styles.input}
                    autoFocus
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Mô tả (tuỳ chọn)</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Mô tả ngắn về dự án..."
                    style={{ ...styles.input, minHeight: 60, resize: 'vertical' } as React.CSSProperties}
                  />
                </div>
                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    style={styles.cancelBtn}
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    style={styles.confirmBtn}
                  >
                    {creating ? '⏳ Đang tạo...' : '✨ Tạo dự án'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    position: 'relative',
    overflow: 'auto',
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', Roboto, system-ui, sans-serif",
  },
  bgShape1: {
    position: 'fixed',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
    top: -150,
    right: -150,
  },
  bgShape2: {
    position: 'fixed',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
    bottom: -100,
    left: -100,
  },

  container: {
    position: 'relative',
    zIndex: 10,
    maxWidth: 720,
    margin: '0 auto',
    padding: '40px 24px',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: { fontSize: 28, color: '#818cf8' },
  logoText: { fontSize: 22, fontWeight: 800, color: '#fff' },

  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
  },
  userName: { color: '#fff', fontWeight: 600, fontSize: 14 },
  userEmail: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  signOutBtn: {
    marginLeft: 12,
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    cursor: 'pointer',
  },

  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 8,
  },
  desc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginBottom: 28,
  },
  error: {
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    fontSize: 13,
    marginBottom: 16,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
  },
  projectCard: {
    padding: 20,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 150ms, border-color 150ms, box-shadow 150ms',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  projectIcon: { fontSize: 28 },
  projectName: { fontSize: 16, fontWeight: 700, color: '#fff' },
  projectDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 },
  projectDate: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 'auto' },

  createCard: {
    padding: 20,
    borderRadius: 16,
    background: 'transparent',
    border: '2px dashed rgba(255,255,255,0.15)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 120,
    transition: 'border-color 200ms',
  },
  createIcon: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.3)',
  },
  createText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 600,
  },

  // Modal
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    width: 420,
    maxWidth: '90vw',
    padding: '28px 32px',
    borderRadius: 20,
    background: 'rgba(30,30,60,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 20,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '10px 24px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
  },
}
