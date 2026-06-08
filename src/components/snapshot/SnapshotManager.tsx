/**
 * SnapshotManager — Khối lưu / tải bản đồ
 *
 * Đặt tuyệt đối ở góc trên bên phải khu vực bản đồ.
 * Lưu: hỏi tên → saveSnapshot toàn bộ zones + assignments
 * Tải: danh sách xổ xuống → khôi phục zones + assignments vào store toàn cục
 *
 * Hoạt động cả ở chế độ online (Supabase) và offline (localStorage).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { saveSnapshot, loadSnapshots, deleteSnapshot } from '../../services/db.js'
import { supabase, isOnline } from '../../lib/supabase.js'
import SnapshotCompare from './SnapshotCompare.js'

// Adjust 3: Thêm period field vào SnapshotItem (exported for SnapshotCompare)
export interface SnapshotItem {
  id:         string
  label:      string
  data:       { zones: any[]; assignments: any[] }
  created_at: string
  period?:    string   // '2026-04' — tùy chọn, gắn tháng
}

export default function SnapshotManager() {
  const [snapshots, setSnapshots]   = useState<SnapshotItem[]>([])
  const [isOpen, setIsOpen]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = useState<string>('all')

  // Giai ?o?n 3D: ch? ?? so s?nh
  const [compareMode, setCompareMode]             = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<SnapshotItem[]>([])
  const [comparingPair, setComparingPair]           = useState<[SnapshotItem, SnapshotItem] | null>(null)

  const zones          = useDataStore((s) => s.zones)
  const assignments    = useDataStore((s) => s.assignments)
  const currentProjectId = useDataStore((s) => s.currentProjectId)
  const setZones       = useDataStore((s) => s.setZones)
  const setAssignments = useDataStore((s) => s.setAssignments)

  const reloadSnapshots = useCallback(async () => {
    const data = await loadSnapshots(currentProjectId ?? undefined)
    setSnapshots(data as SnapshotItem[])
  }, [currentProjectId])

  // T?i snapshots khi mount v? m?i khi project thay ??i.
  useEffect(() => {
    void reloadSnapshots().catch((error) => {
      console.error('[SnapshotManager] load error:', error)
    })
  }, [reloadSnapshots, currentProjectId])

  // ??ng b? tr?c ti?p: khi admin/?i?u ph?i kh?c l?u snapshot trong c?ng project,
  // t? ??ng l?m m?i dropdown n?y.
  useEffect(() => {
    if (!currentProjectId || !isOnline()) return

    const channel = supabase!
      .channel(`snapshots:${currentProjectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'snapshots',
          filter: `project_id=eq.${currentProjectId}`,
        },
        () => {
          void reloadSnapshots().catch((error) => {
            console.error('[SnapshotManager] realtime refresh error:', error)
          })
        },
      )
      .subscribe()

    return () => {
      void supabase!.removeChannel(channel)
    }
  }, [currentProjectId, reloadSnapshots])

  // C? ch? polling d? ph?ng n?u Realtime kh?ng kh? d?ng trong project hi?n t?i.
  useEffect(() => {
    if (!currentProjectId) return

    const timer = window.setInterval(() => {
      void reloadSnapshots().catch((error) => {
        console.error('[SnapshotManager] polling refresh error:', error)
      })
    }, 15_000)

    return () => window.clearInterval(timer)
  }, [currentProjectId, reloadSnapshots])

  // ??ng dropdown khi b?m ra ngo?i
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-snapshot-manager]')) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const handleSave = useCallback(async () => {
    if (zones.length === 0) {
      alert('⚠️ Chưa có vùng nào để lưu. Hãy vẽ hoặc import vùng trước.')
      return
    }
    const defaultLabel = snapshots[0]?.label?.trim() || ''
    const label = window.prompt('Tên bản đồ:', defaultLabel)
    if (!label?.trim()) return

    // L?y period hi?n t?i t? URL ho?c m?c ??nh l? th?ng hi?n t?i
    const now    = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    setSaving(true)
    try {
      const id = `snap-${Date.now()}`
      const createdAt = new Date().toISOString()
      const snapshot: SnapshotItem = {
        id,
        label: label.trim(),
        data: { zones, assignments },
        created_at: createdAt,
        period,
      }

      setSnapshots((prev) => [snapshot, ...prev.filter((s) => s.id !== id)].slice(0, 50))
      await saveSnapshot(id, label.trim(), { zones, assignments }, period, currentProjectId ?? undefined)
      void reloadSnapshots().catch(() => {
        // Gi? state local theo ki?u optimistic n?u vi?c refresh th?t b?i.
      })
      // Không cần alert thành công — badge count tăng lên là feedback đủ
    } catch (e) {
      alert('❌ Lưu thất bại: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [zones, assignments, snapshots, reloadSnapshots])

  const handleRestore = useCallback((snap: SnapshotItem) => {
    if (compareMode) return // ? ch? ?? so s?nh, c?c l?n click ch? d?ng ?? ch?n snapshot
    if (!window.confirm(`Khôi phục map "${snap.label}"?\nDữ liệu hiện tại sẽ bị thay thế.`)) return
    setZones(snap.data.zones as any)
    setAssignments(snap.data.assignments as any)
    setIsOpen(false)
  }, [setZones, setAssignments, compareMode])

  // Giai ?o?n 3D: b?t/t?t ch?n snapshot ?? so s?nh
  const toggleCompareSelect = useCallback((snap: SnapshotItem) => {
    setSelectedForCompare((prev) => {
      const exists = prev.find((s) => s.id === snap.id)
      if (exists) return prev.filter((s) => s.id !== snap.id)
      if (prev.length >= 2) return [prev[1]!, snap] // thay th? b?n c? nh?t
      return [...prev, snap]
    })
  }, [])

  const handleCompare = useCallback(() => {
    if (selectedForCompare.length === 2) {
      setComparingPair([selectedForCompare[0]!, selectedForCompare[1]!])
    }
  }, [selectedForCompare])

  const handleDelete = useCallback(async (e: React.MouseEvent, snapId: string) => {
    e.stopPropagation()
    if (!window.confirm('Xóa snapshot này?')) return
    setSnapshots((prev) => prev.filter((s) => s.id !== snapId))
    void (async () => {
      await deleteSnapshot(snapId, currentProjectId ?? undefined)
      await reloadSnapshots()
    })().catch((error) => {
      console.error('[SnapshotManager] delete error:', error)
    })
  }, [currentProjectId, reloadSnapshots])

  // Logic l?c theo period
  const availablePeriods = useMemo(() => {
    const ps = snapshots.map((s) => s.period).filter(Boolean) as string[]
    return [...new Set(ps)].sort((a, b) => b.localeCompare(a))
  }, [snapshots])

  const filteredSnapshots = useMemo(() =>
    periodFilter === 'all'
      ? snapshots
      : snapshots.filter((s) => s.period === periodFilter),
    [snapshots, periodFilter],
  )

  return (
    <div
      data-snapshot-manager
      style={styles.container}
    >
      {/* N?t l?u */}
      <button
        id="snapshot-save-btn"
        onClick={handleSave}
        disabled={saving}
        style={{
          ...styles.btn,
          opacity: saving ? 0.7 : 1,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
        title="Lưu trạng thái bản đồ hiện tại"
      >
        {saving ? '⏳' : '💾'} Lưu map
      </button>

      {/* Dropdown t?i */}
      <div style={styles.dropdownWrapper}>
        <button
          id="snapshot-load-btn"
          onClick={() => setIsOpen((o) => !o)}
          style={{ ...styles.btn, minWidth: 120 }}
          title="Mở bản đồ đã lưu"
        >
          📂 Mở map
          <span style={styles.badge}>{snapshots.length}</span>
        </button>

        {isOpen && (
          <div style={styles.dropdown}>
            <div style={styles.dropdownHeader}>
              <span>Bản đồ đã lưu</span>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
                {/* Giai ?o?n 3D: n?t b?t/t?t ch? ?? so s?nh */}
                <button
                  onClick={() => {
                    setCompareMode((v) => !v)
                    setSelectedForCompare([])
                  }}
                  style={{
                    ...styles.compareToggleBtn,
                    background: compareMode ? 'var(--color-accent)' : 'transparent',
                    color:      compareMode ? '#fff' : 'var(--color-text-3)',
                  }}
                  title="Chế độ so sánh"
                >
                  📊 So sánh
                </button>
                {/* B? l?c period */}
                {availablePeriods.length > 0 && (
                  <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value)}
                    style={styles.periodSelect}
                  >
                    <option value="all">Tất cả</option>
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>
                        T{p.split('-')[1]}/{p.split('-')[0]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Banner so s?nh */}
            {compareMode && (
              <div style={styles.compareBanner}>
                {selectedForCompare.length < 2
                  ? `Chọn ${2 - selectedForCompare.length} snapshot nữa để so sánh`
                  : (
                    <button onClick={handleCompare} style={styles.compareBtn}>
                      📊 So sánh {selectedForCompare[0]!.label} vs {selectedForCompare[1]!.label}
                    </button>
                  )
                }
              </div>
            )}

            {filteredSnapshots.length === 0 ? (
              <div style={styles.empty}>
                <span style={{ fontSize: 20 }}>🗺️</span>
                <span>Chưa có bản đồ nào</span>
              </div>
            ) : (
              <div style={styles.itemList}>
                {filteredSnapshots.map((snap) => {
                  const isSelectedForCompare = selectedForCompare.some((s) => s.id === snap.id)
                  return (
                    <div
                      key={snap.id}
                      style={{
                        ...styles.item,
                        background: isSelectedForCompare
                          ? 'var(--color-accent-light)'
                          : hoveredId === snap.id
                            ? 'var(--color-surface-2)'
                            : 'transparent',
                        outline: isSelectedForCompare ? '2px solid var(--color-accent)' : 'none',
                        borderRadius: 8,
                      }}
                      onMouseEnter={() => setHoveredId(snap.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Checkbox so s?nh */}
                      {compareMode && (
                        <input
                          type="checkbox"
                          checked={isSelectedForCompare}
                          onChange={() => toggleCompareSelect(snap)}
                          style={{ marginRight: 8, flexShrink: 0, cursor: 'pointer' }}
                        />
                      )}
                      <button
                        onClick={() => compareMode ? toggleCompareSelect(snap) : handleRestore(snap)}
                        style={styles.itemBtn}
                      >
                        <div style={styles.itemNameRow}>
                          <span style={styles.itemName}>{snap.label}</span>
                          {snap.period && (
                            <span style={styles.periodBadge}>
                              T{snap.period.split('-')[1]}/{snap.period.split('-')[0]}
                            </span>
                          )}
                        </div>
                        <div style={styles.itemMeta}>
                          {snap.data.zones.length} vùng
                          {' · '}
                          {new Date(snap.created_at).toLocaleDateString('vi-VN', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </button>
                      {!compareMode && (
                        <button
                          onClick={(e) => handleDelete(e, snap.id)}
                          style={styles.deleteBtn}
                          title="Xóa snapshot"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Giai ?o?n 3D: h?p tho?i SnapshotCompare */}
      {comparingPair && (
        <SnapshotCompare
          snapshotA={comparingPair[0]}
          snapshotB={comparingPair[1]}
          onClose={() => {
            setComparingPair(null)
            setCompareMode(false)
            setSelectedForCompare([])
          }}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position:  'absolute',
    top:       60,
    right:     10,
    zIndex:    1000,
    display:   'flex',
    gap:       8,
    alignItems: 'flex-start',
  },
  btn: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '7px 13px',
    borderRadius: 8,
    border:       '1.5px solid var(--color-border)',
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
    boxShadow:    '0 2px 8px rgba(0,0,0,0.12)',
    transition:   'all 120ms ease',
    backdropFilter: 'blur(8px)',
    whiteSpace:   'nowrap',
  },
  badge: {
    display:      'inline-flex',
    alignItems:   'center',
    justifyContent: 'center',
    minWidth:     18,
    height:       18,
    padding:      '0 5px',
    borderRadius: 99,
    background:   'var(--color-accent)',
    color:        '#fff',
    fontSize:     10,
    fontWeight:   700,
  },
  dropdownWrapper: { position: 'relative' },
  dropdown: {
    position:     'absolute',
    top:          'calc(100% + 6px)',
    right:        0,
    background:   'var(--color-surface)',
    border:       '1.5px solid var(--color-border)',
    borderRadius: 12,
    boxShadow:    '0 10px 32px rgba(0,0,0,0.18)',
    width:        300,
    overflow:     'hidden',
    backdropFilter: 'blur(12px)',
  },
  dropdownHeader: {
    display:       'flex',
    alignItems:    'center',
    padding:       '8px 14px',
    fontSize:      11,
    fontWeight:    700,
    color:         'var(--color-text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom:  '1px solid var(--color-border)',
    gap:           6,
  },
  itemList: {
    maxHeight:  300,
    overflowY:  'auto',
    padding:    6,
  },
  empty: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           8,
    padding:       '24px 16px',
    color:         'var(--color-text-3)',
    fontSize:      13,
  },
  item: {
    display:      'flex',
    alignItems:   'center',
    borderRadius: 8,
    overflow:     'hidden',
    transition:   'background 100ms',
  },
  itemBtn: {
    flex:       1,
    textAlign:  'left',
    padding:    '9px 12px',
    border:     'none',
    background: 'transparent',
    cursor:     'pointer',
  },
  itemName: {
    fontSize:   13,
    fontWeight: 600,
    color:      'var(--color-text)',
  },
  itemMeta: {
    fontSize:  11,
    color:     'var(--color-text-3)',
    marginTop: 2,
  },
  deleteBtn: {
    padding:      '4px 8px',
    marginRight:  6,
    border:       'none',
    borderRadius: 6,
    background:   'transparent',
    color:        'var(--color-text-3)',
    cursor:       'pointer',
    fontSize:     16,
    lineHeight:   1,
    flexShrink:   0,
  },
  periodSelect: {
    fontSize:     11,
    padding:      '2px 5px',
    borderRadius: 5,
    border:       '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
    cursor:       'pointer',
    marginLeft:   'auto',
  },
  itemNameRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
  },
  periodBadge: {
    display:      'inline-flex',
    alignItems:   'center',
    padding:      '1px 6px',
    borderRadius: 99,
    background:   'var(--color-accent)',
    color:        '#fff',
    fontSize:     10,
    fontWeight:   700,
    flexShrink:   0,
  },
  // Ki?u cho so s?nh giai ?o?n 3D
  compareToggleBtn: {
    fontSize:     11,
    padding:      '3px 8px',
    borderRadius: 6,
    border:       '1px solid var(--color-border)',
    cursor:       'pointer',
    fontWeight:   600,
    whiteSpace:   'nowrap',
    transition:   'all 100ms',
  },
  compareBanner: {
    padding:      '8px 14px',
    background:   'var(--color-accent-light)',
    fontSize:     12,
    color:        'var(--color-accent)',
    fontWeight:   600,
    borderBottom: '1px solid var(--color-border)',
  },
  compareBtn: {
    width:        '100%',
    padding:      '6px 12px',
    borderRadius: 6,
    border:       'none',
    background:   'var(--color-accent)',
    color:        '#fff',
    fontSize:     12,
    fontWeight:   700,
    cursor:       'pointer',
  },
}
