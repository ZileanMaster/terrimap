/**
 * Test Suite: L1 → L0 Integration Round-Trip
 *
 * MỤC TIÊU: Phát hiện bug mà random fuzz test bỏ sót.
 * NGUYÊN TẮC: Dùng OUTPUT THỰC của L1 functions (partitionLocalSearch, validateAll,
 *              zoneDiameter) làm INPUT cho L0 TerritoryVersionSchema.parse().
 *
 * Nếu L1 functions vi phạm contract (sản sinh NaN, Infinity, -0...) thì
 * L0 schema sẽ throw — phát hiện bug ngay tại ranh giới layer.
 *
 * Đây là phương pháp "Contract-Based Integration Testing":
 *  L1 output → L0 parse → phải thành công (không throw)
 *  Nếu throw → L1 vi phạm invariant của L0
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { partitionLocalSearch, groupZonesByCluster } from '../lib/partition.js';
import { validateAll } from '../lib/validator.js';
import { zoneDiameter } from '../lib/geometry.js';
import { TerritoryVersionSchema, DistrictSchema } from '../types/domain.schema.js';
import type { Zone, Coordinate, SalesAgent, TerritoryVersion } from '../types/domain.schema.js';

// ==========================================
// HELPERS
// ==========================================

const closedRing: [number, number][] = [
  [106.6, 10.7], [106.7, 10.7], [106.7, 10.8], [106.6, 10.7],
];

function makeZone(id: string, centroid: Coordinate, districtId?: string): Zone {
  if (districtId) {
    return {
      id, name: id,
      polygon: { type: 'Polygon', coordinates: [closedRing] },
      centroid, activities: [],
      status: 'assigned',
      districtId,
    } as Zone;
  }
  return {
    id, name: id,
    polygon: { type: 'Polygon', coordinates: [closedRing] },
    centroid, activities: [],
    status: 'unassigned',
  } as Zone;
}

const agentBase: SalesAgent = {
  id: 'agent-0', name: 'Nguyễn Văn A', activeRegion: 'VN', capacity: 1000,
};

// 10 zones phân bố địa lý Việt Nam
const GEO_ZONES_COORDS: Coordinate[] = [
  { lat: 10.762, lng: 106.660 }, // HCM
  { lat: 21.028, lng: 105.834 }, // Hanoi
  { lat: 16.047, lng: 108.206 }, // Da Nang
  { lat: 10.045, lng: 105.747 }, // Can Tho
  { lat: 13.082, lng: 109.296 }, // Quy Nhon
  { lat: 12.238, lng: 109.190 }, // Nha Trang
  { lat: 22.329, lng: 103.844 }, // Lao Cai
  { lat: 20.410, lng: 106.334 }, // Nam Dinh
  { lat: 11.940, lng: 108.442 }, // Da Lat
  { lat: 17.467, lng: 106.622 }, // Dong Hoi
];

// ==========================================
// HELPER: Build TerritoryVersion từ L1 output
// ==========================================

/**
 * Dùng partitionLocalSearch → validateAll → xây dựng TerritoryVersion hoàn chỉnh.
 * Đây là luồng THỰC TẾ của ứng dụng — L1 tạo ra data, L0 validate nó.
 *
 * NOTE: K-Means có thể tạo ra empty clusters khi zones trùng tọa độ.
 * buildVersionFromPartition bỏ qua districts rỗng (zoneIds.length === 0)
 * vì L0 schema yêu cầu District phải có ít nhất 1 zone.
 * Đây là behavior hợp lệ — ứng dụng thực tế phải handle merge/reassign.
 */
