import { create } from 'zustand'

export type Role   = 'admin' | 'coordinator' | 'sales'
export type Theme  = 'light' | 'dark' | 'system'
export type Locale = 'vi' | 'en'

interface UIStore {
  role:                Role
  selectedZoneId:      string | null
  isAlgorithmRunning:  boolean
  theme:               Theme
  locale:              Locale
  highlightedSalesId:  string | null      // L4b-1: click agent card → highlight district
  isMapTransitioning:  boolean            // L4b-1: flash effect after algorithm run
  // Actions
  setRole:                (role: Role) => void
  selectZone:             (id: string | null) => void
  setAlgorithmRunning:    (v: boolean) => void
  setTheme:               (theme: Theme) => void
  toggleLocale:           () => void
  setHighlightedSalesId:  (id: string | null) => void
  setMapTransitioning:    (v: boolean) => void
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
  theme:              'system',
  locale:             'vi',
  highlightedSalesId: null,
  isMapTransitioning: false,

  setRole: (role) => set({ role, selectedZoneId: null, highlightedSalesId: null }),

  selectZone: (id) => set({ selectedZoneId: id }),

  setAlgorithmRunning: (v) => set({ isAlgorithmRunning: v }),

  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)
  },

  toggleLocale: () =>
    set((s) => ({ locale: s.locale === 'vi' ? 'en' : 'vi' })),

  // Toggle: click same agent → deselect; click different → select new
  // Also clear selectedZoneId to avoid conflicting highlights
  setHighlightedSalesId: (id) =>
    set((s) => ({
      highlightedSalesId: s.highlightedSalesId === id ? null : id,
      selectedZoneId: null,
    })),

  setMapTransitioning: (v) => set({ isMapTransitioning: v }),
}))
