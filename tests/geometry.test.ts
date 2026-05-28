/**
 * Test Suite cho L1 — lib/geometry.ts
 *
 * Cấu trúc mỗi describe block:
 *  - NHÓM 1: Happy Path
 *  - NHÓM 2: Invariant/Contract Violations
 *  - NHÓM 3: Fuzz Tests (fast-check)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  haversineKm,
  haversineDistance,
  polygonCentroid,
  zoneDiameter,
  buildAdjacencyMatrix,
  buildDistanceMatrix,
  meanCoordinate,
  polygonSelfIntersects,
  polygonsOverlap,
  findPolygonTopologyViolations,
  assertNoPolygonTopologyViolations,
  GeometryError,
} from '../lib/geometry.js';
import type { Zone, Coordinate } from '../types/domain.js';

// ==========================================
// FIXTURES
// ==========================================

const hcmCoord: Coordinate = { lat: 10.762, lng: 106.660 };
const hanoiCoord: Coordinate = { lat: 21.028, lng: 105.834 };
const originCoord: Coordinate = { lat: 0, lng: 0 };

const closedRing: [number, number][] = [
  [106.6, 10.7], [106.7, 10.7], [106.7, 10.8], [106.6, 10.7],
];

function makeZone(id: string, centroid: Coordinate): Zone {
  return {
    id,
    name: id,
    polygon: { type: 'Polygon', coordinates: [closedRing] },
    centroid,
    activities: [],
    status: 'unassigned',
  };
}

const zoneHCM = makeZone('z-hcm', hcmCoord);
const zoneHanoi = makeZone('z-hanoi', hanoiCoord);
const zoneSame = makeZone('z-same', hcmCoord); // same as zoneHCM

// ==========================================
// FAST-CHECK ARBITRARIES
// ==========================================

const coordArb: fc.Arbitrary<Coordinate> = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
});

// zonesArb tạo mảng zones với unique IDs theo index
const zonesArb = (minLen = 0): fc.Arbitrary<Zone[]> =>
  fc
    .array(coordArb, { minLength: minLen, maxLength: 20 })
    .map((coords) => coords.map((c, i) => makeZone(`z-${i}`, c)));

// ==========================================
// ==========================================
// haversineKm
// ==========================================
// ==========================================

describe('haversineKm', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Khoảng cách HCM→Hà Nội xấp xỉ 1140–1170 km', () => {
    const d = haversineKm(hcmCoord, hanoiCoord);
    expect(d).toBeGreaterThan(1140);
    expect(d).toBeLessThan(1170);
  });

  it('[HP-2] Cùng tọa độ → 0 (không phải -0)', () => {
    const d = haversineKm(hcmCoord, hcmCoord);
    expect(d).toBe(0);
    expect(Object.is(d, -0)).toBe(false);
  });

  it('[HP-3] Đối xứng: haversine(A,B) === haversine(B,A)', () => {
    const ab = haversineKm(hcmCoord, hanoiCoord);
    const ba = haversineKm(hanoiCoord, hcmCoord);
    expect(ab).toBe(ba);
  });

  it('[HP-4] Tọa độ origin (0,0) tới chính nó → 0', () => {
    expect(haversineKm(originCoord, originCoord)).toBe(0);
  });

  it('[HP-5] Khoảng cách hai cực → xấp xỉ nửa chu vi Trái Đất (~20015 km)', () => {
    const north: Coordinate = { lat: 90, lng: 0 };
    const south: Coordinate = { lat: -90, lng: 0 };
    const d = haversineKm(north, south);
    expect(d).toBeGreaterThan(19_000);
    expect(d).toBeLessThan(21_000);
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] Kết quả luôn >= 0 với mọi cặp tọa độ hợp lệ', () => {
    const pairs: [Coordinate, Coordinate][] = [
      [{ lat: -90, lng: -180 }, { lat: 90, lng: 180 }],
      [{ lat: 0, lng: 0 }, { lat: 0, lng: 180 }],
      [{ lat: 45, lng: -90 }, { lat: -45, lng: 90 }],
    ];
    for (const [a, b] of pairs) {
      expect(haversineKm(a, b)).toBeGreaterThanOrEqual(0);
    }
  });

  it('[INV-2] Kết quả luôn finite (không NaN, không Infinity)', () => {
    // Các tọa độ cực trị của domain
    const extremes: Coordinate[] = [
      { lat: -90, lng: -180 },
      { lat: -90, lng: 180 },
      { lat: 90, lng: -180 },
      { lat: 90, lng: 180 },
      { lat: 0, lng: 0 },
    ];
    for (const a of extremes) {
      for (const b of extremes) {
        const d = haversineKm(a, b);
        expect(Number.isFinite(d)).toBe(true);
      }
    }
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 cặp tọa độ → kết quả finite, >= 0, đối xứng', () => {
    fc.assert(
      fc.property(coordArb, coordArb, (a, b) => {
        const ab = haversineKm(a, b);
        const ba = haversineKm(b, a);

        expect(Number.isFinite(ab)).toBe(true);
        expect(ab).toBeGreaterThanOrEqual(0);
        // Symmetry: |ab - ba| < epsilon (floating-point có thể lệch nhỏ)
        expect(Math.abs(ab - ba)).toBeLessThan(1e-9);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// ==========================================
// zoneDiameter
// ==========================================
// ==========================================

describe('zoneDiameter', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Empty array → 0 (không throw)', () => {
    expect(zoneDiameter([])).toBe(0);
  });

  it('[HP-2] Single zone → 0 (không throw)', () => {
    expect(zoneDiameter([zoneHCM])).toBe(0);
  });

  it('[HP-3] Hai zones trùng tọa độ → 0 (không phải -0)', () => {
    const d = zoneDiameter([zoneHCM, zoneSame]);
    expect(d).toBe(0);
    expect(Object.is(d, -0)).toBe(false);
  });

  it('[HP-4] HCM và Hà Nội → ~1140–1170 km', () => {
    const d = zoneDiameter([zoneHCM, zoneHanoi]);
    expect(d).toBeGreaterThan(1140);
    expect(d).toBeLessThan(1170);
  });

  it('[HP-5] 3 zones → max pairwise distance (không phải tổng)', () => {
    const zoneOrigin = makeZone('z-origin', originCoord);
    const d = zoneDiameter([zoneHCM, zoneHanoi, zoneOrigin]);
    // Max pairwise là HCM↔Hanoi (~1150 km) hoặc Hanoi↔Origin
    expect(d).toBeGreaterThan(1000);
    expect(Number.isFinite(d)).toBe(true);
  });

  it('[HP-6] Kết quả bất biến với thứ tự đầu vào (commutative)', () => {
    const d1 = zoneDiameter([zoneHCM, zoneHanoi]);
    const d2 = zoneDiameter([zoneHanoi, zoneHCM]);
    expect(d1).toBe(d2);
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] Kết quả luôn >= 0', () => {
    expect(zoneDiameter([])).toBeGreaterThanOrEqual(0);
    expect(zoneDiameter([zoneHCM])).toBeGreaterThanOrEqual(0);
    expect(zoneDiameter([zoneHCM, zoneHanoi])).toBeGreaterThanOrEqual(0);
  });

  it('[INV-2] Kết quả luôn finite', () => {
    expect(Number.isFinite(zoneDiameter([]))).toBe(true);
    expect(Number.isFinite(zoneDiameter([zoneHCM]))).toBe(true);
    expect(Number.isFinite(zoneDiameter([zoneHCM, zoneHanoi]))).toBe(true);
  });

  it('[INV-3] Zones ở cực trái ngược → kết quả finite (không overflow)', () => {
    const north = makeZone('north', { lat: 90, lng: 0 });
    const south = makeZone('south', { lat: -90, lng: 0 });
    const d = zoneDiameter([north, south]);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 zone arrays → diameter finite, >= 0, đơn điệu khi thêm zone', () => {
    fc.assert(
      fc.property(zonesArb(0), (zones) => {
        const d = zoneDiameter(zones);
        expect(Number.isFinite(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(0);

        // Thêm 1 zone với centroid giống zone đầu → diameter không giảm
        if (zones.length > 0) {
          const extraZone = makeZone('extra', zones[0]!.centroid);
          const dWithExtra = zoneDiameter([...zones, extraZone]);
          expect(dWithExtra).toBeGreaterThanOrEqual(d - 1e-9);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('[FUZZ] Symmetry: thứ tự zones không ảnh hưởng kết quả', () => {
    fc.assert(
      fc.property(zonesArb(2), (zones) => {
        const d1 = zoneDiameter(zones);
        const d2 = zoneDiameter([...zones].reverse());
        expect(Math.abs(d1 - d2)).toBeLessThan(1e-9);
      }),
      { numRuns: 500 }
    );
  });
});

// ==========================================
// ==========================================
// meanCoordinate
// ==========================================
// ==========================================

describe('meanCoordinate', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Single coord → trả về chính nó', () => {
    const result = meanCoordinate([hcmCoord]);
    expect(result.lat).toBeCloseTo(hcmCoord.lat);
    expect(result.lng).toBeCloseTo(hcmCoord.lng);
  });

  it('[HP-2] Hai tọa độ đối xứng qua gốc → (0, 0)', () => {
    const a: Coordinate = { lat: 10, lng: 20 };
    const b: Coordinate = { lat: -10, lng: -20 };
    const result = meanCoordinate([a, b]);
    expect(result.lat).toBeCloseTo(0);
    expect(result.lng).toBeCloseTo(0);
  });

  it('[HP-3] Trung bình HCM và Hà Nội', () => {
    const result = meanCoordinate([hcmCoord, hanoiCoord]);
    expect(result.lat).toBeCloseTo((hcmCoord.lat + hanoiCoord.lat) / 2);
    expect(result.lng).toBeCloseTo((hcmCoord.lng + hanoiCoord.lng) / 2);
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] Empty array → throw GeometryError', () => {
    expect(() => meanCoordinate([])).toThrow(GeometryError);
    expect(() => meanCoordinate([])).toThrow(/at least 1/);
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 coord arrays → mean là finite và trong bounds hợp lệ', () => {
    fc.assert(
      fc.property(
        fc.array(coordArb, { minLength: 1, maxLength: 50 }),
        (coords) => {
          const result = meanCoordinate(coords);
          expect(Number.isFinite(result.lat)).toBe(true);
          expect(Number.isFinite(result.lng)).toBe(true);
          // Mean phải nằm trong range của input
          const minLat = Math.min(...coords.map((c) => c.lat));
          const maxLat = Math.max(...coords.map((c) => c.lat));
          const minLng = Math.min(...coords.map((c) => c.lng));
          const maxLng = Math.max(...coords.map((c) => c.lng));
          expect(result.lat).toBeGreaterThanOrEqual(minLat - 1e-9);
          expect(result.lat).toBeLessThanOrEqual(maxLat + 1e-9);
          expect(result.lng).toBeGreaterThanOrEqual(minLng - 1e-9);
          expect(result.lng).toBeLessThanOrEqual(maxLng + 1e-9);
        }
      ),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// ==========================================
// haversineDistance (alias của haversineKm)
// ==========================================
// ==========================================

describe('haversineDistance', () => {
  it('[HP-1] Alias: haversineDistance(A,B) === haversineKm(A,B)', () => {
    const a: Coordinate = { lat: 10.762, lng: 106.660 };
    const b: Coordinate = { lat: 21.028, lng: 105.834 };
    expect(haversineDistance(a, b)).toBe(haversineKm(a, b));
  });

  it('[HP-2] Cùng tọa độ → 0 (không phải -0)', () => {
    const a: Coordinate = { lat: 0, lng: 0 };
    expect(haversineDistance(a, a)).toBe(0);
    expect(Object.is(haversineDistance(a, a), -0)).toBe(false);
  });

  it('[INV-1] Kết quả luôn finite và >= 0', () => {
    const extremes: [Coordinate, Coordinate][] = [
      [{ lat: -90, lng: -180 }, { lat: 90, lng: 180 }],
      [{ lat: 0, lng: -180 }, { lat: 0, lng: 180 }],
    ];
    for (const [a, b] of extremes) {
      expect(Number.isFinite(haversineDistance(a, b))).toBe(true);
      expect(haversineDistance(a, b)).toBeGreaterThanOrEqual(0);
    }
  });

  it('[NaN-1] sqrt clamp guard: 2 điểm gần-antipodal không sinh NaN (h tiệm cận 1)', () => {
    // lat/lng gần cực đối nhau nhất có thể → h ≈ 1 → Math.max(0,h) và Math.min(1,√h) phải clamp
    const a: Coordinate = { lat: 89.9999, lng: 0 };
    const b: Coordinate = { lat: -89.9999, lng: 180 };
    const result = haversineDistance(a, b);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(21_000); // không vượt nửa chu vi Trái Đất
  });

  it('[NaN-2] asin clamp guard: cùng tọa độ với floating-point precision → 0, không NaN', () => {
    // Đây là trường hợp h = 0 chính xác → sqrt(0) = 0 → asin(0) = 0 → dist = 0
    const a: Coordinate = { lat: 45.123456789, lng: 120.987654321 };
    const result = haversineDistance(a, { ...a });
    expect(result).toBe(0); // phải chính xác 0, không phải -0 hay NaN
    expect(Object.is(result, -0)).toBe(false);
  });
});

// ==========================================
// ==========================================
// polygonCentroid
// ==========================================
// ==========================================

describe('polygonCentroid', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Hình vuông đơn vị → centroid tại tâm (0.5, 0.5)', () => {
    // Hình vuông: (0,0), (1,0), (1,1), (0,1)
    const square: Coordinate[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 0 },
    ];
    const c = polygonCentroid(square);
    expect(c.lat).toBeCloseTo(0.5, 8);
    expect(c.lng).toBeCloseTo(0.5, 8);
  });

  it('[HP-2] Hình vuông đã khép kín (điểm đầu = điểm cuối) → cùng kết quả', () => {
    const squareClosed: Coordinate[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 0 },
      { lat: 0, lng: 0 }, // khép kín
    ];
    const c = polygonCentroid(squareClosed);
    expect(c.lat).toBeCloseTo(0.5, 8);
    expect(c.lng).toBeCloseTo(0.5, 8);
  });

  it('[HP-3] Tam giác đều → centroid tại trung điểm', () => {
    // Tam giác với 3 đỉnh: centroid = trung bình số học
    const tri: Coordinate[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 6 },
      { lat: 4, lng: 3 },
    ];
    const c = polygonCentroid(tri);
    // Centroid tam giác = (0+0+4)/3, (0+6+3)/3
    expect(c.lat).toBeCloseTo(4 / 3, 5);
    expect(c.lng).toBeCloseTo(3, 5);
  });

  it('[HP-4] 1 điểm → trả về điểm đó', () => {
    const pt: Coordinate = { lat: 15, lng: 100 };
    const c = polygonCentroid([pt]);
    expect(c.lat).toBeCloseTo(pt.lat);
    expect(c.lng).toBeCloseTo(pt.lng);
  });

  it('[HP-5] 2 điểm → trả về trung điểm', () => {
    const a: Coordinate = { lat: 0, lng: 0 };
    const b: Coordinate = { lat: 10, lng: 20 };
    const c = polygonCentroid([a, b]);
    expect(c.lat).toBeCloseTo(5);
    expect(c.lng).toBeCloseTo(10);
  });

  it('[HP-6] Polygon degenerate (tất cả điểm thẳng hàng) → finite (không throw)', () => {
    // Tất cả point cùng x → area = 0 → fallback mean
    const collinear: Coordinate[] = [
      { lat: 0, lng: 5 },
      { lat: 1, lng: 5 },
      { lat: 2, lng: 5 },
      { lat: 3, lng: 5 },
    ];
    const c = polygonCentroid(collinear);
    expect(Number.isFinite(c.lat)).toBe(true);
    expect(Number.isFinite(c.lng)).toBe(true);
    expect(c.lng).toBeCloseTo(5); // fallback mean lng = 5
  });

  // --- NHÓM 2: Contract Violations ---
  it('[INV-1] Empty array → throw GeometryError', () => {
    expect(() => polygonCentroid([])).toThrow(GeometryError);
    expect(() => polygonCentroid([])).toThrow(/at least 1/);
  });

  it('[INV-2] Kết quả luôn finite', () => {
    const polygon: Coordinate[] = [
      { lat: -90, lng: -180 },
      { lat: -90, lng: 180 },
      { lat: 90, lng: 0 },
    ];
    const c = polygonCentroid(polygon);
    expect(Number.isFinite(c.lat)).toBe(true);
    expect(Number.isFinite(c.lng)).toBe(true);
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 500 polygons ngẫu nhiên → centroid finite, không throw', () => {
    const coordArb: fc.Arbitrary<Coordinate> = fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    });

    fc.assert(
      fc.property(
        fc.array(coordArb, { minLength: 1, maxLength: 20 }),
        (coords) => {
          const c = polygonCentroid(coords);
          expect(Number.isFinite(c.lat)).toBe(true);
          expect(Number.isFinite(c.lng)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[LOGIC-OR] close-polygon: guard || phân biệt closed vs open → centroid hợp lệ', () => {
    // Nếu guard sai (dùng &&), polygon đã khép sẽ bị push thêm điểm trùng → area lệch
    // Nếu guard đúng (dùng ||), cả hai đều sinh ra centroid finite trong convex hull
    const closed: Coordinate[] = [
      { lat: 0, lng: 0 }, { lat: 1, lng: 0 },
      { lat: 1, lng: 1 }, { lat: 0, lng: 0 }, // ← trùng first: đã khép
    ];
    const open: Coordinate[] = [
      { lat: 0, lng: 0 }, { lat: 1, lng: 0 },
      { lat: 1, lng: 1 }, { lat: 0.5, lng: 0.5 }, // ← khác first: chưa khép
    ];
    const c1 = polygonCentroid(closed);
    const c2 = polygonCentroid(open);
    // Cả hai phải cho centroid finite
    expect(Number.isFinite(c1.lat)).toBe(true);
    expect(Number.isFinite(c1.lng)).toBe(true);
    expect(Number.isFinite(c2.lat)).toBe(true);
    expect(Number.isFinite(c2.lng)).toBe(true);
    // closed: centroid của tam giác (0,0)-(1,0)-(1,1) phải nằm trong [0,1]
    expect(c1.lat).toBeGreaterThanOrEqual(0);
    expect(c1.lat).toBeLessThanOrEqual(1);
    expect(c1.lng).toBeGreaterThanOrEqual(0);
    expect(c1.lng).toBeLessThanOrEqual(1);
  });
});

// ==========================================
// ==========================================
// buildAdjacencyMatrix
// ==========================================
// ==========================================

  describe('buildAdjacencyMatrix', () => {
  /**
   * Create a zone with a proper unique polygon (square) at given grid position.
   * Each zone occupies a 0.1° × 0.1° cell in a grid.
   * Adjacent zones share edges; diagonal zones only share a corner point.
   *
   *   col 0      col 1      col 2
   *  ┌──────┐  ┌──────┐
   *  │  A   │──│  B   │   row 1   (A-B share edge, A-D only corner)
   *  └──────┘  └──────┘
   *  ┌──────┐  ┌──────┐
   *  │  C   │──│  D   │   row 0
   *  └──────┘  └──────┘
   */
  function mkGridZone(id: string, col: number, row: number): Zone {
    const x0 = 106.0 + col * 0.1;
    const y0 = 10.0 + row * 0.1;
    const x1 = x0 + 0.1;
    const y1 = y0 + 0.1;
    return {
      id, name: id,
      polygon: { type: 'Polygon', coordinates: [[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]] },
      centroid: { lat: (y0+y1)/2, lng: (x0+x1)/2 },
      activities: [], status: 'unassigned',
    };
  }

  // Zones isolated far away (no shared edges with grid)
  function mkIsolatedZone(id: string): Zone {
    return {
      id, name: id,
      polygon: { type: 'Polygon', coordinates: [[[0,0],[0.1,0],[0.1,0.1],[0,0.1],[0,0]]] },
      centroid: { lat: 0.05, lng: 0.05 },
      activities: [], status: 'unassigned',
    };
  }

  const zA = mkGridZone('A', 0, 1); // top-left
  const zB = mkGridZone('B', 1, 1); // top-right (shares edge with A)
  const zC = mkGridZone('C', 0, 0); // bottom-left (shares edge with A)
  const zD = mkGridZone('D', 1, 0); // bottom-right (diagonal to A, shares edge with B and C)
  const zFar = mkIsolatedZone('far'); // no shared edges with grid

  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Zones rỗng → trả về {}', () => {
    expect(buildAdjacencyMatrix([])).toEqual({});
  });

  it('[HP-2] Adjacent zones (share edge) → kề nhau', () => {
    const matrix = buildAdjacencyMatrix([zA, zB]);
    expect(matrix['A']).toContain('B');
    expect(matrix['B']).toContain('A');
  });

  it('[HP-3] Diagonal zones (share only corner) → KHÔNG kề nhau', () => {
    // A (col0,row1) and D (col1,row0) only share point (106.1, 10.1)
    const matrix = buildAdjacencyMatrix([zA, zD]);
    expect(matrix['A']).not.toContain('D');
    expect(matrix['D']).not.toContain('A');
  });

  it('[HP-4] Symmetric: nếu A kề B thì B kề A', () => {
    const matrix = buildAdjacencyMatrix([zA, zB, zC, zD]);
    for (const [id, neighbors] of Object.entries(matrix)) {
      for (const nid of neighbors) {
        expect(matrix[nid]).toContain(id);
      }
    }
  });

  it('[HP-5] Full grid adjacency: A↔B, A↔C, B↔D, C↔D, A✗D, B✗C', () => {
    const matrix = buildAdjacencyMatrix([zA, zB, zC, zD]);
    // Horizontal/vertical adjacency
    expect(matrix['A']).toContain('B');  // horizontal
    expect(matrix['A']).toContain('C');  // vertical
    expect(matrix['B']).toContain('D');  // vertical
    expect(matrix['C']).toContain('D');  // horizontal
    // Diagonal — NOT adjacent
    expect(matrix['A']).not.toContain('D');
    expect(matrix['B']).not.toContain('C');
  });

  it('[HP-6] Mọi zone đều có entry trong kết quả (dù không kề ai)', () => {
    const matrix = buildAdjacencyMatrix([zA, zFar]);
    expect('A' in matrix).toBe(true);
    expect('far' in matrix).toBe(true);
    expect(matrix['A']).toHaveLength(0);
    expect(matrix['far']).toHaveLength(0);
  });

  it('[HP-7] Self-loop không tồn tại: zone không kề chính nó', () => {
    const matrix = buildAdjacencyMatrix([zA, zB, zC, zD]);
    for (const [id, neighbors] of Object.entries(matrix)) {
      expect(neighbors).not.toContain(id);
    }
  });

  // --- NHÓM 2: Contract Violations ---
  it('[INV-1] thresholdKm param is backward-compatible (ignored)', () => {
    // thresholdKm used to control adjacency; now polygon-based
    const matrix = buildAdjacencyMatrix([zA, zB], -1);
    // Still detects polygon adjacency regardless of threshold
    expect(matrix['A']).toContain('B');
  });

  it('[INV-2] Single zone → matrix có 1 entry rỗng', () => {
    const matrix = buildAdjacencyMatrix([zA]);
    expect(Object.keys(matrix)).toHaveLength(1);
    expect(matrix['A']).toHaveLength(0);
  });

    it('[INV-3] Isolated zones (no shared edges) → not adjacent', () => {
      const matrix = buildAdjacencyMatrix([zA, zFar]);
      expect(matrix['A']).not.toContain('far');
      expect(matrix['far']).not.toContain('A');
    });

    it('[HP-8] Near-boundary (small gap) → adjacent by default (gap-bridging)', () => {
      // Two 100m-ish squares with a small gap between them.
      // Default NEAR_BOUNDARY_KM in geometry.ts is 0.12km (~120m),
      // so a ~50-80m gap should be considered adjacent.
      const left: Zone = {
        id: 'left',
        name: 'left',
        polygon: {
          type: 'Polygon',
          // [lng,lat] around Hanoi-ish coords (degrees), 0.001 ~ 111m lat.
          coordinates: [[[105.8, 21.0], [105.801, 21.0], [105.801, 21.001], [105.8, 21.001], [105.8, 21.0]]],
        },
        centroid: { lat: 21.0005, lng: 105.8005 },
        activities: [],
        status: 'unassigned',
      };
      const right: Zone = {
        id: 'right',
        name: 'right',
        polygon: {
          type: 'Polygon',
          // Gap of 0.0006 deg in lng (~60m at this latitude)
          coordinates: [[[105.8016, 21.0], [105.8026, 21.0], [105.8026, 21.001], [105.8016, 21.001], [105.8016, 21.0]]],
        },
        centroid: { lat: 21.0005, lng: 105.8021 },
        activities: [],
        status: 'unassigned',
      };

      const matrix = buildAdjacencyMatrix([left, right]);
      expect(matrix['left']).toContain('right');
      expect(matrix['right']).toContain('left');
    });

    it('[HP-9] Near-boundary respects thresholdKm override (smaller threshold blocks adjacency)', () => {
      const left: Zone = {
        id: 'left2',
        name: 'left2',
        polygon: { type: 'Polygon', coordinates: [[[105.8, 21.0], [105.801, 21.0], [105.801, 21.001], [105.8, 21.001], [105.8, 21.0]]] },
        centroid: { lat: 21.0005, lng: 105.8005 },
        activities: [],
        status: 'unassigned',
      };
      const right: Zone = {
        id: 'right2',
        name: 'right2',
        polygon: { type: 'Polygon', coordinates: [[[105.8016, 21.0], [105.8026, 21.0], [105.8026, 21.001], [105.8016, 21.001], [105.8016, 21.0]]] },
        centroid: { lat: 21.0005, lng: 105.8021 },
        activities: [],
        status: 'unassigned',
      };

      // 0.03km (30m) < gap (~60m) → should NOT connect
      const matrix = buildAdjacencyMatrix([left, right], 0.03);
      expect(matrix['left2']).not.toContain('right2');
      expect(matrix['right2']).not.toContain('left2');
    });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] Grid of NxN zones → symmetric, no self-loop, only edge-sharing adjacency', () => {
    // Create a 4x4 grid
    const zones: Zone[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        zones.push(mkGridZone(`g${r}_${c}`, c, r));
      }
    }
    const matrix = buildAdjacencyMatrix(zones);

    // Every zone has entry
    for (const z of zones) {
      expect(z.id in matrix).toBe(true);
    }

    // Symmetric
    for (const [id, neighbors] of Object.entries(matrix)) {
      for (const nid of neighbors) {
        expect(matrix[nid]).toContain(id);
      }
    }

    // No self-loop
    for (const [id, neighbors] of Object.entries(matrix)) {
      expect(neighbors).not.toContain(id);
    }

    // Corner zones have 2 neighbors, edge zones 3, center zones 4
    expect(matrix['g0_0']!.length).toBe(2); // corner
    expect(matrix['g1_1']!.length).toBe(4); // center
    expect(matrix['g0_1']!.length).toBe(3); // edge

    // Diagonal should NOT be adjacent
    expect(matrix['g0_0']).not.toContain('g1_1');
  });

  it('[STR-ID] polygon edge-sharing: adjacent zones share IDs correctly', () => {
    // A (col0,row0), B (col1,row0) share right/left edge
    // gamma is isolated — no shared edges
    const alpha = mkGridZone('alpha', 0, 0);
    const beta  = mkGridZone('beta',  1, 0);
    const gamma = mkIsolatedZone('gamma');
    const mat = buildAdjacencyMatrix([alpha, beta, gamma]);

    // alpha kề beta VÀ ngược lại (symmetric)
    expect(mat['alpha']).toContain('beta');
    expect(mat['beta']).toContain('alpha');

    // không ai tự kề chính mình (no self-loop)
    expect(mat['alpha']).not.toContain('alpha');
    expect(mat['beta']).not.toContain('beta');
    expect(mat['gamma']).not.toContain('gamma');

    // gamma không kề ai
    expect(mat['gamma']).toHaveLength(0);
  });
});


