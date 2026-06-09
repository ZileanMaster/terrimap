import { create } from 'zustand'

export type Role   = 'admin' | 'coordinator' | 'sales'
export type Theme  = 'light' | 'dark' | 'system'

const THEME_KEY  = 'terrimap_theme'

function getInitialTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {

  }
}

interface UIStore {
  role:                Role
  selectedZoneId:      string | null
  isAlgorithmRunning:  boolean
  theme:               Theme
  highlightedSalesId:  string | null      // L4b-1: bấm thẻ nhân sự → tô sáng cụm
  isMapTransitioning:  boolean
  selectedDistrictId:  number | null
  showPolygons:        boolean
  /** Per-zone visibility toggle (hide selected vùng without hiding all). */
  hiddenZoneIds:       Record<string, true>
  /** Enable Leaflet-Draw toolbar for vùng editing (admin UI). */
  polygonEditEnabled:  boolean

  setRole:                (role: Role) => void
  selectZone:             (id: string | null) => void
  setAlgorithmRunning:    (v: boolean) => void
  setTheme:               (theme: Theme) => void
  setHighlightedSalesId:  (id: string | null) => void
  setMapTransitioning:    (v: boolean) => void
  setSelectedDistrictId:  (id: number | null) => void
  togglePolygons:         () => void
  toggleZoneHidden:       (zoneId: string) => void
  setPolygonEditEnabled:  (v: boolean) => void
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

export const useUIStore = create<UIStore>((set) => ({
  role:               'admin',
  selectedZoneId:     null,
  isAlgorithmRunning: false,
  theme:              (() => {
    const initial = getInitialTheme()
    persistTheme(initial)

    try { applyTheme(initial) } catch { /* ignore */ }
    return initial
  })(),
  highlightedSalesId: null,
  isMapTransitioning: false,
  selectedDistrictId: null,
  showPolygons:       true,
  hiddenZoneIds:      {},
  polygonEditEnabled: false,

  setRole: (role) =>
    set({
      role,
      selectedZoneId: null,
      highlightedSalesId: null,
      selectedDistrictId: null,
      hiddenZoneIds: {},
      polygonEditEnabled: false,
    }),

  selectZone: (id) => set({ selectedZoneId: id }),

  setAlgorithmRunning: (v) => set({ isAlgorithmRunning: v }),

  setTheme: (theme) => {
    set({ theme })
    persistTheme(theme)
    applyTheme(theme)
  },

  // Toggle: click same agent → deselect; click different → select new

  setHighlightedSalesId: (id) =>
    set((s) => ({
      highlightedSalesId: s.highlightedSalesId === id ? null : id,
      selectedZoneId: null,
      selectedDistrictId: null,
    })),

  setMapTransitioning: (v) => set({ isMapTransitioning: v }),


  setSelectedDistrictId: (id) =>
    set((s) => ({
      selectedDistrictId: s.selectedDistrictId === id ? null : id,
      highlightedSalesId: null,
      selectedZoneId: null,
    })),

  togglePolygons: () => set((s) => ({ showPolygons: !s.showPolygons })),

  toggleZoneHidden: (zoneId) =>
    set((s) => {
      const next = { ...s.hiddenZoneIds }
      if (next[zoneId]) delete next[zoneId]
      else next[zoneId] = true
      return { hiddenZoneIds: next }
    }),

  setPolygonEditEnabled: (v) => set({ polygonEditEnabled: v }),
}))
