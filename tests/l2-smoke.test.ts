import { describe, it, expect } from 'vitest'
import { ActivityService } from '../services/ActivityService.js'
import { MapService } from '../services/MapService.js'
import type { Zone } from '../types/domain.js'
import type { Assignment } from '../lib/partition.js'

// Zones tối thiểu để test
const zone1: Zone = {
  id: 'z1',
  name: 'Zone 1',
  status: 'unassigned',
  centroid: { lat: 21.0, lng: 105.8 },
  polygon: { type: 'Polygon' as const, coordinates: [
    [[105.7, 20.9], [105.9, 20.9], [105.9, 21.1],
     [105.7, 21.1], [105.7, 20.9]]
  ]},
  activities: [
    { id: 'a1', type: 'CUSTOMER' as const, value: 100 },
    { id: 'a2', type: 'ORDER' as const, value: 50 },
  ]
}

const zone2: Zone = {
  id: 'z2',
  name: 'Zone 2',
  status: 'unassigned',
  centroid: { lat: 21.1, lng: 105.9 },
  polygon: { type: 'Polygon' as const, coordinates: [
    [[105.8, 21.0], [106.0, 21.0], [106.0, 21.2],
     [105.8, 21.2], [105.8, 21.0]]
  ]},
  activities: [
    { id: 'a3', type: 'CUSTOMER' as const, value: 80 },
  ]
}

const assignments: Assignment[] = [
  { zoneId: 'z1', districtId: 0 },
  { zoneId: 'z2', districtId: 1 },
]

describe('ActivityService smoke tests', () => {

  it('[SMOKE-A1] updateZoneActivity không throw với input hợp lệ', () => {
    const svc = new ActivityService()
    const result = svc.updateZoneActivity('z1', [zone1, zone2],
      { customers: 150 })
    expect(result).toHaveLength(2)
    const updated = result.find(z => z.id === 'z1')
    expect(updated).toBeDefined()
  })

  it('[SMOKE-A2] updateZoneActivity throw ZONE_NOT_FOUND', () => {
    const svc = new ActivityService()
    expect(() => svc.updateZoneActivity('nonexistent', [zone1], {}))
      .toThrow()
  })

  it('[SMOKE-A3] getDistrictSummary không throw', () => {
    const svc = new ActivityService()
    const summary = svc.getDistrictSummary(0, [zone1, zone2], assignments)
    expect(summary.districtId).toBe(0)
    expect(summary.totalCustomers).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(summary.diameter)).toBe(true)
  })

  it('[SMOKE-A4] importActivitiesFromCSV parse đúng', () => {
    const svc = new ActivityService()
    const csv = 'zone_id,customers,orders\nz1,100,50\nz2,80,40'
    const records = svc.importActivitiesFromCSV(csv)
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ zoneId: 'z1', customers: 100, orders: 50 })
  })

  it('[SMOKE-A5] importActivitiesFromCSV skip invalid rows', () => {
    const svc = new ActivityService()
    const csv = 'zone_id,customers,orders\nz1,100,50\n,bad,data\nz2,80,40'
    const records = svc.importActivitiesFromCSV(csv)
    expect(records).toHaveLength(2)  // row 2 bị skip
  })
})

describe('MapService smoke tests', () => {

  it('[SMOKE-M1] importGeoJSON parse FeatureCollection hợp lệ', () => {
    const svc = new MapService()
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { id: 'z1', customers: 100 },
        geometry: {
          type: 'Polygon',
          coordinates: [[[105.7,20.9],[105.9,20.9],[105.9,21.1],
                         [105.7,21.1],[105.7,20.9]]]
        }
      }]
    }
    const zones = svc.importGeoJSON(geojson)
    expect(zones).toHaveLength(1)
    expect(zones[0]!.id).toBe('z1')
    expect(zones[0]!.centroid).toBeDefined()
  })

  it('[SMOKE-M2] importGeoJSON throw khi không phải FeatureCollection', () => {
    const svc = new MapService()
    expect(() => svc.importGeoJSON({ type: 'Feature' })).toThrow()
  })

  it('[SMOKE-M3] exportGeoJSON trả FeatureCollection hợp lệ', () => {
    const svc = new MapService()
    const result = svc.exportGeoJSON([zone1, zone2], assignments)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(2)
    expect(result.features[0]!.properties!['districtId']).toBe(0)
  })

  it('[SMOKE-M4] computeMatrices không throw với 2+ zones', () => {
    const svc = new MapService()
    const matrices = svc.computeMatrices([zone1, zone2])
    expect(matrices.adj).toBeDefined()
    expect(matrices.dist).toBeDefined()
  })
})
