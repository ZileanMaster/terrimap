/**
 * Validator Fixtures - 5 fixtures cho tests/validator.test.ts
 *
 * Mỗi fixture: { zones: Zone[], assignments: Assignment[] }
 * Zones dùng Activity[] format chuẩn L0.
 *
 * IMPORTANT: Zones are placed on a grid with 0.05° cells so that
 * adjacent zones (horizontally/vertically) share polygon edges.
 * This is required for polygon edge-sharing adjacency detection.
 */

import type { Zone, Activity } from '../../types/domain.js';
import type { Assignment } from '../../lib/partition.js';

//  Zone factory 

let _zoneSeq = 0;

/** Grid cell size in degrees */
const CELL = 0.05;

/** Base coordinates for grid origin */
const BASE_LAT = 21.00;
const BASE_LNG = 105.70;

/**
 * Create a zone on a grid. Zones at adjacent (col, row) positions
 * share polygon edges - required for polygon-based adjacency.
 */
function makeZone(col: number, row: number, customers: number): Zone {
  const id = `z${++_zoneSeq}`;
  const activities: Activity[] = customers > 0
    ? [{ id: `act-${id}`, type: 'CUSTOMER', value: customers }]
    : [];

  const lng0 = BASE_LNG + col * CELL;
  const lat0 = BASE_LAT + row * CELL;
  const lng1 = lng0 + CELL;
  const lat1 = lat0 + CELL;

  return {
    id,
    name: `Zone ${id}`,
    status: 'unassigned',
    centroid: { lat: (lat0 + lat1) / 2, lng: (lng0 + lng1) / 2 },
    polygon: {
      type: 'Polygon',
      coordinates: [[[lng0, lat0], [lng1, lat0], [lng1, lat1], [lng0, lat1], [lng0, lat0]]],
    },
    activities,
  };
}

/**
 * Create a zone at arbitrary lat/lng (isolated, not grid-aligned).
 * Used for disconnected zones that must NOT share edges with the main grid.
 */
function makeIsolatedZone(lat: number, lng: number, customers: number): Zone {
  const id = `z${++_zoneSeq}`;
  const activities: Activity[] = customers > 0
    ? [{ id: `act-${id}`, type: 'CUSTOMER', value: customers }]
    : [];

  return {
    id,
    name: `Zone ${id}`,
    status: 'unassigned',
    centroid: { lat, lng },
    polygon: {
      type: 'Polygon',
      coordinates: [[[lng - 0.02, lat - 0.02], [lng + 0.02, lat - 0.02],
                     [lng + 0.02, lat + 0.02], [lng - 0.02, lat + 0.02],
                     [lng - 0.02, lat - 0.02]]],
    },
    activities,
  };
}

function assign(zones: Zone[], districtMap: number[]): Assignment[] {
  return zones.map((z, i) => ({ zoneId: z.id, districtId: districtMap[i]! }));
}

//  fixture_ok 
// 4 districts × 3 zones, ~100 customers/district
// Grid layout (6 cols × 2 rows):
//   D0: (0,0)(1,0)(2,0)  D1: (3,0)(4,0)(5,0)
//   D2: (0,1)(1,1)(2,1)  D3: (3,1)(4,1)(5,1)

const okZones: Zone[] = [
  // D0 - row 0, cols 0-2
  makeZone(0, 0, 33),
  makeZone(1, 0, 33),
  makeZone(2, 0, 34),
  // D1 - row 0, cols 3-5
  makeZone(3, 0, 33),
  makeZone(4, 0, 33),
  makeZone(5, 0, 34),
  // D2 - row 1, cols 0-2
  makeZone(0, 1, 33),
  makeZone(1, 1, 33),
  makeZone(2, 1, 34),
  // D3 - row 1, cols 3-5
  makeZone(3, 1, 33),
  makeZone(4, 1, 33),
  makeZone(5, 1, 34),
];

export const fixture_ok = {
  zones: okZones,
  assignments: assign(okZones, [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]),
};

//  fixture_imbalanced 
// D0: 3 zones × 200 = 600 (overloaded)
// D1, D2, D3: 3 zones × 10 = 30 (underloaded)

