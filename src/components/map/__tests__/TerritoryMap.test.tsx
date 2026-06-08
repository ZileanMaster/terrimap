/**
 * TerritoryMap.test.tsx — Kiểm thử đơn vị MAP-1 → MAP-5
 *
 * react-leaflet được mock ở test-setup.tsx:
 *   Polygon → <div data-testid="polygon" data-zone-id data-district data-selected onClick>
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TerritoryMap from '../TerritoryMap'
import type { TerritoryMapProps } from '../TerritoryMap'
import type { Zone } from '../../../../types/domain'
import type { Assignment } from '../../../../facades/viewmodels'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'vi', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../../../store/uiStore', () => ({
  useUIStore: vi.fn((selector: (s: object) => unknown) =>
    selector({ selectedZoneId: null }),
  ),
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet-draw/dist/leaflet.draw.css', () => ({}))

// Mock ClusterLayer ?? tr?nh l?i CJS c?a leaflet.markercluster trong vitest
vi.mock('../ClusterLayer', () => ({
  default: () => null,
}))

// ── Dữ liệu mock ───────────────────────────────────────────────────────────────

const ring1: [number, number][] = [
  [105.7, 20.9], [105.9, 20.9], [105.9, 21.1],
  [105.7, 21.1], [105.7, 20.9],
]
const ring2: [number, number][] = [
  [105.8, 21.0], [106.0, 21.0], [106.0, 21.2],
  [105.8, 21.2], [105.8, 21.0],
]

const mockZones: Zone[] = [
  {
    id: 'z1', name: 'Zone 1',
    centroid: { lat: 21.0, lng: 105.8 },
    polygon: { type: 'Polygon', coordinates: [ring1] },
    activities: [],
  } as unknown as Zone,
  {
    id: 'z2', name: 'Zone 2',
    centroid: { lat: 21.1, lng: 105.9 },
    polygon: { type: 'Polygon', coordinates: [ring2] },
    activities: [],
  } as unknown as Zone,
]

const mockAssignments: Assignment[] = [
  { zoneId: 'z1', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'z2', districtId: 1, salesAgentId: 'sa1' },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TerritoryMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('[MAP-1] render đúng số polygons = số zones', () => {
    render(
      <TerritoryMap zones={mockZones} assignments={mockAssignments} />,
    )
    // Mock render m?t <div data-testid="polygon"> cho m?i zone
    expect(screen.getAllByTestId('polygon')).toHaveLength(2)
  })

  it('[MAP-2] 0 zones → không crash, không có polygon', () => {
    render(<TerritoryMap zones={[]} assignments={[]} />)
    expect(screen.queryAllByTestId('polygon')).toHaveLength(0)
  })

  it('[MAP-3] click polygon → onZoneClick("z1")', async () => {
    const onZoneClick = vi.fn()
    const user = userEvent.setup()
    render(
      <TerritoryMap
        zones={mockZones}
        assignments={mockAssignments}
        onZoneClick={onZoneClick}
      />,
    )
    // polygon[0] → zone z1 (render theo thứ tự map)
    const polygons = screen.getAllByTestId('polygon')
    await user.click(polygons[0]!)
    expect(onZoneClick).toHaveBeenCalledWith('z1')
  })

  it('[MAP-4] selectedZoneId="z2" → polygon z2 có data-selected="true"', () => {
    render(
      <TerritoryMap
        zones={mockZones}
        assignments={mockAssignments}
        selectedZoneId="z2"
      />,
    )
    const polygons = screen.getAllByTestId('polygon')
    // z1: index 0, z2: index 1 (theo thứ tự zones array)
    expect(polygons[0]).toHaveAttribute('data-selected', 'false')
    expect(polygons[1]).toHaveAttribute('data-selected', 'true')
  })

  it('[MAP-5] assignments thay đổi → data-district cập nhật đúng', () => {
    const { rerender } = render(
      <TerritoryMap zones={mockZones} assignments={mockAssignments} />,
    )
    expect(screen.getAllByTestId('polygon')[0]).toHaveAttribute('data-district', '0')
    expect(screen.getAllByTestId('polygon')[1]).toHaveAttribute('data-district', '1')

    const newAssignments: Assignment[] = [
      { zoneId: 'z1', districtId: 2, salesAgentId: 'sa0' },
      { zoneId: 'z2', districtId: 3, salesAgentId: 'sa1' },
    ]
    rerender(
      <TerritoryMap zones={mockZones} assignments={newAssignments} />,
    )
    expect(screen.getAllByTestId('polygon')[0]).toHaveAttribute('data-district', '2')
    expect(screen.getAllByTestId('polygon')[1]).toHaveAttribute('data-district', '3')
  })
})
