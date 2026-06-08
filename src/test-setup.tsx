import React from 'react'
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Dọn dẹp sau mỗi test
afterEach(() => {
  cleanup()
})

// Mock react-leaflet ? kh?ng ch?y ???c trong jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-container' }, children),

  TileLayer: () => null,

  Polygon: ({
    eventHandlers,
    children,
    ...rest
  }: {
    eventHandlers?: { click?: () => void }
    children?: React.ReactNode
    [key: string]: unknown
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'polygon',
        onClick: eventHandlers?.click,
        // Chuy?n ti?p c?c thu?c t?nh data-* ?? test c? th? ki?m tra
        ...Object.fromEntries(
          Object.entries(rest).filter(([k]) => k.startsWith('data-'))
        ),
      },
      children,
    ),

  Tooltip: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'tooltip' }, children),

  useMap: () => ({ setView: vi.fn(), invalidateSize: vi.fn() }),
}))

// Mock leaflet (s?a icon g?y l?i trong jsdom)
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: { _getIconUrl: undefined },
        mergeOptions: vi.fn(),
      },
    },
  },
  Icon: {
    Default: {
      prototype: { _getIconUrl: undefined },
      mergeOptions: vi.fn(),
    },
  },
}))

// Mock window.matchMedia (jsdom kh?ng h? tr?)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver (jsdom kh?ng h? tr?)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
