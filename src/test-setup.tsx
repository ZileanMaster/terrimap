import React from 'react'
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup sau mỗi test
afterEach(() => {
  cleanup()
})

// Mock react-leaflet — không chạy được trong jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-container' }, children),

  TileLayer: () => null,
  Polyline: () => null,
  CircleMarker: () => null,

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
        // Forward data-* attributes so tests can assert them
        ...Object.fromEntries(
          Object.entries(rest).filter(([k]) => k.startsWith('data-'))
        ),
      },
      children,
    ),

  Tooltip: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'tooltip' }, children),

  useMap: () => ({ setView: vi.fn(), invalidateSize: vi.fn() }),
  useMapEvents: () => ({}),
}))

// Mock leaflet (icon fix tạo lỗi trong jsdom)
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

// Mock window.matchMedia (jsdom không implement)
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

// Mock ResizeObserver (jsdom không implement)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