function buildVersionFromPartition(
  rawZones: Zone[],
  m: number,
  iter: number
): TerritoryVersion {
  // Bước 1 (L1): Phân vùng
  const assignment = partitionLocalSearch(rawZones, m, iter);
  // BUG 1 FIX: groupZonesByCluster nhận (Assignment[], Zone[], number)
  const groups = groupZonesByCluster(assignment, rawZones, m);

  // Bước 2: Xây dựng các Zone đã assigned với districtId
  const zonesRecord: Record<string, Zone> = {};
  const agents: Record<string, SalesAgent> = {};
  const districts: Record<string, ReturnType<typeof Object.assign>> = {};

  for (let k = 0; k < m; k++) {
    // BUG 3 FIX: groups là Map<number, Zone[]> → dùng .get() không phải []
    const zoneGroup = groups.get(k) ?? [];
    const zoneIds = zoneGroup.map((z) => z.id);

    // QUAN TRỌNG: Skip districts rỗng (K-Means empty cluster)
    // L0 schema yêu cầu District.zoneIds.length >= 1
    if (zoneIds.length === 0) continue;

    const districtId = `district-${k}`;
    const agentId = `agent-${k}`;

    agents[agentId] = { ...agentBase, id: agentId };

    // Tạo zone assigned với districtId chính xác
    // groups.get(k) đã là Zone[] → không cần rawZones.find() nữa
    for (const zone of zoneGroup) {
      zonesRecord[zone.id] = makeZone(zone.id, zone.centroid, districtId);
    }

    // Bước 3 (L1): Tính diameterScore từ zonesRecord đã assigned
    const districtZones = zoneIds.map((id) => zonesRecord[id]!);
    const diameterScore = zoneDiameter(districtZones);

    const totalWorkload = 0;

    // Bước 4: Tạo version tạm để validateAll tính balanceScore
    const tempVersion: TerritoryVersion = {
      id: 'temp', name: 'temp',
      timestamp: '2025-01-01T00:00:00.000Z',
      version: 1, period: 'WEEKLY',
      zones: { ...zonesRecord },
      districts: {
        [districtId]: {
          id: districtId, name: districtId, salesAgentId: agentId,
          zoneIds, totalWorkload, diameterScore, balanceScore: 100,
        },
      },
      salesAgents: agents,
      adjacencyMatrix: {}, distanceMatrix: {},
    };

    // Bước 5 (L1): Tính balanceScore từ validateAll
    const metrics = validateAll(tempVersion);

    districts[districtId] = {
      id: districtId, name: districtId, salesAgentId: agentId,
      zoneIds, totalWorkload, diameterScore,
      balanceScore: metrics.balanceScore, // <-- giá trị thực từ L1
    };
  }

  return {
    id: `ver-${Date.now()}`,
    name: 'Integration Test Version',
    timestamp: '2025-01-06T00:00:00.000Z',
    version: 1, period: 'WEEKLY',
    zones: zonesRecord,
    districts,
    salesAgents: agents,
    adjacencyMatrix: {}, distanceMatrix: {},
  };
}

// ==========================================
// TEST SUITE
// ==========================================

