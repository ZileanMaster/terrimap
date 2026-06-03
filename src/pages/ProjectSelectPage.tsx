import React, { useState } from 'react'
import { useAuthStore, type Project } from '../store/authStore.js'
import Button from '../components/ui/Button.js'
import Input, { Textarea } from '../components/ui/Input.js'
import Modal from '../components/ui/Modal.js'
import { useToast } from '../components/ui/Toast.js'

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
      } else {
        push({ kind: 'error', title: 'Không tạo được dự án', message: useAuthStore.getState().authError || 'Vui lòng thử lại.' })
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
      <div style={styles.glowA} />
      <div style={styles.glowB} />

      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>TerriMap</div>
            <h1 style={styles.title}>Chọn dự án làm việc</h1>
            <p style={styles.desc}>
              Mỗi dự án giữ một tập dữ liệu riêng. Chọn dự án để đi vào bản đồ, phân chia lãnh thổ và báo cáo cụm.
            </p>
          </div>

          <div style={styles.userBlock}>
            <div style={styles.avatar}>{profile?.full_name?.charAt(0)?.toUpperCase() || 'T'}</div>
            <div style={styles.userMeta}>
              <div style={styles.userName}>{profile?.full_name || 'Tài khoản'}</div>
              <div style={styles.userEmail}>{profile?.email}</div>
            </div>
            <Button onClick={signOut} variant="ghost" style={styles.signOutBtn}>
              Đăng xuất
            </Button>
          </div>
        </div>

        {authError && (
          <div style={styles.error} role="alert">
            {authError}
          </div>
        )}

        <div style={styles.grid}>
          {projects.map((project, index) => (
            <button
              key={project.id}
              type="button"
              onClick={() => handleSelect(project)}
              style={{
                ...styles.projectCard,
                ...(index === 0 ? styles.projectCardFeatured : {}),
              }}
            >
              <div style={styles.projectTop}>
                <div style={styles.projectIcon}>PR</div>
                <span style={styles.projectChip}>Mở dự án</span>
              </div>
              <div style={styles.projectName}>{project.name}</div>
              {project.description && <div style={styles.projectDesc}>{project.description}</div>}
              <div style={styles.projectMeta}>
                <span>Tạo ngày</span>
                <strong>{new Date(project.created_at).toLocaleDateString('vi-VN')}</strong>
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={styles.createCard}
          >
            <div style={styles.createIcon}>+</div>
            <div style={styles.createTitle}>Tạo dự án mới</div>
            <div style={styles.createDesc}>Thêm một không gian làm việc mới với tên và mô tả riêng.</div>
          </button>
        </div>

        <Modal
          open={showCreate}
          onClose={() => (!creating ? setShowCreate(false) : null)}
          title="Tạo dự án mới"
          description="Dùng tên ngắn gọn, dễ nhận diện theo khu vực hoặc thời gian."
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
                {creating ? 'Đang tạo...' : 'Tạo dự án'}
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
              <label style={styles.label}>Mô tả</label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Mô tả ngắn về dự án..."
                rows={4}
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
    minHeight: '100dvh',
    position: 'relative',
    overflow: 'hidden',
    background: 'radial-gradient(circle at top right, color-mix(in srgb, var(--color-accent) 14%, transparent) 0, transparent 30%), linear-gradient(180deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 84%, #000) 100%)',
    padding: '24px',
  },
  glowA: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: '50%',
    background: 'radial-gradient(circle, color-mix(in srgb, var(--color-success) 16%, transparent) 0%, transparent 72%)',
    pointerEvents: 'none',
  },
  glowB: {
    position: 'absolute',
    bottom: -160,
    left: -100,
    width: 420,
    height: 420,
    borderRadius: '50%',
    background: 'radial-gradient(circle, color-mix(in srgb, var(--color-info) 16%, transparent) 0%, transparent 72%)',
    pointerEvents: 'none',
  },
  container: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1240,
    margin: '0 auto',
    minHeight: 'calc(100dvh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 18,
    flexWrap: 'wrap',
    border: '1px solid var(--color-border)',
    borderRadius: 28,
    background: 'color-mix(in srgb, var(--color-surface) 94%, transparent)',
    boxShadow: '0 24px 56px rgba(0,0,0,.18)',
    padding: 24,
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: '.12em',
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--color-text-2)',
  },
  title: {
    marginTop: 8,
    fontSize: 'clamp(1.8rem, 3vw, 3rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
    color: 'var(--color-text)',
  },
  desc: {
    marginTop: 12,
    maxWidth: 680,
    color: 'var(--color-text-2)',
    lineHeight: 1.65,
  },
  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid var(--color-border)',
    borderRadius: 18,
    background: 'var(--color-surface)',
    padding: 10,
    marginLeft: 'auto',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: 'var(--color-accent)',
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    fontWeight: 900,
    flexShrink: 0,
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  userName: {
    color: 'var(--color-text)',
    fontWeight: 900,
    fontSize: 14,
  },
  userEmail: {
    color: 'var(--color-text-2)',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 220,
  },
  signOutBtn: {
    marginLeft: 4,
  },
  error: {
    border: '1px solid rgba(220,38,38,.25)',
    background: 'rgba(220,38,38,.10)',
    color: 'var(--color-danger)',
    borderRadius: 16,
    padding: '12px 14px',
    fontSize: 13,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
  projectCard: {
    border: '1px solid var(--color-border)',
    borderRadius: 22,
    background: 'color-mix(in srgb, var(--color-surface) 95%, transparent)',
    padding: 18,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    color: 'var(--color-text)',
    minHeight: 180,
  },
  projectCardFeatured: {
    borderColor: 'color-mix(in srgb, var(--color-accent) 35%, var(--color-border))',
    boxShadow: '0 18px 36px rgba(0,0,0,.12)',
  },
  projectTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--color-surface-2)',
    color: 'var(--color-accent)',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '.1em',
  },
  projectChip: {
    border: '1px solid var(--color-border)',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    color: 'var(--color-text-2)',
    fontWeight: 800,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: '-0.02em',
  },
  projectDesc: {
    color: 'var(--color-text-2)',
    fontSize: 13,
    lineHeight: 1.55,
    flex: 1,
  },
  projectMeta: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 12,
    color: 'var(--color-text-2)',
  },
  createCard: {
    border: '1px dashed color-mix(in srgb, var(--color-border) 80%, var(--color-accent))',
    borderRadius: 22,
    background: 'transparent',
    padding: 18,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    color: 'var(--color-text)',
    minHeight: 180,
    justifyContent: 'center',
  },
  createIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--color-surface-2)',
    color: 'var(--color-accent)',
    fontSize: 22,
    fontWeight: 800,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: '-0.02em',
  },
  createDesc: {
    color: 'var(--color-text-2)',
    fontSize: 13,
    lineHeight: 1.55,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: 'var(--color-text-2)',
  },
}
