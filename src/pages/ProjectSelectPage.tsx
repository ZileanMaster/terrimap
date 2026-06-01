/**
 * ProjectSelectPage — Select or create a project after login
 *
 * - List projects user belongs to
 * - Create project in a modal
 */

import React, { useState } from 'react'
import { useAuthStore, type Project } from '../store/authStore.js'
import Button from '../components/ui/Button.js'
import Input, { Textarea } from '../components/ui/Input.js'
import Modal from '../components/ui/Modal.js'
import ToastViewport, { useToast } from '../components/ui/Toast.js'

export default function ProjectSelectPage() {
  const projects = useAuthStore((s) => s.projects)
  const profile = useAuthStore((s) => s.profile)
  const selectProject = useAuthStore((s) => s.selectProject)
  const createProject = useAuthStore((s) => s.createProject)
  const signOut = useAuthStore((s) => s.signOut)
  const authError = useAuthStore((s) => s.authError)

  const { push } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const id = await createProject(newName.trim(), newDesc.trim())
      if (id) {
        push({ kind: 'success', title: 'Đã tạo dự án', message: newName.trim() })
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
      <ToastViewport />

      <div style={styles.bgShape1} />
      <div style={styles.bgShape2} />

      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logoIcon}>⬡</span>
            <span style={styles.logoText}>TerriMap</span>
          </div>

          <div style={styles.userRow}>
            <span style={styles.userAvatar}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
            <div style={styles.userMeta}>
              <div style={styles.userName}>{profile?.full_name || 'User'}</div>
              <div style={styles.userEmail}>{profile?.email}</div>
            </div>
            <Button onClick={signOut} variant="ghost" style={styles.signOutBtn}>
              Đăng xuất
            </Button>
          </div>
        </div>

        <h2 style={styles.title}>Chọn dự án</h2>
        <p style={styles.desc}>
          Chọn một dự án để bắt đầu làm việc, hoặc tạo dự án mới.
        </p>

        {authError && (
          <div style={styles.error} role="alert">
            ⚠ {authError}
          </div>
        )}

        <div style={styles.grid}>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              style={styles.projectCard}
            >
              <div style={styles.projectIcon}>📁</div>
              <div style={styles.projectName}>{p.name}</div>
              {p.description && <div style={styles.projectDesc}>{p.description}</div>}
              <div style={styles.projectDate}>
                Tạo: {new Date(p.created_at).toLocaleDateString('vi-VN')}
              </div>
            </button>
          ))}

          <button onClick={() => setShowCreate(true)} style={styles.createCard}>
            <div style={styles.createIcon}>＋</div>
            <div style={styles.createText}>Tạo dự án mới</div>
          </button>
        </div>

        <Modal
          open={showCreate}
          onClose={() => (!creating ? setShowCreate(false) : null)}
          title="Tạo dự án mới"
          description="Tên dự án nên ngắn gọn, dễ nhận biết theo thời gian/khu vực."
          width={520}
          footer={(
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                form="create-project-form"
                disabled={creating || !newName.trim()}
              >
                {creating ? '⏳ Đang tạo…' : 'Tạo dự án'}
              </Button>
            </>
          )}
        >
          <form id="create-project-form" onSubmit={handleCreate} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Tên dự án</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ví dụ: Phân vùng Q1/2026"
                autoFocus
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Mô tả (tùy chọn)</label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Mô tả ngắn về dự án…"
                rows={3}
              />
            </div>
          </form>
        </Modal>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', Roboto, system-ui, sans-serif",
  },
  bgShape1: {
    position: 'fixed',
    width: 520,
    height: 520,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
    top: -170,
    right: -170,
  },
  bgShape2: {
    position: 'fixed',
    width: 420,
    height: 420,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
    bottom: -120,
    left: -120,
  },
  container: {
    position: 'relative',
    zIndex: 10,
    maxWidth: 920,
    margin: '0 auto',
    padding: '40px 24px 56px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 36,
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
    minWidth: 0,
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
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  userMeta: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  userName: { color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userEmail: { color: 'rgba(255,255,255,0.45)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  signOutBtn: {
    borderColor: 'rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.75)',
  },
  title: { color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 8 },
  desc: { color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 22 },
  error: {
    padding: '10px 14px',
    borderRadius: 12,
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    fontSize: 13,
    marginBottom: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  projectCard: {
    padding: 18,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.10)',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#fff',
  },
  projectIcon: { fontSize: 26 },
  projectName: { fontSize: 16, fontWeight: 800 },
  projectDesc: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 },
  projectDate: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 'auto' },

  createCard: {
    padding: 18,
    borderRadius: 18,
    background: 'transparent',
    border: '2px dashed rgba(255,255,255,0.15)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 120,
    color: 'rgba(255,255,255,0.55)',
  },
  createIcon: { fontSize: 32, color: 'rgba(255,255,255,0.35)', lineHeight: 1 },
  createText: { fontSize: 14, fontWeight: 700 },

  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
}

