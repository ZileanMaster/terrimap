import { create } from 'zustand'
import i18n from '../i18n/index.js'

export type Role   = 'admin' | 'coordinator' | 'sales'
export type Theme  = 'light' | 'dark' | 'system'
export type Locale = 'vi' | 'en'

const LOCALE_KEY = 'terrimap_locale'

function getInitialLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY)
    return v === 'en' || v === 'vi' ? v : 'vi'
  } catch {
    return 'vi'
  }
}

function applyLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // ignore storage errors
  }
  // Keep i18next in sync so UI updates immediately.
  try {
    i18n.changeLanguage(locale)
  } catch {
    // ignore i18n errors
  }
}

interface UIStore {
  role:                Role
  selectedZoneId:      string | null
  isAlgorithmRunning:  boolean
  theme:               Theme
  locale:              Locale
  highlightedSalesId:  string | null      // L4b-1: click agent card → highlight district
  isMapTransitioning:  boolean            // L4b-1: flash effect after algorithm run
  selectedDistrictId:  number | null      // Map legend: focus a cluster/district
  showPolygons:        boolean            // Map layer toggle
  // Actions
  setRole:                (role: Role) => void
  selectZone:             (id: string | null) => void
  setAlgorithmRunning:    (v: boolean) => void
  setTheme:               (theme: Theme) => void
  toggleLocale:           () => void
  setHighlightedSalesId:  (id: string | null) => void
  setMapTransitioning:    (v: boolean) => void
  setSelectedDistrictId:  (id: number | null) => void
  togglePolygons:         () => void
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
  locale:             getInitialLocale(),
  highlightedSalesId: null,
  isMapTransitioning: false,
  selectedDistrictId: null,
  showPolygons:       true,

  setRole: (role) =>
    set({
      role,
      selectedZoneId: null,
      highlightedSalesId: null,
      selectedDistrictId: null,
    }),

  selectZone: (id) => set({ selectedZoneId: id }),

  setAlgorithmRunning: (v) => set({ isAlgorithmRunning: v }),

  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)
  },

  toggleLocale: () =>
    set((s) => {
      const next: Locale = s.locale === 'vi' ? 'en' : 'vi'
      applyLocale(next)
      return { locale: next }
    }),

  // Toggle: click same agent → deselect; click different → select new
  // Also clear selectedZoneId to avoid conflicting highlights
  setHighlightedSalesId: (id) =>
    set((s) => ({
      highlightedSalesId: s.highlightedSalesId === id ? null : id,
      selectedZoneId: null,
      selectedDistrictId: null,
    })),

  setMapTransitioning: (v) => set({ isMapTransitioning: v }),

  // Toggle: click same district -> clear focus
  setSelectedDistrictId: (id) =>
    set((s) => ({
      selectedDistrictId: s.selectedDistrictId === id ? null : id,
      highlightedSalesId: null,
      selectedZoneId: null,
    })),

  togglePolygons: () => set((s) => ({ showPolygons: !s.showPolygons })),
}))
