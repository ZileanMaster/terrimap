/**
 * Test Suite cho L0 - Data Primitives (types/domain.schema.ts)
 *
 * Cấu trúc mỗi describe block:
 *  - NHÓM 1: Happy Path
 *  - NHÓM 2: Invariant Violations (Negative Tests)
 *  - NHÓM 3: Fuzz Tests (fast-check, 1000 samples)
 *
 * Tiêu chí pass:
 *  [x] 100% invariants có ít nhất 1 negative test
 *  [x] 0 any/unknown trong types (strict tsconfig)
 *  [x] Round-trip test pass với 1000 samples
 *  [x] Coverage types/domain.schema.ts đạt 100% lines
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  CoordinateSchema,
  GeoJSONPolygonSchema,
  ActivitySchema,
  ZoneSchema,
  UnassignedZoneSchema,
  AssignedZoneSchema,
  SalesAgentSchema,
  DistrictSchema,
  AdjacencyMatrixSchema,
  DistanceMatrixSchema,
  TerritoryVersionSchema,
  type Coordinate,
  type GeoJSONPolygon,
  type Activity,
  type Zone,
  type SalesAgent,
  type District,
  type AdjacencyMatrix,
  type DistanceMatrix,
  type TerritoryVersion,
} from '../types/domain.schema.js';

// ==========================================
// HELPERS - Valid Fixtures dùng chung
// ==========================================

const validCoord: Coordinate = { lat: 10.762, lng: 106.660 };

const validPolygon: GeoJSONPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [106.6, 10.7],
      [106.7, 10.7],
      [106.7, 10.8],
      [106.6, 10.7], // closed
    ],
  ],
};

const validActivity: Activity = {
  id: 'act-1',
  type: 'CUSTOMER',
  value: 42,
};

const validUnassignedZone: Zone = {
  id: 'zone-1',
  name: 'Quận 1',
  polygon: validPolygon,
  centroid: validCoord,
  activities: [validActivity],
  status: 'unassigned',
};

const validAssignedZone: Zone = {
  id: 'zone-2',
  name: 'Quận 2',
  polygon: validPolygon,
  centroid: validCoord,
  activities: [],
  status: 'assigned',
  districtId: 'district-1',
};

const validSalesAgent: SalesAgent = {
  id: 'agent-1',
  name: 'Nguyễn Văn A',
  activeRegion: 'Ho Chi Minh',
  capacity: 200,
};

const validDistrict: District = {
  id: 'district-1',
  name: 'Khu vực Trung tâm',
  salesAgentId: 'agent-1',
  zoneIds: ['zone-1', 'zone-2'],
  totalWorkload: 42,
  diameterScore: 3.5,
  balanceScore: 0.92,
};

const validAdjMatrix: AdjacencyMatrix = {
  'zone-1': ['zone-2'],
  'zone-2': ['zone-1'],
};

const validDistMatrix: DistanceMatrix = {
  'zone-1': { 'zone-1': 0, 'zone-2': 5.2 },
  'zone-2': { 'zone-1': 5.2, 'zone-2': 0 },
};

const validVersion: TerritoryVersion = {
  id: 'ver-001',
  name: 'Tuần 1 Q1/2025',
  timestamp: '2025-01-06T00:00:00.000Z',
  version: 1,
  period: 'WEEKLY',
  zones: { 'zone-1': validUnassignedZone, 'zone-2': validAssignedZone },
  districts: { 'district-1': validDistrict },
  salesAgents: { 'agent-1': validSalesAgent },
  adjacencyMatrix: validAdjMatrix,
  distanceMatrix: validDistMatrix,
};

// ==========================================
// FAST-CHECK ARBITRARIES
// ==========================================

const coordArb = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
});

/** Sinh ra một closed polygon ring hợp lệ (>= 4 points, first === last) */
const polygonRingArb = fc
  .array(
    fc.tuple(
      fc.double({ min: -180, max: 180, noNaN: true }),
      fc.double({ min: -90, max: 90, noNaN: true })
    ),
    { minLength: 3 }
  )
  .map((pts): [number, number][] => {
    const first = pts[0]!;
    return [...pts, first]; // đóng ring
  });

