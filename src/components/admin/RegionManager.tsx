/**
 * RegionManager — Dynamic region management with province search & fly-to
 *
 * Features:
 * - Province search bar: autocomplete 34 provinces, click → fly map
 * - "Tạo khu vực tại đây": save current map center as new region
 * - Pill bar: select/deselect region to filter map + zones
 * - Delete region (with guard if zones still attached)
 * - Coordinator assignment for selected region
 * - Empty state guide for new projects
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore.js'
import { VIETNAM_PROVINCES } from '../../data/provinces.js'
import type { Region } from '../../data/regions.js'

interface RegionManagerProps {
  /** Current map center (lat/lng) exposed from TerritoryMap via parent */
  mapCenter?: { lat: number; lng: number }
  mapZoom?:   number
  /** Callback to fly the map to given coordinates */
  onFlyTo?:   (lat: number, lng: number, zoom: number) => void
}

export default function RegionManager({ mapCenter, mapZoom, onFlyTo }: RegionManagerProps) {
  const regions          = useDataStore((s) => s.regions)
  const zones            = useDataStore((s) => s.zones)
  const agents           = useDataStore((s) => s.agents)
  const currentRegionId  = useDataStore((s) => s.currentRegionId)
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion)
  const updateRegion     = useDataStore((s) => s.updateRegion)
  const addRegion        = useDataStore((s) => s.addRegion)
  const deleteRegion     = useDataStore((s) => s.deleteRegion)

  const [searchQuery,  setSearchQuery]  = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [newName,      setNewName]      = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Filter provinces by query
  const filteredProvinces = searchQuery.trim().length > 0
    ? VIETNAM_PROVINCES.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : VIETNAM_PROVINCES

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleProvinceSelect = useCallback((lat: number, lng: number, zoom: number, name: string) => {
    setSearchQuery(name)
    setShowDropdown(false)
    setNewName(name)  // pre-fill create form with province name
    onFlyTo?.(lat, lng, zoom)
  }, [onFlyTo])

  const handleCreateRegion = useCallback(async () => {
    if (!newName.trim()) return
    const center = mapCenter ?? { lat: 16.047, lng: 108.206 }
    const zoom   = mapZoom   ?? 12
    setCreating(false)
    setNewName('')
    setSearchQuery('')
    const region = await addRegion(newName.trim(), center, zoom)
    setCurrentRegion(region.id)
  }, [newName, mapCenter, mapZoom, addRegion, setCurrentRegion])

  const handleDeleteRegion = useCallback(async (regionId: string) => {
    const zoneCount = zones.filter((z) => (z as any).regionId === regionId).length
    if (zoneCount > 0) {
      alert(`Khu vực này còn ${zoneCount} vùng. Hãy chuyển tất cả vùng sang khu vực khác trước khi xóa.`)
      setConfirmDelete(null)
      return
    }
    await deleteRegion(regionId)
    setConfirmDelete(null)
  }, [zones, deleteRegion])

  const activeRegion = regions.find((r) => r.id === currentRegionId)

  return (
    <div style={styles.wrapper}>

      {/* ── Province search ────────────────────────────────────────────── */}
      <div ref={searchRef} style={styles.searchWrap}>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Tìm tỉnh thành..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
          />
          {searchQuery && (
            <button
              style={styles.clearSearchBtn}
              onClick={() => { setSearchQuery(''); setShowDropdown(false) }}
            >×</button>
          )}
        </div>

        {showDropdown && (
          <div style={styles.dropdown}>
            {filteredProvinces.length === 0 ? (
              <div style={styles.dropdownEmpty}>Không tìm thấy tỉnh thành</div>
            ) : (
              filteredProvinces.map((p) => (
                <button
                  key={p.name}
                  style={styles.dropdownItem}
                  onClick={() => handleProvinceSelect(p.lat, p.lng, p.zoom, p.name)}
                >
                  📍 {p.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Create region ─────────────────────────────────────────────── */}
      {creating ? (
        <div style={styles.createBox}>
          <input
            autoFocus
            style={styles.createInput}
            placeholder="Tên khu vực..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateRegion()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
          />
          <div style={styles.createBtns}>
            <button style={styles.confirmBtn} onClick={handleCreateRegion} disabled={!newName.trim()}>
              ✓ Tạo tại đây
            </button>
            <button style={styles.cancelBtn} onClick={() => { setCreating(false); setNewName('') }}>
              ✕
            </button>
          </div>
          <div style={styles.createHint}>
            📌 Khu vực sẽ được đặt tại vị trí bản đồ đang nhìn
          </div>
        </div>
      ) : (
        <button style={styles.createTrigger} onClick={() => setCreating(true)}>
          + Tạo khu vực mới
        </button>
      )}

      {/* ── Region pills ──────────────────────────────────────────────── */}
      {regions.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🗺️</div>
          <div style={styles.emptyText}>Chưa có khu vực nào</div>
          <div style={styles.emptyHint}>Tìm tỉnh thành → Tạo khu vực</div>
        </div>
      ) : (
        <div style={styles.pillBar}>
          {regions.map((region) => {
            const isActive    = currentRegionId === region.id
            const zoneCount   = zones.filter((z) => (z as any).regionId === region.id).length
            const isConfirm   = confirmDelete === region.id

            return (
              <div key={region.id} style={styles.pillRow}>
                <button
                  style={{
                    ...styles.pill,
                    ...(isActive ? styles.pillActive : styles.pillInactive),
                  }}
                  onClick={() => setCurrentRegion(isActive ? null : region.id)}
                  title={`${region.name} · ${zoneCount} vùng`}
                >
                  <span style={styles.pillName}>{region.name}</span>
                  <span style={{
                    ...styles.pillBadge,
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--color-surface)',
                  }}>
                    {zoneCount}
                  </span>
                </button>

                {/* Delete button */}
                {isConfirm ? (
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmText}>Xóa?</span>
                    <button style={styles.confirmYes} onClick={() => handleDeleteRegion(region.id)}>✓</button>
                    <button style={styles.confirmNo}  onClick={() => setConfirmDelete(null)}>✕</button>
                  </div>
                ) : (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => setConfirmDelete(region.id)}
                    title="Xóa khu vực"
                  >🗑</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Coordinator for selected region ───────────────────────────── */}
      {activeRegion && (
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>Điều phối:</span>
          <select
            value={activeRegion.coordinatorId ?? ''}
            onChange={(e) => updateRegion({ ...activeRegion, coordinatorId: e.target.value || undefined })}
            style={styles.select}
          >
            <option value="">— Chưa gán —</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  // Search
  searchWrap: {
    position: 'relative',
  },
  searchBox: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '5px 10px',
    borderRadius: 8,
    border:       '1.5px solid var(--color-border)',
    background:   'var(--color-surface-2)',
  },
  searchIcon: {
    fontSize:   13,
    flexShrink: 0,
    opacity:    0.7,
  },
  searchInput: {
    flex:       1,
    border:     'none',
    background: 'transparent',
    outline:    'none',
    fontSize:   13,
    color:      'var(--color-text)',
    minWidth:   0,
  },
  clearSearchBtn: {
    border:      'none',
    background:  'transparent',
    cursor:      'pointer',
    fontSize:    16,
    color:       'var(--color-text-muted)',
    padding:     0,
    lineHeight:  1,
    flexShrink:  0,
  },
  dropdown: {
    position:     'absolute' as const,
    top:          '100%',
    left:         0,
    right:        0,
    zIndex:       200,
    background:   'var(--color-surface)',
    border:       '1.5px solid var(--color-border)',
    borderRadius: 8,
    boxShadow:    '0 4px 16px rgba(0,0,0,0.15)',
    maxHeight:    220,
    overflowY:    'auto' as const,
    marginTop:    4,
  },
  dropdownItem: {
    display:    'block',
    width:      '100%',
    textAlign:  'left' as const,
    padding:    '7px 12px',
    border:     'none',
    background: 'transparent',
    color:      'var(--color-text)',
    fontSize:   13,
    cursor:     'pointer',
  },
  dropdownEmpty: {
    padding:  '10px 12px',
    fontSize: 12,
    color:    'var(--color-text-muted)',
  },
  // Create form
  createBox: {
    display:       'flex',
    flexDirection: 'column',
    gap:           5,
    padding:       '8px 10px',
    borderRadius:  8,
    border:        '1.5px solid var(--color-accent)',
    background:    'var(--color-surface-2)',
  },
  createInput: {
    border:       '1px solid var(--color-border)',
    borderRadius: 6,
    padding:      '5px 8px',
    fontSize:     13,
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
    outline:      'none',
  },
  createBtns: {
    display: 'flex',
    gap:     6,
  },
  confirmBtn: {
    flex:         1,
    padding:      '5px 0',
    borderRadius: 6,
    border:       'none',
    background:   'var(--color-accent)',
    color:        '#fff',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
  },
  cancelBtn: {
    padding:      '5px 10px',
    borderRadius: 6,
    border:       '1px solid var(--color-border)',
    background:   'transparent',
    color:        'var(--color-text-muted)',
    fontSize:     12,
    cursor:       'pointer',
  },
  createHint: {
    fontSize: 11,
    color:    'var(--color-text-muted)',
  },
  createTrigger: {
    padding:      '5px 0',
    borderRadius: 7,
    border:       '1.5px dashed var(--color-border)',
    background:   'transparent',
    color:        'var(--color-accent)',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
    width:        '100%',
    transition:   'all 150ms',
  },
  // Empty state
  emptyState: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    padding:        '14px 8px',
    gap:            4,
    borderRadius:   8,
    border:         '1.5px dashed var(--color-border)',
    background:     'var(--color-surface-2)',
  },
  emptyIcon: { fontSize: 22 },
  emptyText: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' },
  emptyHint: { fontSize: 11, color: 'var(--color-text-3)', textAlign: 'center' as const },
  // Pills
  pillBar: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
  },
  pillRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         5,
  },
  pill: {
    flex:         1,
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'space-between',
    gap:          5,
    padding:      '5px 10px',
    borderRadius: 20,
    border:       '1.5px solid',
    cursor:       'pointer',
    fontSize:     12,
    fontWeight:   600,
    transition:   'all 150ms',
    minWidth:     0,
  },
  pillActive: {
    background:  'var(--color-accent)',
    borderColor: 'var(--color-accent)',
    color:       '#fff',
    boxShadow:   '0 2px 8px rgba(99,102,241,0.30)',
  },
  pillInactive: {
    background:  'var(--color-surface-2)',
    borderColor: 'var(--color-border)',
    color:       'var(--color-text)',
  },
  pillName: {
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
    flex:         1,
    textAlign:    'left' as const,
  },
  pillBadge: {
    fontSize:     10,
    fontWeight:   700,
    padding:      '1px 5px',
    borderRadius: 10,
    flexShrink:   0,
  },
  deleteBtn: {
    padding:      '3px 6px',
    borderRadius: 6,
    border:       'none',
    background:   'transparent',
    cursor:       'pointer',
    fontSize:     12,
    opacity:      0.5,
    flexShrink:   0,
  },
  confirmRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         3,
    flexShrink:  0,
  },
  confirmText: {
    fontSize: 10,
    color:    'var(--color-text-muted)',
  },
  confirmYes: {
    padding:      '2px 5px',
    borderRadius: 4,
    border:       'none',
    background:   '#ef4444',
    color:        '#fff',
    fontSize:     10,
    cursor:       'pointer',
  },
  confirmNo: {
    padding:      '2px 5px',
    borderRadius: 4,
    border:       '1px solid var(--color-border)',
    background:   'transparent',
    color:        'var(--color-text-muted)',
    fontSize:     10,
    cursor:       'pointer',
  },
  // Coordinator
  detailRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    padding:     '6px 10px',
    borderRadius: 8,
    background:  'var(--color-surface-2)',
    border:      '1px solid var(--color-border)',
  },
  detailLabel: {
    fontSize:   11,
    fontWeight: 600,
    color:      'var(--color-text-3)',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  select: {
    flex:         1,
    fontSize:     12,
    padding:      '3px 6px',
    borderRadius: 6,
    border:       '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
    cursor:       'pointer',
    outline:      'none',
    minWidth:     0,
  },
}