_zoneSeq = 0;

const imbZones: Zone[] = [
  makeZone(0, 0, 200),
  makeZone(1, 0, 200),
  makeZone(2, 0, 200),
  makeZone(3, 0, 10),
  makeZone(4, 0, 10),
  makeZone(5, 0, 10),
  makeZone(0, 1, 10),
  makeZone(1, 1, 10),
  makeZone(2, 1, 10),
  makeZone(3, 1, 10),
  makeZone(4, 1, 10),
  makeZone(5, 1, 10),
];

export const fixture_imbalanced = {
  zones: imbZones,
  assignments: assign(imbZones, [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]),
};

//  fixture_disconnected 
// D1 has 2 disconnected clusters:
//   Cluster A: grid (3,0)(4,0) - adjacent to D0 via shared edge at col 2->3
//   Cluster B: isolated at lat 20.5 - NO shared edges with grid

_zoneSeq = 0;

const discZones: Zone[] = [
  // D0 - grid row 0, cols 0-2 (connected horizontally)
  makeZone(0, 0, 50),
  makeZone(1, 0, 50),
  makeZone(2, 0, 50),
  // D1 cluster A - grid row 0, cols 3-4 (connected, adjacent to D0)
  makeZone(3, 0, 50),
  makeZone(4, 0, 50),
  // D1 cluster B - isolated (disconnected from cluster A)
  makeIsolatedZone(20.50, 105.85, 50),
  makeIsolatedZone(20.50, 105.90, 50),
  // D2 - grid row 1, cols 0-2 (connected horizontally, adjacent to D0 vertically)
  makeZone(0, 1, 50),
  makeZone(1, 1, 50),
  makeZone(2, 1, 50),
  // D3 - grid row 1, cols 3-5 (connected horizontally)
  makeZone(3, 1, 50),
  makeZone(4, 1, 50),
  makeZone(5, 1, 50),
];

export const fixture_disconnected = {
  zones: discZones,
  assignments: assign(discZones, [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3]),
};

//  fixture_large_diameter 
// D2 has zones spread wide: 2 on grid + 1 isolated at lat 20.8 (~44km south)
// D2 connected via grid edges, but isolated zone breaks contiguity

_zoneSeq = 0;

const ldZones: Zone[] = [
  makeZone(0, 0, 50),
  makeZone(1, 0, 50),
  makeZone(2, 0, 50),
  makeZone(3, 0, 50),
  makeZone(4, 0, 50),
  makeZone(5, 0, 50),
  // D2 - vertical: grid (2,1)(2,2) + isolated far south
  makeZone(2, 1, 50),
  makeZone(2, 2, 50),
  makeIsolatedZone(20.80, 105.80, 50),
  // D3 - grid row 1, cols 3-5
  makeZone(3, 1, 50),
  makeZone(4, 1, 50),
  makeZone(5, 1, 50),
];

export const fixture_large_diameter = {
  zones: ldZones,
  assignments: assign(ldZones, [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]),
};

//  fixture_all_bad 
// Violates all 3: imbalanced + disconnected + large diameter

_zoneSeq = 0;

const allBadZones: Zone[] = [
  // D0 - overloaded
  makeZone(0, 0, 200),
  makeZone(1, 0, 200),
  makeZone(2, 0, 200),
  // D1 cluster A - grid cols 3-4
  makeZone(3, 0, 10),
  makeZone(4, 0, 10),
  // D1 cluster B - isolated (disconnected)
  makeIsolatedZone(20.50, 105.85, 10),
  makeIsolatedZone(20.50, 105.90, 10),
  // D2 - large diameter (2 grid + 1 isolated)
  makeZone(5, 0, 10),
  makeZone(5, 1, 10),
  makeIsolatedZone(20.80, 105.85, 10),
  // D3 - underloaded
  makeZone(0, 1, 10),
  makeZone(1, 1, 10),
  makeZone(2, 1, 10),
];

export const fixture_all_bad = {
  zones: allBadZones,
  assignments: assign(allBadZones, [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3]),
};