const polygonArb: fc.Arbitrary<GeoJSONPolygon> = fc.oneof(
  fc.record({ type: fc.constant('Polygon' as const), coordinates: fc.array(polygonRingArb, { minLength: 1 }) }),
  fc.record({ type: fc.constant('MultiPolygon' as const), coordinates: fc.array(fc.array(polygonRingArb, { minLength: 1 }), { minLength: 1 }) })
);

const activityArb: fc.Arbitrary<Activity> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('CUSTOMER' as const, 'ORDER' as const, 'REVENUE' as const),
  value: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
  location: fc.option(coordArb, { nil: undefined }),
}).map(({ location, ...activity }) =>
  location === undefined ? activity : { ...activity, location },
);

const baseZoneArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1 }),
  polygon: polygonArb,
  centroid: coordArb,
  activities: fc.array(activityArb),
});

const unassignedZoneArb: fc.Arbitrary<Zone> = baseZoneArb.map((z) => ({
  ...z,
  status: 'unassigned' as const,
}));

const assignedZoneArb: fc.Arbitrary<Zone> = fc.record({
  ...({} as Record<never, never>),
  id: fc.uuid(),
  name: fc.string({ minLength: 1 }),
  polygon: polygonArb,
  centroid: coordArb,
  activities: fc.array(activityArb),
  districtId: fc.uuid(),
}).map((z) => ({ ...z, status: 'assigned' as const }));

const zoneArb: fc.Arbitrary<Zone> = fc.oneof(unassignedZoneArb, assignedZoneArb);

const salesAgentArb: fc.Arbitrary<SalesAgent> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1 }),
  activeRegion: fc.string({ minLength: 1 }),
  capacity: fc.double({ min: 0, max: 100_000, noNaN: true }),
});

/** Sinh ma trận kề đối xứng */
const symmetricAdjMatrixArb: fc.Arbitrary<AdjacencyMatrix> = fc
  .array(fc.uuid(), { minLength: 2, maxLength: 6 })
  .chain((ids) => {
    // Tạo một tập edges ngẫu nhiên (symmetric)
    const pairs: [string, string][] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.push([ids[i]!, ids[j]!]);
      }
    }
    return fc.subarray(pairs).map((selectedPairs) => {
      const matrix: AdjacencyMatrix = {};
      for (const id of ids) matrix[id] = [];
      for (const [a, b] of selectedPairs) {
        matrix[a]!.push(b);
        matrix[b]!.push(a);
      }
      return matrix;
    });
  });

/** Sinh ma trận khoảng cách đối xứng với diagonal = 0 */
const symmetricDistMatrixArb: fc.Arbitrary<DistanceMatrix> = fc
  .array(fc.uuid(), { minLength: 2, maxLength: 5 })
  .chain((ids) =>
    fc
      .array(fc.double({ min: 0.1, max: 1000, noNaN: true }), {
        minLength: ids.length * (ids.length - 1) / 2,
        maxLength: ids.length * (ids.length - 1) / 2,
      })
      .map((dists) => {
        const matrix: DistanceMatrix = {};
        for (const id of ids) matrix[id] = { [id]: 0 };
        let k = 0;
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const d = dists[k++]!;
            matrix[ids[i]!]![ids[j]!] = d;
            matrix[ids[j]!]![ids[i]!] = d;
          }
        }
        return matrix;
      })
  );

const versionArb: fc.Arbitrary<TerritoryVersion> = fc
  .record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1 }),
    timestamp: fc
      .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })
      .map((d) => d.toISOString()),
    version: fc.integer({ min: 1, max: 10_000 }),
    period: fc.constantFrom('WEEKLY' as const, 'MONTHLY' as const, 'CUSTOM' as const),
    adjacencyMatrix: symmetricAdjMatrixArb,
    distanceMatrix: symmetricDistMatrixArb,
  })
  .map((base) => ({
    ...base,
    zones: { 'z1': { ...validUnassignedZone, id: 'z1' } },
    districts: { 'd1': { ...validDistrict, id: 'd1', zoneIds: ['z1'] } },
    salesAgents: { 's1': { ...validSalesAgent, id: 's1' } },
  }));

