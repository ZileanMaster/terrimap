import React, { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import type { ProjectMember, Profile } from '../../store/authStore.js'
import { supabase } from '../../lib/supabase.js'

// Cấu hình hiển thị vai trò
const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string; level: number }> = {
  admin:       { label: 'Quản trị',   color: '#f59e0b', icon: '👑', level: 3 },
  coordinator: { label: 'Điều phối',  color: '#3b82f6', icon: '📋', level: 2 },
  sales:       { label: 'Bán hàng',   color: '#22c55e', icon: '💼', level: 1 },
}

interface MemberWithProfile extends ProjectMember {
  profile?: { email: string; full_name: string }
}

interface MemberManagerProps {
  open: boolean
  onClose: () => void
}

export default function MemberManager({ open, onClose }: MemberManagerProps) {
  const membership    = useAuthStore((s) => s.membership)
  const inviteMember  = useAuthStore((s) => s.inviteMember)
  const updateRole    = useAuthStore((s) => s.updateMemberRole)
  const removeMember  = useAuthStore((s) => s.removeMember)
  const blockMember   = useAuthStore((s) => s.blockMember)
  const unblockMember = useAuthStore((s) => s.unblockMember)
  const loadMembers   = useAuthStore((s) => s.loadMembers)
  const clearError    = useAuthStore((s) => s.clearError)
  const authError     = useAuthStore((s) => s.authError)
  const currentProjectId = useAuthStore((s) => s.currentProjectId)
  const user          = useAuthStore((s) => s.user)

  const [members, setMembers]       = useState<MemberWithProfile[]>([])
  const [loading, setLoading]       = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<string>('sales')
  const [submitting, setSubmitting]   = useState(false)

  const myRole  = membership?.role ?? 'sales'
  const myLevel = ROLE_CONFIG[myRole]?.level ?? 0

  // Tải thành viên kèm hồ sơ
  const reload = useCallback(async () => {
    const client = supabase
    if (!client || !currentProjectId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const doLoad = async (): Promise<MemberWithProfile[]> => {
      // Lấy danh sách thành viên
      const rawMembers = await loadMembers(true)
      if (!rawMembers || rawMembers.length === 0) return []

      // Lấy hồ sơ người dùng
      const userIds = rawMembers.map((m: any) => m.user_id)
      const { data: profiles } = await client
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds)

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
      return rawMembers.map((m: any) => ({
        ...m,
        profile: profileMap.get(m.user_id) ?? undefined,
      })) as MemberWithProfile[]
    }

    try {
      const timeout = new Promise<MemberWithProfile[]>((resolve) =>
        setTimeout(() => {
          console.error('[MemberManager] Load timeout (6s)')
          resolve([])
        }, 6_000),
      )

      const result = await Promise.race([doLoad(), timeout])
      setMembers(result)
    } catch (e) {
      console.error('[MemberManager] load error:', e)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [currentProjectId, loadMembers])

  useEffect(() => {
    if (open) {
      clearError()
      reload()
    }
  }, [open, reload, clearError])

  // Đếm số admin
  const adminCount = members.filter(m => m.role === 'admin' && m.status !== 'blocked').length

  // Xác định vai trò có thể phân quyền
  const assignableRoles: string[] = myRole === 'admin'
    ? ['admin', 'coordinator', 'sales']
    : myRole === 'coordinator'
      ? ['sales']
      : []

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return
    setSubmitting(true)
    clearError()
    try {
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        setSubmitting(false)
        alert('⏳ Vui lòng thử lại.')
      }, 10_000)

      const ok = await inviteMember(inviteEmail.trim(), inviteRole)
      clearTimeout(timeoutId)
      if (timedOut) return

      if (ok) {
        setInviteEmail('')
        setInviteOpen(false)
        reload()
      }
    } catch (e) {
      console.error('[MemberManager] invite error:', e)
      alert('❌ Lỗi khi mời thành viên. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }, [inviteEmail, inviteRole, inviteMember, clearError, reload])

  const handleToggleRestriction = useCallback(async (member: MemberWithProfile) => {
    if (member.status === 'blocked') {
      if (!window.confirm(`Bỏ chặn ${member.profile?.full_name ?? 'thành viên'}?`)) return
      await unblockMember(member.id)
      reload()
      return
    }

    if (member.role === 'admin' && adminCount <= 1) {
      alert('Phải có ít nhất 1 quản trị viên trong dự án')
      return
    }

    const reason = window.prompt(`Lý do hạn chế ${member.profile?.full_name ?? 'thành viên'} (không bắt buộc):`, '') ?? ''
    if (!window.confirm(`Hạn chế ${member.profile?.full_name ?? 'thành viên'} khỏi dự án?`)) return
    await blockMember(member.id, reason)
    reload()
  }, [adminCount, blockMember, unblockMember, reload])

  const handleRoleChange = useCallback(async (member: MemberWithProfile, newRole: string) => {
    if (member.user_id === user?.id) {
      alert('Không thể tự đổi vai trò của mình')
      return
    }
    const targetLevel = ROLE_CONFIG[newRole]?.level ?? 0
    if (targetLevel > myLevel) {
      alert('Không thể phân quyền cao hơn vai trò của bạn')
      return
    }
    if (member.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
      alert('Phải có ít nhất 1 quản trị viên trong dự án')
      return
    }
    if (!window.confirm(`Đổi vai trò ${member.profile?.full_name ?? 'thành viên'} thành ${ROLE_CONFIG[newRole]?.label}?`)) return
    try {
      await updateRole(member.id, newRole)
      reload()
    } catch (e) {
      console.error('[MemberManager] role change error:', e)
      alert('❌ Lỗi khi đổi vai trò. Vui lòng thử lại.')
    }
  }, [user, myLevel, adminCount, updateRole, reload])

  // Xoá thành viên
  const handleRemove = useCallback(async (member: MemberWithProfile) => {
    if (member.user_id === user?.id) {
      alert('Không thể tự xóa mình khỏi dự án')
      return
    }
    const memberLevel = ROLE_CONFIG[member.role]?.level ?? 0
    if (memberLevel >= myLevel) {
      alert('Không thể xóa thành viên có vai trò bằng hoặc cao hơn bạn')
      return
    }
    if (member.role === 'admin' && adminCount <= 1) {
      alert('Không thể xóa quản trị viên duy nhất')
      return
    }
    if (!window.confirm(`Xóa ${member.profile?.full_name ?? member.user_id} khỏi dự án?`)) return
    try {
      await removeMember(member.id)
      reload()
    } catch (e) {
      console.error('[MemberManager] remove error:', e)
      alert('❌ Lỗi khi xóa thành viên. Vui lòng thử lại.')
    }
  }, [user, myLevel, adminCount, removeMember, reload])

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>👥 Quản lý thành viên</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {/* Banner lỗi */}
        {authError && (
          <div style={styles.errorBanner}>
            ⚠️ {authError}
            <button onClick={clearError} style={styles.errorClose}>×</button>
          </div>
        )}

        {/* Danh sách thành viên */}
        <div style={styles.listSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>
              Thành viên ({members.length})
            </h3>
            {myLevel >= 2 && (
              <button
                onClick={() => setInviteOpen(!inviteOpen)}
                style={styles.inviteToggleBtn}
              >
                {inviteOpen ? '✕ Đóng' : '➕ Mời thành viên'}
              </button>
            )}
          </div>

          {inviteOpen && (
            <div style={styles.inviteForm}>
              <input
                type="email"
                placeholder="Email tài khoản..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={styles.input}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={styles.selectInput}
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_CONFIG[r]?.icon} {ROLE_CONFIG[r]?.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleInvite}
                disabled={submitting || !inviteEmail.trim()}
                style={{
                  ...styles.inviteBtn,
                  opacity: (submitting || !inviteEmail.trim()) ? 0.5 : 1,
                }}
              >
                {submitting ? '⏳' : '📩 Mời'}
              </button>
            </div>
          )}

          {loading ? (
            <div style={styles.emptyState}>Đang tải...</div>
          ) : members.length === 0 ? (
            <div style={styles.emptyState}>Chưa có thành viên nào</div>
          ) : (
            members.map((member) => {
              const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.sales!
              const isSelf = member.user_id === user?.id
              const memberLevel = cfg.level
              const canManage = !isSelf && memberLevel < myLevel && member.status !== 'blocked'

              return (
                <div
                  key={member.id}
                  style={{
                    ...styles.memberRow,
                    ...(isSelf ? styles.memberRowSelf : {}),
                  }}
                >
                  {/* Avatar + thông tin */}
                  <div style={styles.memberInfo}>
                    <div style={{ ...styles.avatar, background: cfg.color }}>
                      {member.profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div style={styles.memberDetails}>
                      <div style={styles.memberName}>
                        {member.profile?.full_name ?? 'Unknown'}
                        {isSelf && <span style={styles.selfBadge}> (bạn)</span>}
                      </div>
                      <div style={styles.memberEmail}>
                        {member.profile?.email ?? member.user_id}
                      </div>
                    </div>
                  </div>

                  {/* Badge vai trò + thao tác */}
                  <div style={styles.memberActions}>
                    {member.status === 'blocked' ? (
                      <span
                        style={{
                          ...styles.roleBadge,
                          background: 'rgba(148,163,184,0.18)',
                          color: '#64748b',
                          borderColor: 'rgba(148,163,184,0.35)',
                        }}
                      >
                        🚫 Hạn chế
                      </span>
                    ) : canManage ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value)}
                        style={{
                          ...styles.roleBadge,
                          background: `${cfg.color}20`,
                          color: cfg.color,
                          borderColor: `${cfg.color}40`,
                          cursor: 'pointer',
                        }}
                      >
                        {assignableRoles.map((key) => {
                          const c = ROLE_CONFIG[key]!
                          return (
                            <option key={key} value={key}>
                              {c.icon} {c.label}
                            </option>
                          )
                        })}
                      </select>
                    ) : (
                      <span
                        style={{
                          ...styles.roleBadge,
                          background: `${cfg.color}20`,
                          color: cfg.color,
                          borderColor: `${cfg.color}40`,
                        }}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleToggleRestriction(member)}
                        style={styles.removeBtn}
                        title="Hạn chế khỏi dự án"
                      >
                        🚫
                      </button>
                    )}

                    {member.status === 'blocked' && (
                      <button
                        onClick={() => handleToggleRestriction(member)}
                        style={styles.removeBtn}
                        title="Bỏ hạn chế"
                      >
                        ↩️
                      </button>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleRemove(member)}
                        style={styles.removeBtn}
                        title="Xóa khỏi dự án"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Chú thích vai trò */}
        <div style={styles.legend}>
          <div style={styles.legendTitle}>📖 Phân cấp quyền hạn</div>
          <div style={styles.legendItems}>
            <span style={styles.legendItem}>👑 Admin → mời tất cả</span>
            <span style={styles.legendItem}>📋 Điều phối → mời nhân viên</span>
            <span style={styles.legendItem}>💼 Nhân viên → chỉ xem</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--color-surface)', borderRadius: 16,
    border: '1.5px solid var(--color-border)',
    width: '90%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' as const,
    boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)',
  },
  headerTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' },
  closeBtn: {
    border: 'none', background: 'transparent', fontSize: 22,
    cursor: 'pointer', color: 'var(--color-text-3)', padding: '2px 6px', borderRadius: 6,
  },
  errorBanner: {
    margin: '8px 20px 0', padding: '8px 12px', borderRadius: 8,
    background: 'rgba(239,68,68,0.12)', color: '#ef4444',
    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorClose: {
    border: 'none', background: 'transparent', color: '#ef4444',
    fontSize: 16, cursor: 'pointer', padding: '0 4px',
  },
  listSection: { padding: '12px 20px 16px' },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--color-text-3)', margin: 0,
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  },
  inviteToggleBtn: {
    padding: '5px 12px', borderRadius: 7,
    border: '1.5px solid var(--color-accent)', background: 'transparent',
    color: 'var(--color-accent)', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all 150ms',
  },
  inviteForm: {
    display: 'flex', gap: 6, marginBottom: 14, padding: '10px 12px',
    borderRadius: 10, background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
  },
  input: {
    flex: 1, padding: '7px 10px', borderRadius: 6,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: 13, outline: 'none', minWidth: 0,
  },
  selectInput: {
    padding: '7px 8px', borderRadius: 6,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: 12, outline: 'none', cursor: 'pointer',
  },
  inviteBtn: {
    padding: '7px 14px', borderRadius: 7, border: 'none',
    background: 'var(--color-accent)', color: '#fff',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  },
  emptyState: {
    padding: '20px 0', textAlign: 'center' as const,
    color: 'var(--color-text-3)', fontSize: 13,
  },
  memberRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderRadius: 10, marginBottom: 4,
    transition: 'background 100ms',
  },
  memberRowSelf: {
    background: 'rgba(99,102,241,0.06)',
    border: '1px solid rgba(99,102,241,0.15)',
  },
  memberInfo: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    color: '#fff', fontWeight: 700, fontSize: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  memberDetails: { flex: 1, minWidth: 0 },
  memberName: {
    fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  selfBadge: { fontSize: 11, color: 'var(--color-accent)', fontWeight: 400 },
  memberEmail: {
    fontSize: 11, color: 'var(--color-text-3)', marginTop: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  memberActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  roleBadge: {
    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    border: '1.5px solid', display: 'inline-block',
  },
  removeBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 14, padding: '4px 6px', borderRadius: 6,
    opacity: 0.6, transition: 'opacity 150ms',
  },
  legend: {
    padding: '12px 20px 16px', borderTop: '1px solid var(--color-border)',
  },
  legendTitle: {
    fontSize: 12, fontWeight: 700, color: 'var(--color-text-3)',
    marginBottom: 6,
  },
  legendItems: { display: 'flex', gap: 16, flexWrap: 'wrap' as const },
  legendItem: { fontSize: 11, color: 'var(--color-text-3)' },
}