// ==========================================
// ==========================================
// buildDistanceMatrix
// ==========================================
// ==========================================

describe('buildDistanceMatrix', () => {
  const hcmCoord: Coordinate = { lat: 10.762, lng: 106.660 };
  const hanoiCoord: Coordinate = { lat: 21.028, lng: 105.834 };

  const closedRing4: [number, number][] = [
    [106.6, 10.7], [106.7, 10.7], [106.7, 10.8], [106.6, 10.7],
  ];

  function mkZone(id: string, centroid: Coordinate): Zone {
    return {
      id, name: id,
      polygon: { type: 'Polygon', coordinates: [closedRing4] },
      centroid, activities: [], status: 'unassigned',
    };
  }

  const zHCM = mkZone('hcm', hcmCoord);
  const zHanoi = mkZone('hanoi', hanoiCoord);

  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Zones rỗng → trả về {}', () => {
    expect(buildDistanceMatrix([])).toEqual({});
  });

  it('[HP-2] 1 zone → { [id]: { [id]: 0 } } (diagonal = 0)', () => {
    const matrix = buildDistanceMatrix([zHCM]);
    expect(matrix['hcm']!['hcm']).toBe(0);
  });

  it('[HP-3] Diagonal luôn = 0', () => {
    const matrix = buildDistanceMatrix([zHCM, zHanoi]);
    expect(matrix['hcm']!['hcm']).toBe(0);
    expect(matrix['hanoi']!['hanoi']).toBe(0);
  });

  it('[HP-4] Symmetric: distance[A][B] === distance[B][A]', () => {
    const matrix = buildDistanceMatrix([zHCM, zHanoi]);
    expect(matrix['hcm']!['hanoi']).toBe(matrix['hanoi']!['hcm']);
  });

  it('[HP-5] HCM ↔ Hà Nội khoảng 1140–1170 km', () => {
    const matrix = buildDistanceMatrix([zHCM, zHanoi]);
    const d = matrix['hcm']!['hanoi']!;
    expect(d).toBeGreaterThan(1140);
    expect(d).toBeLessThan(1170);
  });

  it('[HP-6] Mọi giá trị finite và >= 0', () => {
    const matrix = buildDistanceMatrix([zHCM, zHanoi]);
    for (const row of Object.values(matrix)) {
      for (const val of Object.values(row)) {
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('[HP-7] N zones → N×N entries (mỗi zone có entry đến mọi zone khác + diagonal)', () => {
    const zones = [zHCM, zHanoi, mkZone('z3', { lat: 16, lng: 108 })];
    const matrix = buildDistanceMatrix(zones);
    expect(Object.keys(matrix)).toHaveLength(3);
    for (const row of Object.values(matrix)) {
      expect(Object.keys(row)).toHaveLength(3);
    }
  });

  // --- NHÓM 2: Contract Violations ---
  it('[INV-1] Tất cả values non-negative (không âm)', () => {
    const zones = [
      zHCM,
      zHanoi,
      mkZone('origin', { lat: 0, lng: 0 }),
    ];
    const matrix = buildDistanceMatrix(zones);
    for (const row of Object.values(matrix)) {
      for (const val of Object.values(row)) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 300 zone arrays → symmetric, diagonal=0, tất cả finite >= 0', () => {
    const coordArb: fc.Arbitrary<Coordinate> = fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    });

    fc.assert(
      fc.property(
        fc.array(coordArb, { minLength: 0, maxLength: 8 }),
        (coords) => {
          const zones = coords.map((c, i): Zone => ({
            id: `z${i}`, name: `z${i}`,
            polygon: { type: 'Polygon', coordinates: [closedRing4] },
            centroid: c, activities: [], status: 'unassigned',
          }));

          const matrix = buildDistanceMatrix(zones);

          for (const zi of zones) {
            // Diagonal = 0
            expect(matrix[zi.id]![zi.id]).toBe(0);

            for (const zj of zones) {
              const d = matrix[zi.id]![zj.id]!;
              // Finite & non-negative
              expect(Number.isFinite(d)).toBe(true);
              expect(d).toBeGreaterThanOrEqual(0);
              // Symmetric
              expect(matrix[zi.id]![zj.id]).toBe(matrix[zj.id]![zi.id]);
            }
          }
        }
      ),
      { numRuns: 300 }
    );
  });
});

describe('polygon topology validation', () => {
  const squareA = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  const squareB = [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]];
  const overlapping = [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5]];
  const bowTie = [[0, 0], [1, 1], [0, 1], [1, 0], [0, 0]];

  const zoneFromRing = (id: string, ring: number[][]): Zone => ({
    id,
    name: id,
    polygon: { type: 'Polygon', coordinates: [ring] },
    centroid: { lat: 0, lng: 0 },
    activities: [],
    status: 'unassigned',
  });

  it('[TOPO-1] shared boundary is allowed, not overlap', () => {
    expect(polygonsOverlap(squareA, squareB)).toBe(false);
    expect(findPolygonTopologyViolations([
      zoneFromRing('a', squareA),
      zoneFromRing('b', squareB),
    ])).toEqual([]);
  });

  it('[TOPO-2] crossing/overlapping polygons are rejected', () => {
    expect(polygonsOverlap(squareA, overlapping)).toBe(true);
    const violations = findPolygonTopologyViolations([
      zoneFromRing('a', squareA),
      zoneFromRing('b', overlapping),
    ]);
    expect(violations).toContainEqual({ type: 'OVERLAP', zoneAId: 'a', zoneBId: 'b' });
  });

  it('[TOPO-3] duplicate polygons are rejected', () => {
    expect(polygonsOverlap(squareA, squareA)).toBe(true);
    expect(() => assertNoPolygonTopologyViolations([
      zoneFromRing('a', squareA),
      zoneFromRing('b', squareA),
    ])).toThrow(GeometryError);
  });

  it('[TOPO-4] self-intersecting polygon ring is rejected', () => {
    expect(polygonSelfIntersects(bowTie)).toBe(true);
    expect(() => assertNoPolygonTopologyViolations([
      zoneFromRing('bad', bowTie),
    ])).toThrow(/self-intersecting/);
  });
});