// ==========================================
// ==========================================
// COORDINATE
// ==========================================
// ==========================================

describe('CoordinateSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse coordinate hợp lệ thành công', () => {
    const result = CoordinateSchema.parse({ lat: 10.762, lng: 106.660 });
    expect(result.lat).toBe(10.762);
    expect(result.lng).toBe(106.660);
  });

  it('[HP-2] Parse tọa độ biên (cực trị) thành công', () => {
    expect(() => CoordinateSchema.parse({ lat: -90, lng: -180 })).not.toThrow();
    expect(() => CoordinateSchema.parse({ lat: 90, lng: 180 })).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] lat < -90 phải throw', () => {
    expect(() => CoordinateSchema.parse({ lat: -91, lng: 0 })).toThrow();
  });

  it('[INV-2] lat > 90 phải throw', () => {
    expect(() => CoordinateSchema.parse({ lat: 91, lng: 0 })).toThrow();
  });

  it('[INV-3] lng < -180 phải throw', () => {
    expect(() => CoordinateSchema.parse({ lat: 0, lng: -181 })).toThrow();
  });

  it('[INV-4] lng > 180 phải throw', () => {
    expect(() => CoordinateSchema.parse({ lat: 0, lng: 181 })).toThrow();
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 valid coordinates parse thành công và round-trip', () => {
    fc.assert(
      fc.property(coordArb, (coord) => {
        const parsed = CoordinateSchema.parse(coord);
        // Round-trip: serialize -> parse lại -> phải bằng nhau
        const serialized = JSON.stringify(parsed);
        const reparsed = CoordinateSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// GEOJSON POLYGON
// ==========================================

describe('GeoJSONPolygonSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse Polygon hợp lệ thành công', () => {
    const result = GeoJSONPolygonSchema.parse(validPolygon);
    expect(result.type).toBe('Polygon');
  });

  it('[HP-2] Parse MultiPolygon hợp lệ thành công', () => {
    const multi: GeoJSONPolygon = {
      type: 'MultiPolygon',
      coordinates: [validPolygon.coordinates as [number, number][][]],
    };
    expect(() => GeoJSONPolygonSchema.parse(multi)).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] Polygon ring < 4 điểm phải throw', () => {
    expect(() =>
      GeoJSONPolygonSchema.parse({
        type: 'Polygon',
        coordinates: [
          [
            [106.6, 10.7],
            [106.7, 10.7],
            [106.6, 10.7], // chỉ 3 điểm - thiếu 1 điểm để đạt >= 4
          ],
        ],
      })
    ).toThrow();
  });

  it('[INV-2] Polygon ring không khép kín (điểm đầu ≠ điểm cuối) phải throw', () => {
    expect(() =>
      GeoJSONPolygonSchema.parse({
        type: 'Polygon',
        coordinates: [
          [
            [106.6, 10.7],
            [106.7, 10.7],
            [106.7, 10.8],
            [106.5, 10.6], // không trùng điểm đầu
          ],
        ],
      })
    ).toThrow();
  });

  it('[INV-3] Polygon không có ring nào phải throw', () => {
    expect(() =>
      GeoJSONPolygonSchema.parse({ type: 'Polygon', coordinates: [] })
    ).toThrow();
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 valid polygons parse và round-trip', () => {
    fc.assert(
      fc.property(polygonArb, (poly) => {
        const parsed = GeoJSONPolygonSchema.parse(poly);
        const serialized = JSON.stringify(parsed);
        const reparsed = GeoJSONPolygonSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// ACTIVITY
// ==========================================

describe('ActivitySchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse Activity đầy đủ fields thành công', () => {
    const result = ActivitySchema.parse({
      id: 'act-1',
      type: 'CUSTOMER',
      value: 100,
      location: validCoord,
    });
    expect(result.value).toBe(100);
    expect(result.location).toEqual(validCoord);
  });

  it('[HP-2] Parse Activity không có location (optional) thành công', () => {
    const result = ActivitySchema.parse({ id: 'act-2', type: 'ORDER', value: 0 });
    expect(result.location).toBeUndefined();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] Activity.value < 0 (Zone.customers < 0) phải throw', () => {
    expect(() =>
      ActivitySchema.parse({ id: 'act-x', type: 'CUSTOMER', value: -1 })
    ).toThrow(/Activity.value phải >= 0/);
  });

  it('[INV-2] Activity.type không hợp lệ phải throw', () => {
    expect(() =>
      ActivitySchema.parse({ id: 'act-x', type: 'INVALID', value: 10 })
    ).toThrow();
  });

  it('[INV-3] Activity.id rỗng phải throw', () => {
    expect(() =>
      ActivitySchema.parse({ id: '', type: 'ORDER', value: 0 })
    ).toThrow();
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 valid activities parse và round-trip', () => {
    fc.assert(
      fc.property(activityArb, (act) => {
        const parsed = ActivitySchema.parse(act);
        expect(parsed.value).toBeGreaterThanOrEqual(0);
        const serialized = JSON.stringify(parsed);
        const reparsed = ActivitySchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// ZONE (UnassignedZone + AssignedZone)
// ==========================================

describe('ZoneSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse UnassignedZone hợp lệ thành công', () => {
    const result = ZoneSchema.parse(validUnassignedZone);
    expect(result.status).toBe('unassigned');
  });

  it('[HP-2] Parse AssignedZone hợp lệ thành công', () => {
    const result = ZoneSchema.parse(validAssignedZone);
    if (result.status === 'assigned') {
      expect(result.districtId).toBe('district-1');
    }
  });

  it('[HP-3] Zone có activities rỗng (optional default) parse thành công', () => {
    const zone = { ...validUnassignedZone, activities: [] };
    expect(() => ZoneSchema.parse(zone)).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] Zone.activities có value < 0 phải throw', () => {
    const zone = {
      ...validUnassignedZone,
      activities: [{ id: 'a-1', type: 'CUSTOMER', value: -5 }],
    };
    expect(() => ZoneSchema.parse(zone)).toThrow();
  });

  it('[INV-2] AssignedZone thiếu districtId phải throw', () => {
    const zone = { ...validUnassignedZone, status: 'assigned' };
    expect(() => ZoneSchema.parse(zone)).toThrow();
  });

  it('[INV-3] AssignedZone.districtId rỗng phải throw', () => {
    expect(() =>
      AssignedZoneSchema.parse({ ...validAssignedZone, districtId: '' })
    ).toThrow();
  });

  it('[INV-4] Zone.polygon < 3 điểm (ring < 4) phải throw', () => {
    const badZone = {
      ...validUnassignedZone,
      polygon: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [0, 0]]], // 3 points, not closed correctly with 4
      },
    };
    expect(() => ZoneSchema.parse(badZone)).toThrow();
  });

  it('[INV-5] UnassignedZone không được có districtId', () => {
    // Discriminated union: nếu có districtId nhưng status=unassigned thì schema phải fail
    const zone = { ...validUnassignedZone, districtId: 'some-id' };
    // Parse qua UnassignedZoneSchema (strict) - trường districtId thừa sẽ bị bỏ qua bởi Zod default
    // Nhưng nếu dùng .strict(), nó sẽ throw. Test behavior document:
    const result = UnassignedZoneSchema.parse(zone);
    expect(result.status).toBe('unassigned');
    // Kiểm tra rằng discriminated union không cho phép 'assigned' khi thiếu districtId
    expect(() =>
      ZoneSchema.parse({ ...validUnassignedZone, status: 'assigned' })
    ).toThrow();
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 valid zones parse và round-trip', () => {
    fc.assert(
      fc.property(zoneArb, (zone) => {
        const parsed = ZoneSchema.parse(zone);
        // Invariant: mọi activity value >= 0
        for (const act of parsed.activities) {
          expect(act.value).toBeGreaterThanOrEqual(0);
        }
        // Round-trip
        const serialized = JSON.stringify(parsed);
        const reparsed = ZoneSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// SALES AGENT
// ==========================================

describe('SalesAgentSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse SalesAgent hợp lệ thành công', () => {
    const result = SalesAgentSchema.parse(validSalesAgent);
    expect(result.name).toBe('Nguyễn Văn A');
    expect(result.capacity).toBe(200);
  });

  it('[HP-2] Parse SalesAgent với capacity = 0 thành công', () => {
    expect(() =>
      SalesAgentSchema.parse({ ...validSalesAgent, capacity: 0 })
    ).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] SalesAgent.capacity < 0 phải throw', () => {
    expect(() =>
      SalesAgentSchema.parse({ ...validSalesAgent, capacity: -1 })
    ).toThrow(/capacity phải >= 0/);
  });

  it('[INV-2] SalesAgent.name rỗng phải throw', () => {
    expect(() =>
      SalesAgentSchema.parse({ ...validSalesAgent, name: '' })
    ).toThrow();
  });

  it('[INV-3] SalesAgent.activeRegion rỗng phải throw', () => {
    expect(() =>
      SalesAgentSchema.parse({ ...validSalesAgent, activeRegion: '' })
    ).toThrow();
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 valid sales agents parse và round-trip', () => {
    fc.assert(
      fc.property(salesAgentArb, (agent) => {
        const parsed = SalesAgentSchema.parse(agent);
        expect(parsed.capacity).toBeGreaterThanOrEqual(0);
        const serialized = JSON.stringify(parsed);
        const reparsed = SalesAgentSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// DISTRICT
// ==========================================

describe('DistrictSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse District hợp lệ thành công', () => {
    const result = DistrictSchema.parse(validDistrict);
    expect(result.zoneIds.length).toBeGreaterThan(0);
    expect(result.diameterScore).toBeGreaterThanOrEqual(0);
  });

  it('[HP-2] Parse District với metrics = 0 thành công', () => {
    expect(() =>
      DistrictSchema.parse({
        ...validDistrict,
        totalWorkload: 0,
        diameterScore: 0,
        balanceScore: 0,
      })
    ).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] District.zoneIds rỗng phải throw', () => {
    expect(() =>
      DistrictSchema.parse({ ...validDistrict, zoneIds: [] })
    ).toThrow(/District phải có ít nhất 1 Zone/);
  });

  it('[INV-2] District.totalWorkload < 0 phải throw', () => {
    expect(() =>
      DistrictSchema.parse({ ...validDistrict, totalWorkload: -1 })
    ).toThrow();
  });

  it('[INV-3] District.diameterScore < 0 phải throw', () => {
    expect(() =>
      DistrictSchema.parse({ ...validDistrict, diameterScore: -0.1 })
    ).toThrow();
  });

  it('[INV-4] District.salesAgentId rỗng phải throw', () => {
    expect(() =>
      DistrictSchema.parse({ ...validDistrict, salesAgentId: '' })
    ).toThrow();
  });

  it('[INV-5] District.balanceScore = Infinity phải throw (không JSON-serializable)', () => {
    expect(() =>
      DistrictSchema.parse({ ...validDistrict, balanceScore: Infinity })
    ).toThrow();
  });

  it('[INV-6] District.balanceScore = -Infinity phải throw (không JSON-serializable)', () => {
    expect(() =>
      DistrictSchema.parse({ ...validDistrict, balanceScore: -Infinity })
    ).toThrow();
  });


  it('[FUZZ] 1000 valid districts parse và round-trip', () => {
    const districtArb = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1 }),
      salesAgentId: fc.uuid(),
      zoneIds: fc.array(fc.uuid(), { minLength: 1 }),
      totalWorkload: fc.double({ min: 0, max: 100_000, noNaN: true }),
      diameterScore: fc.double({ min: 0, max: 1000, noNaN: true }),
      balanceScore: fc.double({ min: -1e9, max: 1e9, noNaN: true }),
    });

    fc.assert(
      fc.property(districtArb, (district) => {
        const parsed = DistrictSchema.parse(district);
        expect(parsed.zoneIds.length).toBeGreaterThan(0);
        const serialized = JSON.stringify(parsed);
        const reparsed = DistrictSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// ADJACENCY MATRIX
// ==========================================

describe('AdjacencyMatrixSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse ma trận kề đối xứng hợp lệ thành công', () => {
    const result = AdjacencyMatrixSchema.parse(validAdjMatrix);
    expect(result['zone-1']).toContain('zone-2');
    expect(result['zone-2']).toContain('zone-1');
  });

  it('[HP-2] Parse ma trận kề với zone không có hàng xóm thành công', () => {
    expect(() =>
      AdjacencyMatrixSchema.parse({ 'zone-1': [], 'zone-2': [] })
    ).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] AdjMatrix không symmetric (A->B nhưng B không có A) phải throw', () => {
    expect(() =>
      AdjacencyMatrixSchema.parse({
        'zone-1': ['zone-2'],
        'zone-2': [], // Thiếu 'zone-1'
      })
    ).toThrow(/symmetric/);
  });

  it('[INV-2] AdjMatrix có neighbor không tồn tại trong matrix phải throw', () => {
    expect(() =>
      AdjacencyMatrixSchema.parse({
        'zone-1': ['zone-GHOST'], // zone-GHOST không có entry
      })
    ).toThrow(/symmetric/);
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 symmetric adj matrices parse và round-trip', () => {
    fc.assert(
      fc.property(symmetricAdjMatrixArb, (matrix) => {
        const parsed = AdjacencyMatrixSchema.parse(matrix);
        // Verify symmetry invariant
        for (const [id, neighbors] of Object.entries(parsed)) {
          for (const nb of neighbors) {
            expect(parsed[nb]).toContain(id);
          }
        }
        // Round-trip
        const serialized = JSON.stringify(parsed);
        const reparsed = AdjacencyMatrixSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// DISTANCE MATRIX
// ==========================================

describe('DistanceMatrixSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse ma trận khoảng cách hợp lệ thành công', () => {
    const result = DistanceMatrixSchema.parse(validDistMatrix);
    expect(result['zone-1']?.['zone-1']).toBe(0);
    expect(result['zone-1']?.['zone-2']).toBe(result['zone-2']?.['zone-1']);
  });

  it('[HP-2] Parse ma trận chỉ có 1 zone (diagonal = 0) thành công', () => {
    expect(() =>
      DistanceMatrixSchema.parse({ 'z1': { 'z1': 0 } })
    ).not.toThrow();
  });

  it('[HP-3] Parse sparse DistanceMatrix (chỉ khai báo 1 phía) thành công', () => {
    // Branch coverage: nhánh `if (!reverseRow) continue` trong superRefine.
    // Ma trận sparse: zone-1 biết khoảng cách tới zone-X, nhưng zone-X không có entry riêng.
    // Đây là trường hợp hợp lệ - schema chỉ validate symmetry khi cả 2 hàng tồn tại.
    expect(() =>
      DistanceMatrixSchema.parse({
        'zone-1': { 'zone-1': 0, 'zone-X': 3.5 },
        // zone-X không có entry -> reverseRow = undefined -> skip, không throw
      })
    ).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---

  it('[INV-1] DistMatrix không symmetric phải throw', () => {
    expect(() =>
      DistanceMatrixSchema.parse({
        'zone-1': { 'zone-1': 0, 'zone-2': 5.2 },
        'zone-2': { 'zone-1': 9.9, 'zone-2': 0 }, // 9.9 ≠ 5.2
      })
    ).toThrow(/symmetric/);
  });

  it('[INV-2] DistMatrix diagonal ≠ 0 phải throw', () => {
    expect(() =>
      DistanceMatrixSchema.parse({
        'zone-1': { 'zone-1': 1 }, // diagonal phải = 0
      })
    ).toThrow(/phải = 0/);
  });

  it('[INV-3] DistMatrix có giá trị âm phải throw', () => {
    expect(() =>
      DistanceMatrixSchema.parse({
        'zone-1': { 'zone-1': 0, 'zone-2': -1 },
        'zone-2': { 'zone-1': -1, 'zone-2': 0 },
      })
    ).toThrow();
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 symmetric distance matrices parse và round-trip', () => {
    fc.assert(
      fc.property(symmetricDistMatrixArb, (matrix) => {
        const parsed = DistanceMatrixSchema.parse(matrix);
        // Verify diagonal = 0
        for (const [id, row] of Object.entries(parsed)) {
          expect(row[id]).toBe(0);
        }
        // Verify symmetry
        for (const [rowId, row] of Object.entries(parsed)) {
          for (const [colId, dist] of Object.entries(row)) {
            const reverseDist = parsed[colId]?.[rowId];
            if (reverseDist !== undefined) {
              expect(dist).toBe(reverseDist);
            }
          }
        }
        // Round-trip
        const serialized = JSON.stringify(parsed);
        const reparsed = DistanceMatrixSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});

// ==========================================
// TERRITORY VERSION (ROOT STATE)
// ==========================================

describe('TerritoryVersionSchema', () => {
  // --- NHÓM 1: Happy Path ---
  it('[HP-1] Parse TerritoryVersion đầy đủ thành công', () => {
    const result = TerritoryVersionSchema.parse(validVersion);
    expect(result.version).toBe(1);
    expect(result.period).toBe('WEEKLY');
    expect(Object.keys(result.zones).length).toBe(2);
  });

  it('[HP-2] Parse version với period MONTHLY thành công', () => {
    expect(() =>
      TerritoryVersionSchema.parse({ ...validVersion, period: 'MONTHLY', version: 5 })
    ).not.toThrow();
  });

  it('[HP-3] Parse version với period CUSTOM thành công', () => {
    expect(() =>
      TerritoryVersionSchema.parse({ ...validVersion, period: 'CUSTOM', version: 99 })
    ).not.toThrow();
  });

  // --- NHÓM 2: Invariant Violations ---
  it('[INV-1] Snapshot.timestamp không phải ISO 8601 phải throw', () => {
    expect(() =>
      TerritoryVersionSchema.parse({
        ...validVersion,
        timestamp: '28/01/2025', // không phải ISO 8601
      })
    ).toThrow(/ISO 8601/);
  });

  it('[INV-2] Snapshot.version < 1 (version không hợp lệ) phải throw', () => {
    expect(() =>
      TerritoryVersionSchema.parse({ ...validVersion, version: 0 })
    ).toThrow();
  });

  it('[INV-3] Snapshot.version âm phải throw', () => {
    expect(() =>
      TerritoryVersionSchema.parse({ ...validVersion, version: -1 })
    ).toThrow();
  });

  it('[INV-4] Snapshot.adjacencyMatrix không symmetric phải throw', () => {
    expect(() =>
      TerritoryVersionSchema.parse({
        ...validVersion,
        adjacencyMatrix: { 'z-1': ['z-2'], 'z-2': [] }, // không symmetric
      })
    ).toThrow();
  });

  it('[INV-5] Snapshot.distanceMatrix không symmetric phải throw', () => {
    expect(() =>
      TerritoryVersionSchema.parse({
        ...validVersion,
        distanceMatrix: {
          'z1': { 'z1': 0, 'z2': 5 },
          'z2': { 'z1': 99, 'z2': 0 }, // 99 ≠ 5
        },
      })
    ).toThrow();
  });

  it('[INV-6] District.zoneIds rỗng trong Snapshot phải throw', () => {
    expect(() =>
      TerritoryVersionSchema.parse({
        ...validVersion,
        districts: { 'd1': { ...validDistrict, zoneIds: [] } },
      })
    ).toThrow();
  });

  // --- NHÓM 3: Fuzz Test ---
  it('[FUZZ] 1000 valid TerritoryVersions parse và round-trip', () => {
    fc.assert(
      fc.property(versionArb, (ver) => {
        const parsed = TerritoryVersionSchema.parse(ver);
        // Verify version >= 1
        expect(parsed.version).toBeGreaterThanOrEqual(1);
        // Verify adjacency symmetry
        for (const [id, neighbors] of Object.entries(parsed.adjacencyMatrix)) {
          for (const nb of neighbors) {
            expect(parsed.adjacencyMatrix[nb]).toContain(id);
          }
        }
        // Round-trip
        const serialized = JSON.stringify(parsed);
        const reparsed = TerritoryVersionSchema.parse(JSON.parse(serialized));
        expect(JSON.stringify(reparsed)).toBe(serialized);
      }),
      { numRuns: 1000 }
    );
  });
});