describe('L1 → L0 Integration Round-Trip', () => {

  // --- FIXED INPUT TESTS (địa lý thực) ---

  it('[INT-1] 10 zones địa lý VN → partitionLocalSearch(m=3) → L0 parse thành công', () => {
    const zones = GEO_ZONES_COORDS.map((c, i) => makeZone(`z${i}`, c));
    const version = buildVersionFromPartition(zones, 3, 10);

    expect(() => TerritoryVersionSchema.parse(version)).not.toThrow();
    const parsed = TerritoryVersionSchema.parse(version);
    // m=3 nhưng có thể ít hơn nếu K-Means tạo empty cluster
    expect(Object.keys(parsed.districts).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(parsed.districts).length).toBeLessThanOrEqual(3);
  });

  it('[INT-2] iter === 0 (round-robin) → output vẫn qua L0 parse (không NaN)', () => {
    const zones = GEO_ZONES_COORDS.map((c, i) => makeZone(`z${i}`, c));
    const version = buildVersionFromPartition(zones, 5, 0);
    expect(() => TerritoryVersionSchema.parse(version)).not.toThrow();
  });

  it('[INT-3] m === zones.length (mỗi zone 1 district) → L0 parse thành công', () => {
    const zones = GEO_ZONES_COORDS.slice(0, 5).map((c, i) => makeZone(`z${i}`, c));
    const version = buildVersionFromPartition(zones, 5, 5);
    expect(() => TerritoryVersionSchema.parse(version)).not.toThrow();
    const parsed = TerritoryVersionSchema.parse(version);
    for (const district of Object.values(parsed.districts)) {
      expect(Number.isFinite(district.diameterScore)).toBe(true);
    }
  });

  it('[INT-4] m === 1 → partitionLocalSearch throw M_TOO_SMALL (contract guard)', () => {
    // partitionLocalSearch requires m >= 2 per contract.
    // buildVersionFromPartition với m=1 propagates PartitionError — đây là behavior đúng.
    const zones = GEO_ZONES_COORDS.map((c, i) => makeZone(`z${i}`, c));
    expect(() => buildVersionFromPartition(zones, 1, 10))
      .toThrow('m must be >= 2');
  });

  it('[INT-5] Zones trùng tọa độ + iter=0 → diameterScore=0, balanceScore finite → L0 parse OK', () => {
    // Dùng iter=0 (round-robin) để đảm bảo không có empty cluster
    // K-Means với iter>0 sẽ gộp tất cả về 1 cluster khi zones trùng tọa độ
    const sameCoord = { lat: 10.762, lng: 106.660 };
    const zones = Array.from({ length: 6 }, (_, i) => makeZone(`z${i}`, sameCoord));

    const version = buildVersionFromPartition(zones, 2, 0); // iter=0: round-robin
    expect(() => TerritoryVersionSchema.parse(version)).not.toThrow();

    const parsed = TerritoryVersionSchema.parse(version);
    for (const d of Object.values(parsed.districts)) {
      // Tất cả zones trùng tọa độ → diameter = 0
      expect(d.diameterScore).toBe(0);
      expect(Number.isFinite(d.balanceScore)).toBe(true);
    }
  });

  it('[INT-5b] Zones trùng tọa độ + iter>0 → K-Means gộp clusters → L0 parse OK (số districts có thể < m)', () => {
    // Khi zones trùng tọa độ + iter>0, K-Means hội tụ tất cả về 1 cluster
    // districts rỗng bị skip → version cuối hợp lệ với L0
    const sameCoord = { lat: 10.762, lng: 106.660 };
    const zones = Array.from({ length: 6 }, (_, i) => makeZone(`z${i}`, sameCoord));

    const version = buildVersionFromPartition(zones, 2, 10);
    expect(() => TerritoryVersionSchema.parse(version)).not.toThrow();

    const parsed = TerritoryVersionSchema.parse(version);
    // Verify mọi district hợp lệ theo L0
    for (const d of Object.values(parsed.districts)) {
      expect(Number.isFinite(d.diameterScore)).toBe(true);
      expect(Number.isFinite(d.balanceScore)).toBe(true);
      expect(d.zoneIds.length).toBeGreaterThanOrEqual(1); // L0 invariant
    }
  });

  it('[INT-6] DistrictSchema trực tiếp reject balanceScore = Infinity (L0 gate)', () => {
    // Kiểm tra L0 schema vẫn là tường thành cuối cùng nếu L1 bị bypass
    expect(() =>
      DistrictSchema.parse({
        id: 'd1', name: 'd1', salesAgentId: 'a1',
        zoneIds: ['z1'],
        totalWorkload: 0,
        diameterScore: 0,
        balanceScore: Infinity, // giá trị không hợp lệ từ L1 bị lọc sai
      })
    ).toThrow();
  });

  it('[INT-7] validateAll output balanceScore luôn pass DistrictSchema.parse', () => {
    // Dùng GEO zones thực, tính balanceScore thực → parse với L0 schema
    const zones = GEO_ZONES_COORDS.map((c, i) => makeZone(`z${i}`, c, 'd1'));
    const zonesRecord: Record<string, Zone> = {};
    for (const z of zones) zonesRecord[z.id] = z;

    const baseDistrict = {
      id: 'd1', name: 'd1', salesAgentId: 'agent-0',
      zoneIds: zones.map((z) => z.id),
      totalWorkload: 50,
      diameterScore: zoneDiameter(zones),
      balanceScore: 100,
    };

    const version: TerritoryVersion = {
      id: 'v1', name: 'v1',
      timestamp: '2025-01-01T00:00:00.000Z',
      version: 1, period: 'WEEKLY',
      zones: zonesRecord,
      districts: { d1: baseDistrict },
      salesAgents: { 'agent-0': agentBase },
      adjacencyMatrix: {}, distanceMatrix: {},
    };

    const metrics = validateAll(version);

    // metrics.balanceScore từ L1 phải pass L0 District schema
    expect(() =>
      DistrictSchema.parse({ ...baseDistrict, balanceScore: metrics.balanceScore })
    ).not.toThrow();

    // Đảm bảo finite
    expect(Number.isFinite(metrics.balanceScore)).toBe(true);
    expect(metrics.balanceScore).toBeGreaterThanOrEqual(0);
    expect(metrics.balanceScore).toBeLessThanOrEqual(100);
  });

  // --- FUZZ INPUT TESTS (random geography) ---

  it('[FUZZ-INT] 300 random zone configs → L1 output luôn pass L0 TerritoryVersionSchema.parse', () => {
    const coordArb: fc.Arbitrary<Coordinate> = fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    });

    fc.assert(
      fc.property(
        // BUG 2 FIX: minLength >= 2 để luôn có đủ zones cho m >= 2
        fc.array(coordArb, { minLength: 2, maxLength: 10 }),
        // BUG 2 FIX: min: 2 để m >= 2 (partitionLocalSearch contract)
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 0, max: 20 }),
        (coords, mRaw, iter) => {
          const zones = coords.map((c, i) => makeZone(`z${i}`, c));
          // Clamp m vào [2, zones.length] — đảm bảo contract
          const m = Math.min(mRaw, zones.length);
          if (m < 2) return; // skip nếu zones.length < 2 (không thể xảy ra do minLength: 2)

          const version = buildVersionFromPartition(zones, m, iter);

          // KEY ASSERTION: L1 output phải pass L0 schema — không có NaN, Infinity, -0
          expect(() => TerritoryVersionSchema.parse(version)).not.toThrow();

          const parsed = TerritoryVersionSchema.parse(version);

          // Verify mọi metric trong districts đều finite (L0 invariants)
          for (const d of Object.values(parsed.districts)) {
            expect(Number.isFinite(d.diameterScore)).toBe(true);
            expect(Number.isFinite(d.balanceScore)).toBe(true);
            expect(Number.isFinite(d.totalWorkload)).toBe(true);
            expect(d.diameterScore).toBeGreaterThanOrEqual(0);
            expect(d.balanceScore).toBeGreaterThanOrEqual(0);
            expect(d.balanceScore).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('[FUZZ-INT] 200 samples: iter=0 (round-robin) → L0 parse + finite invariants', () => {
    const coordArb: fc.Arbitrary<Coordinate> = fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    });

    fc.assert(
      fc.property(
        // BUG 2 FIX: minLength >= 2 để zones.length >= 2
        fc.array(coordArb, { minLength: 2, maxLength: 8 }),
        // BUG 2 FIX: min: 2 để m >= 2
        fc.integer({ min: 2, max: 4 }),
        (coords, mRaw) => {
          const zones = coords.map((c, i) => makeZone(`z${i}`, c));
          // Clamp m vào [2, zones.length]
          const m = Math.min(mRaw, zones.length);
          if (m < 2) return;

          // iter=0: round-robin → không chạy K-Means → không có empty cluster
          const version = buildVersionFromPartition(zones, m, 0);

          expect(() => TerritoryVersionSchema.parse(version)).not.toThrow();
        }
      ),
      { numRuns: 200 }
    );
  });
});
