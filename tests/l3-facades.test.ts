/**
 * tests/l3-facades.test.ts
 *
 * Test suite cho L3 Role Façades.
 * Mock toàn bộ L2 services. KHÔNG mock L3 internal (PermissionError, ViewModels).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../services', () => ({
  TerritoryService: vi.fn(),
  VersionService: vi.fn(),
  ActivityService: vi.fn(),
  MapService: vi.fn(),
}));

import { AdminFacade, CoordinatorFacade, SalesFacade } from '../facades/index.js';
import { PermissionError } from '../facades/errors.js';
import { ServiceError, VersionError } from '../services/errors.js';
import {
  TerritoryService,
  VersionService,
  ActivityService,
} from '../services/index.js';

// ─── Mock service instances ───────────────────────────────────────────────────

const mockTerritory = {
  runPartition: vi.fn(),
  manualSwap: vi.fn(),
  getSuggestions: vi.fn(),
};

const mockVersion = {
  createSnapshot: vi.fn(),
  listHistory: vi.fn(),
  diffSnapshots: vi.fn(),
};

const mockActivity = {
  getDistrictSummary: vi.fn(),
  updateZoneActivity: vi.fn(),
  importActivitiesFromCSV: vi.fn(),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const zones4 = [
  {
    id: 'z1', status: 'unassigned' as const,
    name: 'Zone 1', polygon: { type: 'Polygon' as const, coordinates: [] },
    centroid: { lat: 21.0, lng: 105.8 }, activities: [],
  },
  {
    id: 'z2', status: 'unassigned' as const,
    name: 'Zone 2', polygon: { type: 'Polygon' as const, coordinates: [] },
    centroid: { lat: 21.1, lng: 105.8 }, activities: [],
  },
  {
    id: 'z3', status: 'unassigned' as const,
    name: 'Zone 3', polygon: { type: 'Polygon' as const, coordinates: [] },
    centroid: { lat: 21.0, lng: 105.9 }, activities: [],
  },
  {
    id: 'z4', status: 'unassigned' as const,
    name: 'Zone 4', polygon: { type: 'Polygon' as const, coordinates: [] },
    centroid: { lat: 21.1, lng: 105.9 }, activities: [],
  },
] as any[];

const assignments4 = [
  { zoneId: 'z1', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'z2', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'z3', districtId: 1, salesAgentId: 'sa1' },
  { zoneId: 'z4', districtId: 1, salesAgentId: 'sa1' },
];

const salesAgents = [
  { id: 'sa0', name: 'Agent Zero', activeRegion: 'North', capacity: 200 },
  { id: 'sa1', name: 'Agent One', activeRegion: 'South', capacity: 200 },
] as any[];

beforeEach(() => vi.clearAllMocks());

// ══════════════════════════════════════════════════════════════════════════════
// AdminFacade — PERMISSION MATRIX
// ══════════════════════════════════════════════════════════════════════════════

describe('AdminFacade permissions', () => {
  function makeAdmin() {
    return new AdminFacade(
      mockTerritory as any,
      mockVersion as any,
      mockActivity as any,
    );
  }

  it('[ADM-1] runAlgorithm → gọi territory.runPartition', async () => {
    mockTerritory.runPartition.mockResolvedValue({
      assignments: assignments4, metrics: {}, violations: [],
      algo: 'local-search', durationMs: 10, suggestSA: false,
    });
    const admin = makeAdmin();
    await admin.runAlgorithm('local-search', zones4, 2);
    expect(mockTerritory.runPartition)
      .toHaveBeenCalledWith(zones4, 2, 'local-search', [], undefined);
  });

  it('[ADM-1b] runAlgorithm với opts → opts được truyền qua', async () => {
    mockTerritory.runPartition.mockResolvedValue({
      assignments: assignments4, metrics: {}, violations: [],
      algo: 'sa', durationMs: 50, suggestSA: false,
    });
    const admin = makeAdmin();
    const opts = { cooling: 0.95, t0: 100 };
    await admin.runAlgorithm('sa', zones4, 2, [], opts);
    expect(mockTerritory.runPartition)
      .toHaveBeenCalledWith(zones4, 2, 'sa', [], opts);
  });

  it('[ADM-2] createVersion → gọi version.createSnapshot', async () => {
    mockVersion.createSnapshot.mockReturnValue({ version: 'v1', label: 'sprint-1' });
    const admin = makeAdmin();
    await admin.createVersion('sprint-1', zones4, assignments4);
    expect(mockVersion.createSnapshot)
      .toHaveBeenCalledWith('sprint-1', zones4, assignments4);
  });

  it('[ADM-3] getVersionHistory → gọi version.listHistory', () => {
    mockVersion.listHistory.mockReturnValue([]);
    const admin = makeAdmin();
    admin.getVersionHistory();
    expect(mockVersion.listHistory).toHaveBeenCalled();
  });

  it('[ADM-4] exportReport trả về object có đủ sections', () => {
    mockVersion.listHistory.mockReturnValue([]);
    const admin = makeAdmin();
    const report = admin.exportReport(zones4, assignments4, salesAgents);
    expect(report).toMatchObject({
      generatedAt: expect.any(String),
      zones: expect.any(Array),
      assignments: expect.any(Array),
    });
  });

  it('[ADM-5] exportReport gọi version.listHistory để đếm snapshotCount', () => {
    mockVersion.listHistory.mockReturnValue([{ version: 'v1' }, { version: 'v2' }]);
    const admin = makeAdmin();
    const report = admin.exportReport(zones4, assignments4, salesAgents);
    expect(report.snapshotCount).toBe(2);
    expect(mockVersion.listHistory).toHaveBeenCalled();
  });

  it('[ADM-6] configureConstraints merge với config hiện tại', () => {
    const admin = makeAdmin();
    admin.configureConstraints({ balanceThreshold: 2.0 });
    expect(admin.getConstraints().balanceThreshold).toBe(2.0);
    // Các field khác không bị xóa
    expect(admin.getConstraints().adjThresholdKm).toBe(50);
  });

  it('[ADM-7] getSalesManagement trả về sales array + districtMap', () => {
    const admin = makeAdmin();
    const result = admin.getSalesManagement(zones4, assignments4, salesAgents);
    expect(result.sales).toHaveLength(2);
    expect(result.districtMap).toMatchObject({ 0: 'sa0', 1: 'sa1' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CoordinatorFacade — PERMISSION MATRIX
// ══════════════════════════════════════════════════════════════════════════════

describe('CoordinatorFacade permissions', () => {
  function makeCoord() {
    return new CoordinatorFacade(
      mockTerritory as any,
      mockVersion as any,
      mockActivity as any,
    );
  }

  it('[COORD-1] assignZone → gọi territory.manualSwap', async () => {
    mockTerritory.manualSwap.mockResolvedValue({
      ok: true, newAssignments: assignments4,
      newMetrics: {}, violations: [],
    });
    const coord = makeCoord();
    await coord.assignZone('z1', 1, assignments4, zones4);
    expect(mockTerritory.manualSwap)
      .toHaveBeenCalledWith('z1', 1, assignments4, zones4);
  });

  it('[COORD-1b] assignZone trả về AssignResult với ok=true', async () => {
    mockTerritory.manualSwap.mockResolvedValue({
      ok: true, newAssignments: assignments4,
      newMetrics: {}, violations: [],
    });
    const coord = makeCoord();
    const result = await coord.assignZone('z1', 1, assignments4, zones4);
    expect(result.ok).toBe(true);
    expect(result.zoneId).toBe('z1');
    expect(result.newSalesId).toBe('1');
    expect(result.previousSalesId).toBe('0'); // z1 trước thuộc district 0
  });

  it('[COORD-2] getUpdateHistory → gọi version.listHistory', () => {
    mockVersion.listHistory.mockReturnValue([]);
    const coord = makeCoord();
    coord.getUpdateHistory();
    expect(mockVersion.listHistory).toHaveBeenCalled();
  });

  it('[COORD-2b] getUpdateHistory map snapshots → HistoryEntry[]', () => {
    mockVersion.listHistory.mockReturnValue([
      { label: 'sprint-1', version: 'v1', timestamp: '2026-01-01T00:00:00.000Z', zones: [{}, {}] },
    ]);
    const coord = makeCoord();
    const history = coord.getUpdateHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ label: 'sprint-1', version: 'v1', zoneCount: 2 });
  });

  it('[COORD-3] createVersion → throw PermissionError PERMISSION_DENIED', () => {
    const coord = makeCoord();
    expect(() => (coord as any).createVersion?.('label', [], []))
      .toThrow(PermissionError);
  });

  it('[COORD-3b] createVersion PermissionError có code PERMISSION_DENIED', () => {
    const coord = makeCoord();
    try {
      coord.createVersion('label');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionError);
      expect((e as PermissionError).details.code).toBe('PERMISSION_DENIED');
    }
  });

  it('[COORD-4] runAlgorithm → throw PermissionError PERMISSION_DENIED (async)', async () => {
    const coord = makeCoord();
    await expect((coord as any).runAlgorithm?.('local-search', [], 2))
      .rejects.toBeInstanceOf(PermissionError);
  });

  it('[COORD-5] flagForReview lưu flag in-memory', () => {
    const coord = makeCoord();
    coord.flagForReview(0, 'Too large diameter');
    expect(coord.getFlags()).toHaveLength(1);
    expect(coord.getFlags()[0]).toMatchObject({
      districtId: 0,
      reason: 'Too large diameter',
    });
  });

  it('[COORD-6] flagForReview update flag nếu district đã có', () => {
    const coord = makeCoord();
    coord.flagForReview(0, 'reason A');
    coord.flagForReview(0, 'reason B');
    expect(coord.getFlags()).toHaveLength(1); // không thêm duplicate
    expect(coord.getFlags()[0]!.reason).toBe('reason B');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SalesFacade — DATA ISOLATION
// ══════════════════════════════════════════════════════════════════════════════

describe('SalesFacade data isolation', () => {
  function makeSales(salesId: string) {
    mockActivity.getDistrictSummary.mockReturnValue({
      districtId: 0, zoneCount: 2,
      totalCustomers: 200, totalOrders: 100,
      diameter: 15, balanceScore: 80,
    });
    return new SalesFacade(
      salesId,
      mockActivity as any,
      zones4,
      assignments4,
      salesAgents,
    );
  }

  it('[ISO-1] sa0 → _districtId = 0, chỉ thấy z1 và z2', () => {
    const sales = makeSales('sa0');
    const district = sales.getMyDistrict();
    const ids = district.zones.map((z: any) => z.id);
    expect(ids).toContain('z1');
    expect(ids).toContain('z2');
    expect(ids).not.toContain('z3');
    expect(ids).not.toContain('z4');
  });

  it('[ISO-2] sa1 → _districtId = 1, chỉ thấy z3 và z4', () => {
    mockActivity.getDistrictSummary.mockReturnValue({
      districtId: 1, zoneCount: 2,
      totalCustomers: 200, totalOrders: 100,
      diameter: 15, balanceScore: 80,
    });
    const sales = new SalesFacade('sa1', mockActivity as any, zones4, assignments4, salesAgents);
    const district = sales.getMyDistrict();
    const ids = district.zones.map((z: any) => z.id);
    expect(ids).toContain('z3');
    expect(ids).toContain('z4');
    expect(ids).not.toContain('z1');
    expect(ids).not.toContain('z2');
  });

  it('[ISO-3] sa0 và sa1 không thấy zones của nhau', () => {
    const sales0 = makeSales('sa0');
    mockActivity.getDistrictSummary.mockReturnValue({
      districtId: 1, zoneCount: 2,
      totalCustomers: 200, totalOrders: 100,
      diameter: 15, balanceScore: 80,
    });
    const sales1 = new SalesFacade('sa1', mockActivity as any, zones4, assignments4, salesAgents);

    const ids0 = sales0.getMyDistrict().zones.map((z: any) => z.id);
    const ids1 = sales1.getMyDistrict().zones.map((z: any) => z.id);

    const overlap = ids0.filter((id: string) => ids1.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it('[ISO-4] salesId không tồn tại → throw NOT_AUTHENTICATED', () => {
    expect(() => makeSales('unknown-id'))
      .toThrow(
        expect.objectContaining({
          details: { code: 'NOT_AUTHENTICATED', role: 'sales', method: 'constructor', message: expect.any(String) },
        }),
      );
  });

  it('[ISO-5] getMyDistrict gọi activitySvc với _districtId đúng', () => {
    mockActivity.getDistrictSummary.mockReturnValue({
      districtId: 1, zoneCount: 2,
      totalCustomers: 200, totalOrders: 100,
      diameter: 15, balanceScore: 80,
    });
    const sales = new SalesFacade('sa1', mockActivity as any, zones4, assignments4, salesAgents);
    sales.getMyDistrict();
    expect(mockActivity.getDistrictSummary)
      .toHaveBeenCalledWith(1, zones4, assignments4);
    expect(mockActivity.getDistrictSummary)
      .not.toHaveBeenCalledWith(0, expect.anything(), expect.anything());
  });

  it('[ISO-6] _districtId = findIndex risk: salesAgents đổi thứ tự → sai — document known fragility', () => {
    const reorderedAgents = [salesAgents[1]!, salesAgents[0]!];

    const salesWithOriginal = makeSales('sa0');    // _districtId = 0
    mockActivity.getDistrictSummary.mockReturnValue({
      districtId: 1, zoneCount: 2,
      totalCustomers: 200, totalOrders: 100,
      diameter: 15, balanceScore: 80,
    });
    const salesWithReordered = new SalesFacade(
      'sa0', mockActivity as any,
      zones4, assignments4, reorderedAgents,  // sa0 ở index 1 → _districtId = 1
    );

    const d0 = salesWithOriginal.getMyDistrict().zones.map((z: any) => z.id);
    const d1 = salesWithReordered.getMyDistrict().zones.map((z: any) => z.id);
    // Cùng salesId nhưng khác array → khác district (known fragility)
    expect(d0).not.toEqual(d1);
  });

  it('[ISO-7] getMyCustomers chỉ trả customers của district mình', () => {
    const sales = makeSales('sa0');
    const customers = sales.getMyCustomers();
    customers.forEach((c: any) => {
      expect(['z1', 'z2']).toContain(c.zoneId);
    });
  });

  it('[ISO-8] SalesFacade không có method runAlgorithm, createVersion, assignZone', () => {
    const sales = makeSales('sa0');
    expect((sales as any).runAlgorithm).toBeUndefined();
    expect((sales as any).createVersion).toBeUndefined();
    expect((sales as any).assignZone).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PERMISSION MATRIX — cross-role
// ══════════════════════════════════════════════════════════════════════════════

describe('Permission matrix cross-role', () => {
  it('[PERM-1] SalesFacade không có createVersion (undefined, không phải function)', () => {
    mockActivity.getDistrictSummary.mockReturnValue({
      districtId: 0, zoneCount: 2, totalCustomers: 0, totalOrders: 0,
      diameter: 0, balanceScore: 0,
    });
    const sales = new SalesFacade(
      'sa0', mockActivity as any,
      zones4, assignments4, salesAgents,
    );
    expect(typeof (sales as any).createVersion).not.toBe('function');
  });

  it('[PERM-2] SalesFacade không có runAlgorithm (undefined, không phải function)', () => {
    mockActivity.getDistrictSummary.mockReturnValue({
      districtId: 0, zoneCount: 2, totalCustomers: 0, totalOrders: 0,
      diameter: 0, balanceScore: 0,
    });
    const sales = new SalesFacade(
      'sa0', mockActivity as any,
      zones4, assignments4, salesAgents,
    );
    expect(typeof (sales as any).runAlgorithm).not.toBe('function');
  });

  it('[PERM-3] CoordinatorFacade không có exportReport', () => {
    const coord = new CoordinatorFacade(
      mockTerritory as any,
      mockVersion as any,
      mockActivity as any,
    );
    expect(typeof (coord as any).exportReport).not.toBe('function');
  });

  it('[PERM-4] PermissionError là instance riêng, không phải Error thường', () => {
    const coord = new CoordinatorFacade(
      mockTerritory as any,
      mockVersion as any,
      mockActivity as any,
    );
    try {
      coord.createVersion('x');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionError);
      expect(e).toBeInstanceOf(Error); // kế thừa Error
      expect((e as PermissionError).details.role).toBe('coordinator');
      expect((e as PermissionError).details.method).toBe('createVersion');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BUG-FIX — getTeamOverview salesAgentId lookup (modulo bug)
// ══════════════════════════════════════════════════════════════════════════════

describe('CoordinatorFacade getTeamOverview — salesAgentId lookup (BUG-FIX)', () => {
  const zones4WithActivities = [
    {
      id: 'z1', status: 'unassigned' as const,
      name: 'Zone 1', polygon: { type: 'Polygon' as const, coordinates: [] },
      centroid: { lat: 21.0, lng: 105.8 },
      activities: [{ id: 'a1', type: 'CUSTOMER' as const, value: 10 }],
    },
    {
      id: 'z2', status: 'unassigned' as const,
      name: 'Zone 2', polygon: { type: 'Polygon' as const, coordinates: [] },
      centroid: { lat: 21.1, lng: 105.8 },
      activities: [{ id: 'a2', type: 'CUSTOMER' as const, value: 20 }],
    },
    {
      id: 'z3', status: 'unassigned' as const,
      name: 'Zone 3', polygon: { type: 'Polygon' as const, coordinates: [] },
      centroid: { lat: 21.0, lng: 105.9 },
      activities: [{ id: 'a3', type: 'CUSTOMER' as const, value: 30 }],
    },
    {
      id: 'z4', status: 'unassigned' as const,
      name: 'Zone 4', polygon: { type: 'Polygon' as const, coordinates: [] },
      centroid: { lat: 21.1, lng: 105.9 },
      activities: [{ id: 'a4', type: 'CUSTOMER' as const, value: 40 }],
    },
  ] as any[];

  const twoAgents = [
    { id: 'sa0', name: 'Agent A', activeRegion: 'North', capacity: 100 },
    { id: 'sa1', name: 'Agent B', activeRegion: 'South', capacity: 100 },
  ] as any[];

  it('[BUG-FIX] getTeamOverview không gán nhầm khi 4 districts, 2 salesAgents', () => {
    // 4 districts: D0/D2 → sa0, D1/D3 → sa1
    const assignments = [
      { zoneId: 'z1', districtId: 0, salesAgentId: 'sa0' },
      { zoneId: 'z2', districtId: 1, salesAgentId: 'sa1' },
      { zoneId: 'z3', districtId: 2, salesAgentId: 'sa0' }, // sa0 quản lý D2 thêm
      { zoneId: 'z4', districtId: 3, salesAgentId: 'sa1' }, // sa1 quản lý D3 thêm
    ];

    const coord = new CoordinatorFacade(
      mockTerritory as any,
      mockVersion as any,
      mockActivity as any,
    );
    const overview = coord.getTeamOverview(zones4WithActivities, assignments, twoAgents);

    // sa0 quản lý z1 (D0) và z3 (D2) — 2 zones
    const sa0 = overview.sales.find((s) => s.salesId === 'sa0');
    expect(sa0?.assignedZones).toHaveLength(2);
    expect(sa0?.assignedZones.map((z) => z.zoneId)).toContain('z1');
    expect(sa0?.assignedZones.map((z) => z.zoneId)).toContain('z3');

    // sa1 quản lý z2 (D1) và z4 (D3) — 2 zones
    const sa1 = overview.sales.find((s) => s.salesId === 'sa1');
    expect(sa1?.assignedZones).toHaveLength(2);
    expect(sa1?.assignedZones.map((z) => z.zoneId)).toContain('z2');
    expect(sa1?.assignedZones.map((z) => z.zoneId)).toContain('z4');

    // Không có double-count: tổng = 10+20+30+40 = 100
    expect(overview.totalKH).toBe(100);
  });

  it('[BUG-FIX-2] zones không có salesAgentId → bị skip, không crash', () => {
    const assignments = [
      { zoneId: 'z1', districtId: 0 }, // không có salesAgentId
      { zoneId: 'z2', districtId: 1, salesAgentId: 'sa1' },
    ];

    const coord = new CoordinatorFacade(
      mockTerritory as any,
      mockVersion as any,
      mockActivity as any,
    );
    const overview = coord.getTeamOverview(zones4WithActivities, assignments, twoAgents);

    // sa0 không nhận được zone nào vì z1 không có salesAgentId
    const sa0 = overview.sales.find((s) => s.salesId === 'sa0');
    expect(sa0?.assignedZones).toHaveLength(0);

    // sa1 nhận z2 đúng
    const sa1 = overview.sales.find((s) => s.salesId === 'sa1');
    expect(sa1?.assignedZones).toHaveLength(1);
    expect(sa1?.assignedZones[0]!.zoneId).toBe('z2');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SalesFacade — extended tests
// ══════════════════════════════════════════════════════════════════════════════

describe('SalesFacade extended', () => {
  // Helper tạo SalesFacade với district rỗng (không có zone nào được gán)
  function makeSalesNoZones(salesId: string) {
    // assignments hoàn toàn trống → district nào cũng không có zone
    return new SalesFacade(
      salesId,
      mockActivity as any,
      zones4,
      [],          // không có assignment nào
      salesAgents,
    );
  }

  // Helper tạo SalesFacade với zones có ORDER và CUSTOMER activities
  function makeSalesWithActivities(salesId: string) {
    const zonesWithActs = [
      {
        id: 'z1', status: 'unassigned' as const,
        name: 'Zone 1',
        polygon: { type: 'Polygon' as const, coordinates: [] },
        centroid: { lat: 21.0, lng: 105.8 },
        activities: [
          { id: 'a1', type: 'ORDER' as const, value: 40 },
          { id: 'a2', type: 'CUSTOMER' as const, value: 5,
            location: { lat: 21.01, lng: 105.81 } },
        ],
      },
      {
        id: 'z2', status: 'unassigned' as const,
        name: 'Zone 2',
        polygon: { type: 'Polygon' as const, coordinates: [] },
        centroid: { lat: 21.1, lng: 105.8 },
        activities: [
          { id: 'a3', type: 'ORDER' as const, value: 60 },
        ],
      },
    ] as any[];
    return new SalesFacade(
      salesId,
      mockActivity as any,
      zonesWithActs,
      assignments4,
      salesAgents,
    );
  }

  it('[SAL-DISTRICT-1] getMyDistrict() khi không có zones → throw DISTRICT_NOT_FOUND', () => {
    const sales = makeSalesNoZones('sa0');
    expect(() => sales.getMyDistrict()).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({ code: 'DISTRICT_NOT_FOUND' }),
      }),
    );
  });

  it('[SAL-FORECAST-1] getMyOrderForecast() trả đúng structure', () => {
    const sales = makeSalesWithActivities('sa0');
    const forecast = sales.getMyOrderForecast();
    expect(forecast).toMatchObject({
      districtId: expect.any(Number),
      currentOrders: expect.any(Number),
      forecastedOrders: expect.any(Number),
      forecastedAt: expect.any(String),
    });
    // forecastedAt phải là ISO string hợp lệ
    expect(new Date(forecast.forecastedAt).getTime()).toBeGreaterThan(0);
  });

  it('[SAL-FORECAST-2] forecastedOrders = round(currentOrders * 1.05)', () => {
    const sales = makeSalesWithActivities('sa0');
    const forecast = sales.getMyOrderForecast();
    // z1 (districtId=0, sa0): ORDER 40; z2 (districtId=0, sa0): ORDER 60 → total=100
    expect(forecast.currentOrders).toBe(100);
    expect(forecast.forecastedOrders).toBe(Math.round(100 * 1.05)); // 105
  });

  it('[SAL-CUSTOMER-1] getMyCustomers() với activity có location → location field xuất hiện', () => {
    const sales = makeSalesWithActivities('sa0');
    const customers = sales.getMyCustomers();
    // z1 có CUSTOMER activity với location
    const z1Customer = customers.find((c: any) => c.zoneId === 'z1');
    expect(z1Customer).toBeDefined();
    expect(z1Customer?.location).toMatchObject({
      lat: expect.any(Number),
      lng: expect.any(Number),
    });
    // z2 không có CUSTOMER activity có location → location undefined
    const z2Customer = customers.find((c: any) => c.zoneId === 'z2');
    expect(z2Customer?.location).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Error classes — fallback message tests
// ══════════════════════════════════════════════════════════════════════════════

describe('ServiceError and VersionError — fallback message', () => {
  it('[ERR-1] ServiceError dùng code khi không có message → e.message === code', () => {
    const e = new ServiceError({ code: 'INVALID_INPUT' });
    expect(e.message).toBe('INVALID_INPUT');
    expect(e.details.code).toBe('INVALID_INPUT');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ServiceError');
  });

  it('[ERR-2] VersionError dùng code khi không có message → e.message === code', () => {
    const e = new VersionError({ code: 'DUPLICATE_LABEL' });
    expect(e.message).toBe('DUPLICATE_LABEL');
    expect(e.details.code).toBe('DUPLICATE_LABEL');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('VersionError');
  });
});
