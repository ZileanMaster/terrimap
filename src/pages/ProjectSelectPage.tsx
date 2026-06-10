import React, { useState } from 'react'
import { useAuthStore, type Project } from '../store/authStore.js'
import Button, { IconButton } from '../components/ui/Button.js'
import Input, { Textarea } from '../components/ui/Input.js'
import Modal from '../components/ui/Modal.js'
import { useToast } from '../components/ui/Toast.js'
import { useUIStore } from '../store/uiStore.js'

function ThemeIcon({ theme }: { theme: 'light' | 'dark' | 'system' }) {
  const common: React.SVGProps<SVGSVGElement> = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (theme === 'dark') {
    return <svg {...common} aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
  }
  if (theme === 'light') {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="M4.93 4.93l1.41 1.41" />
        <path d="M17.66 17.66l1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
      </svg>
    )
  }
  return (
    <svg {...common} aria-hidden="true">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 18v2" />
    </svg>
  )
}

export default function ProjectSelectPage() {
  const projects = useAuthStore((s) => s.projects)
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const selectProject = useAuthStore((s) => s.selectProject)
  const updateProject = useAuthStore((s) => s.updateProject)
  const deleteProject = useAuthStore((s) => s.deleteProject)
  const signOut = useAuthStore((s) => s.signOut)
  const authError = useAuthStore((s) => s.authError)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const { push } = useToast()

  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
  }

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject) return
    if (!editName.trim()) return
    if (savingEdit) return

    setSavingEdit(true)
    const ok = await updateProject(editingProject.id, {
      name: editName.trim(),
      description: editDesc.trim(),
    })
    setSavingEdit(false)

    if (ok) {
      push({ kind: 'success', title: 'Đã cập nhật dự án', message: editName.trim() })
      setEditingProject(null)
    } else {
      push({ kind: 'error', title: 'Không thể cập nhật dự án', message: useAuthStore.getState().authError || 'Vui lòng thử lại.' })
    }
  }

  const handleSelect = async (project: Project) => {
    await selectProject(project.id)
  }

  const canManageProject = (project: Project) => project.owner_id === user?.id

  const openEditProject = (project: Project) => {
    setEditingProject(project)
    setEditName(project.name)
    setEditDesc(project.description ?? '')
  }

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Xóa dự án "${project.name}"? Hành động này sẽ xóa thông tin dự án khỏi danh sách.`)) return
    const ok = await deleteProject(project.id)
    if (ok) {
      push({ kind: 'success', title: 'Đã xóa dự án', message: project.name })
      if (editingProject?.id === project.id) setEditingProject(null)
    } else {
      push({ kind: 'error', title: 'Không thể xóa dự án', message: useAuthStore.getState().authError || 'Vui lòng thử lại.' })
    }
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
            <IconButton onClick={cycleTheme} title="Giao diện (Light/Dark/System)" style={styles.themeBtn}>
              <ThemeIcon theme={theme} />
            </IconButton>
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
            <div
              key={project.id}
              style={{
                ...styles.projectCard,
                ...(index === 0 ? styles.projectCardFeatured : {}),
              }}
            >
              <div style={styles.projectTop}>
                <div style={styles.projectIcon}>PR</div>
                <span style={styles.projectChip}>M? d? ?n</span>
              </div>
              <div style={styles.projectName}>{project.name}</div>
              {project.description && <div style={styles.projectDesc}>{project.description}</div>}
              <div style={styles.projectMeta}>
                <span>T?o ng?y</span>
                <strong>{new Date(project.created_at).toLocaleDateString('vi-VN')}</strong>
              </div>
              <div style={styles.projectActions}>
                <Button type="button" variant="primary" size="sm" onClick={() => handleSelect(project)} style={styles.openBtn}>
                  M? d? ?n
                </Button>
                {canManageProject(project) && (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditProject(project)}>
                      S?a
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => handleDeleteProject(project)}>
                      X?a
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          <div
            role="note"
            aria-live="polite"
            style={{
              ...styles.createCard,
              cursor: 'default',
              borderStyle: 'dashed',
              opacity: 0.9,
            }}
          >
            <div style={styles.createIcon}>?</div>
            <div style={styles.createTitle}>T?o d? ?n m?i t?m t?t</div>
            <div style={styles.createDesc}>
              T?i kho?n m?i s? t? ??ng v?o d? ?n m?c ??nh c?a admin.test@terrimap.vn.
              {' '}
              Ch?c n?ng t?o d? ?n m?i hi?n ???c ?n ?? tr?nh ph?t sinh d? li?u r?i r?c.
            </div>
          </div>
        </div>

        <Modal
          open={!!editingProject}
          onClose={() => (!savingEdit ? setEditingProject(null) : null)}
          title="S?a th?ng tin d? ?n"
          description="C?p nh?t t?n v? m? t? c?a d? ?n."
          width={520}
          footer={(
            <>
              <Button type="button" variant="ghost" onClick={() => setEditingProject(null)} disabled={savingEdit}>
                H?y
              </Button>
              <Button
                type="submit"
                variant="primary"
                form="edit-project-form"
                disabled={savingEdit || !editName.trim()}
              >
                {savingEdit ? '?ang l?u...' : 'L?u thay ??i'}
              </Button>
            </>
          )}
        >
          <form id="edit-project-form" onSubmit={handleUpdateProject} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>T?n d? ?n</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="T?n d? ?n"
                autoFocus
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>M? t?</label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="M? t? ng?n v? d? ?n..."
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
    fontFamily: 'Roboto, Segoe UI, system-ui, sans-serif',
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
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    flexShrink: 0,
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
  projectCardPending: {
    opacity: 0.9,
    borderStyle: 'dashed',
    cursor: 'default',
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
  projectActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  openBtn: {
    marginRight: 'auto',
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
