/**
 * MemberManager — Project member management modal
 *
 * Features:
 * - View all members with their roles
 * - Invite new members by email
 * - Change member roles (with hierarchy enforcement)
 * - Remove members (with last-admin guard)
 *
 * Role hierarchy: admin > coordinator > sales
 * - Admin can invite/change to any role
 * - Coordinator can only invite sales
 * - Sales cannot invite anyone
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import type { ProjectMember, Profile } from '../../store/authStore.js'
import { supabase } from '../../lib/supabase.js'

// Role display config
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

  // Load members with profile info — guaranteed to finish in ≤6s
  const reload = useCallback(async () => {
    if (!supabase || !currentProjectId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const doLoad = async (): Promise<MemberWithProfile[]> => {
      // Step 1: Get raw members (no join — more reliable)
      const { data: rawMembers, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', currentProjectId)
        .order('joined_at', { ascending: true })

      if (error) {
        console.warn('[MemberManager] query error:', error.message)
        return []
      }
      if (!rawMembers || rawMembers.length === 0) return []

      // Step 2: Get profiles for these members
      const userIds = rawMembers.map((m: any) => m.user_id)
      const { data: profiles } = await supabase
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
      // Hard 6s timeout — never hangs
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
  }, [currentProjectId])

  useEffect(() => {
    if (open) {
      clearError()
      reload()
    }
  }, [open, reload, clearError])

  // Count admins
  const adminCount = members.filter(m => m.role === 'admin').length

  // Roles that the current user can assign
  // Admin can assign ALL roles (including admin). Coordinator can assign sales only.
  const assignableRoles: string[] = myRole === 'admin'
    ? ['admin', 'coordinator', 'sales']
    : myRole === 'coordinator'
      ? ['sales']
      : []

  // Handle invite — try/finally guarantees UI never stays frozen
  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return
    setSubmitting(true)
    clearError()
    try {
      // 10s timeout: if Supabase hangs, unlock UI
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        setSubmitting(false)
        alert('⏳ Mời thành viên bị timeout. Vui lòng thử lại.')
      }, 10_000)

      const ok = await inviteMember(inviteEmail.trim(), inviteRole)
      clearTimeout(timeoutId)
      if (timedOut) return  // timeout already handled

      if (ok) {
        setInviteEmail('')
        setInviteOpen(false)
        reload()  // fire-and-forget, don't await
      }
    } catch (e) {
      console.error('[MemberManager] invite error:', e)
      alert('❌ Lỗi khi mời thành viên. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }, [inviteEmail, inviteRole, inviteMember, clearError, reload])

  // Handle role change — with try/finally
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

  // Handle remove — with try/finally
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
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>👥 Quản lý thành viên</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {/* Error banner */}
        {authError && (
          <div style={styles.errorBanner}>
            ⚠️ {authError}
            <button onClick={clearError} style={styles.errorClose}>×</button>
          </div>
        )}

        {/* Member list */}
        <div style={styles.listSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>
              Thành viên ({members.length})
            </h3>
            {/* Only admin and coordinator can invite */}
            {myLevel >= 2 && (
              <button
                onClick={() => setInviteOpen(!inviteOpen)}
                style={styles.inviteToggleBtn}
              >
                {inviteOpen ? '✕ Đóng' : '➕ Mời thành viên'}
              </button>
            )}
          </div>

          {/* Invite form (inline) */}
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
              const canManage = !isSelf && memberLevel < myLevel

              return (
                <div
                  key={member.id}
                  style={{
                    ...styles.memberRow,
                    ...(isSelf ? styles.memberRowSelf : {}),
                  }}
                >
                  {/* Avatar + Info */}
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

                  {/* Role badge + Actions */}
                  <div style={styles.memberActions}>
                    {canManage ? (
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

        {/* Role legend */}
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
