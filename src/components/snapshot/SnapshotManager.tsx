/**
 * SnapshotManager — Khối lưu / tải bản đồ
 *
 * Đặt tuyệt đối ở góc trên bên phải khu vực bản đồ.
 * Lưu: hỏi tên -> saveSnapshot toàn bộ zones + assignments
 * Tải: danh sách xổ xuống -> khôi phục zones + assignments vào store toàn cục
 *
 * Hoạt động cả ở chế độ online (Supabase) và offline (localStorage).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  const [activeSnapshot, setActiveSnapshot] = useState<SnapshotItem | null>(null)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [hydrating, setHydrating] = useState(true)
  const autoOpenedProjectIdRef = useRef<string | null>(null)


  const [compareMode, setCompareMode]             = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<SnapshotItem[]>([])
  const [comparingPair, setComparingPair]           = useState<[SnapshotItem, SnapshotItem] | null>(null)

  const zones          = useDataStore((s) => s.zones)
  const assignments    = useDataStore((s) => s.assignments)
  const currentProjectId = useDataStore((s) => s.currentProjectId)
  const setZones       = useDataStore((s) => s.setZones)
  const setAssignments = useDataStore((s) => s.setAssignments)

  const restoreSnapshot = useCallback((snap: SnapshotItem) => {
    setZones(snap.data.zones as any)
    setAssignments(snap.data.assignments as any)
    setActiveSnapshot(snap)
  }, [setZones, setAssignments])

  const refreshSnapshots = useCallback(async () => {
    const data = await loadSnapshots(currentProjectId ?? undefined)
    setSnapshots(data as SnapshotItem[])
    setLoadedProjectId(currentProjectId ?? null)
  }, [currentProjectId])


  useEffect(() => {
    setHydrating(true)
    void refreshSnapshots().catch((error) => {
      console.error('[SnapshotManager] load error:', error)
      setHydrating(false)
    })
  }, [refreshSnapshots, currentProjectId])

  useEffect(() => {
    if (!currentProjectId || loadedProjectId !== currentProjectId) return
    if (snapshots.length === 0) {
      setActiveSnapshot(null)
      setHydrating(false)
      return
    }

    const latest = snapshots[0]!
    if (autoOpenedProjectIdRef.current === currentProjectId) return
    autoOpenedProjectIdRef.current = currentProjectId
    restoreSnapshot(latest)
    setHydrating(false)
  }, [currentProjectId, loadedProjectId, restoreSnapshot, snapshots])



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
          void refreshSnapshots().catch((error) => {
            console.error('[SnapshotManager] realtime refresh error:', error)
          })
        },
      )
      .subscribe()

    return () => {
      void supabase!.removeChannel(channel)
    }
  }, [currentProjectId, refreshSnapshots])


  useEffect(() => {
    if (!currentProjectId) return

    const timer = window.setInterval(() => {
      void refreshSnapshots().catch((error) => {
        console.error('[SnapshotManager] polling refresh error:', error)
      })
    }, 15_000)

    return () => window.clearInterval(timer)
  }, [currentProjectId, refreshSnapshots])

  // Đồng bộ ngay khi snapshot được lưu/xóa ở component khác trong cùng project
  useEffect(() => {
    const handleSnapshotUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail
      if (detail?.projectId && detail.projectId !== currentProjectId) return
      void refreshSnapshots().catch((error) => {
        console.error('[SnapshotManager] event refresh error:', error)
      })
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith('terrimap_snapshots')) return
      if (currentProjectId && event.key !== `terrimap_snapshots_${currentProjectId}` && event.key !== 'terrimap_snapshots') return
      void refreshSnapshots().catch((error) => {
        console.error('[SnapshotManager] storage refresh error:', error)
      })
    }

    window.addEventListener('terrimap:snapshots-updated', handleSnapshotUpdate as EventListener)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('terrimap:snapshots-updated', handleSnapshotUpdate as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [currentProjectId, refreshSnapshots])


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
      // Không cần alert thành công — badge count tăng lên là feedback đủ
    } catch (e) {
      alert('❌ Lưu thất bại: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [zones, assignments, snapshots, refreshSnapshots])

  const handleRestore = useCallback((snap: SnapshotItem) => {
    if (compareMode) return
    if (!window.confirm(`Khôi phục map "${snap.label}"?\nDữ liệu hiện tại sẽ bị thay thế.`)) return
    restoreSnapshot(snap)
    setIsOpen(false)
  }, [compareMode, restoreSnapshot])


  const toggleCompareSelect = useCallback((snap: SnapshotItem) => {
    setSelectedForCompare((prev) => {
      const exists = prev.find((s) => s.id === snap.id)
      if (exists) return prev.filter((s) => s.id !== snap.id)
      if (prev.length >= 2) return [prev[1]!, snap]
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
    })().catch((error) => {
      console.error('[SnapshotManager] delete error:', error)
    })
  }, [currentProjectId, refreshSnapshots])


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
      {hydrating && (
        <div style={styles.hydrationOverlay} aria-live="polite" aria-busy="true">
          <div style={styles.hydrationCard}>
            <div style={styles.hydrationSpinner} />
            <div style={styles.hydrationTextBlock}>
              <strong style={styles.hydrationTitle}>Đang mở</strong>
              <span style={styles.hydrationSubtitle}>
                {snapshots[0]?.label
                  ? `Chuẩn bị tải: ${snapshots[0].label}`
                  : 'Đang đồng bộ dữ liệu bản lưu cho dự án hiện tại...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeSnapshot && (
        <div style={styles.activeBanner}>
          <span style={styles.activeBannerLabel}>Đang mở:</span>
          <strong style={styles.activeBannerValue}>{activeSnapshot.label}</strong>
          {activeSnapshot.period && (
            <span style={styles.activeBannerPeriod}>
              T{activeSnapshot.period.split('-')[1]}/{activeSnapshot.period.split('-')[0]}
            </span>
          )}
        </div>
      )}

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
    flexDirection: 'column',
  },
  hydrationOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 5000,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(248, 250, 252, 0.82)',
    backdropFilter: 'blur(3px)',
  },
  hydrationCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 320,
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid rgba(37,99,235,0.18)',
    background: 'var(--color-surface)',
    boxShadow: '0 18px 40px rgba(15,23,42,0.18)',
  },
  hydrationSpinner: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '3px solid color-mix(in srgb, var(--color-border) 65%, white)',
    borderTopColor: 'var(--color-accent)',
    animation: 'spin 0.8s linear infinite',
    flex: '0 0 auto',
  },
  hydrationTextBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  hydrationTitle: {
    fontSize: 14,
    color: 'var(--color-text)',
    fontWeight: 900,
  },
  hydrationSubtitle: {
    fontSize: 12,
    color: 'var(--color-text-2)',
  },
  activeBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 11px',
    borderRadius: 10,
    border: '1px solid rgba(37,99,235,0.20)',
    background: 'color-mix(in srgb, var(--color-surface) 92%, white)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    fontSize: 12,
    color: 'var(--color-text)',
    maxWidth: 320,
  },
  activeBannerLabel: {
    color: 'var(--color-text-3)',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  activeBannerValue: {
    fontWeight: 900,
    color: '#1d4ed8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activeBannerPeriod: {
    marginLeft: 'auto',
    color: 'var(--color-text-3)',
    fontWeight: 700,
    whiteSpace: 'nowrap',
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
