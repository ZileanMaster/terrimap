/**
 * tests/l2-territory.test.ts
 *
 * Unit tests cho TerritoryService (L2).
 * Strategy: vi.mock() toàn bộ L1. Không mock services/errors.ts.
 *
 * Note về PartitionError:
 *  PartitionError phải nằm trong mock factory để instanceof check trong
 *  TerritoryService hoạt động đúng (cùng class reference qua mocked module).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock toàn bộ L1 ─────────────────────────────────────────────────────────
// PartitionError được include trong factory — TerritoryService dùng instanceof.
vi.mock('../lib/partition', () => {
  class PartitionError extends Error {
    readonly code: string;
    constructor(message: string, code: string = 'UNKNOWN') {
      super(message);
      this.name = 'PartitionError';
      this.code = code;
    }
  }
  return {
    getPartitionFn: vi.fn(),
    PartitionError,
  };
});

vi.mock('../lib/validator', () => ({
  validatePartition: vi.fn(),
  suggestFix: vi.fn(),
}));

vi.mock('../lib/geometry', () => ({
  buildAdjacencyMatrix: vi.fn(),
  buildDistanceMatrix: vi.fn(),
  zoneDiameter: vi.fn(),
  polygonCentroid: vi.fn(),
}));

// ─── Imports (sau mock) ───────────────────────────────────────────────────────
import { getPartitionFn, PartitionError } from '../lib/partition';
import { validatePartition, suggestFix } from '../lib/validator';
import { TerritoryService, ServiceError } from '../services/index.js';
import type { PartitionResult, SwapResult } from '../services/TerritoryService.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 4 zones tối thiểu — L1 đã mock nên không cần full Zone structure. */
const zones4 = [
  { id: 'z1', centroid: { lat: 21.0, lng: 105.8 } },
  { id: 'z2', centroid: { lat: 21.1, lng: 105.8 } },
  { id: 'z3', centroid: { lat: 21.0, lng: 105.9 } },
  { id: 'z4', centroid: { lat: 21.1, lng: 105.9 } },
] as any;

const validAssignments = [
  { zoneId: 'z1', districtId: 0 },
  { zoneId: 'z2', districtId: 1 },
  { zoneId: 'z3', districtId: 0 },
  { zoneId: 'z4', districtId: 1 },
];

const validMetrics = {
  balanceScore: 75,
  maxDiameter: 30,
  countsPerDistrict: [100, 100],
};

const validValidation = {
  valid: true,
  violations: [] as any[],
  metrics: validMetrics,
};

const mockPartitionFn = vi.fn().mockReturnValue(validAssignments);

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPartitionFn).mockReturnValue(mockPartitionFn as any);
  vi.mocked(validatePartition).mockReturnValue(validValidation as any);
  vi.mocked(suggestFix).mockReturnValue([]);
});

// ══════════════════════════════════════════════════════════════════════════════
// TerritoryService.runPartition()
// ══════════════════════════════════════════════════════════════════════════════

describe('TerritoryService.runPartition', () => {

  it('[RP-1] gọi getPartitionFn với đúng algo', async () => {
    const svc = new TerritoryService();
    await svc.runPartition(zones4, 2, 'local-search');
    expect(getPartitionFn).toHaveBeenCalledWith('local-search');
    expect(getPartitionFn).toHaveBeenCalledTimes(1);
  });

  it('[RP-2] gọi mockPartitionFn với zones và m, kèm onProgress', async () => {
    const svc = new TerritoryService();
    await svc.runPartition(zones4, 2, 'greedy');
    expect(mockPartitionFn).toHaveBeenCalledWith(
      zones4,
      2,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
  });

  it('[RP-3] gọi validatePartition SAU partition (thứ tự đúng)', async () => {
    const svc = new TerritoryService();
    const callOrder: string[] = [];
    mockPartitionFn.mockImplementation(() => {
      callOrder.push('partition');
      return validAssignments;
    });
    vi.mocked(validatePartition).mockImplementation(() => {
      callOrder.push('validate');
      return validValidation as any;
    });
    await svc.runPartition(zones4, 2, 'local-search');
    expect(callOrder).toEqual(['partition', 'validate']);
  });

  it('[RP-4] trả về PartitionResult đầy đủ fields', async () => {
    const svc = new TerritoryService();
    const result = await svc.runPartition(zones4, 2, 'local-search');
    expect(result).toMatchObject({
      assignments: validAssignments,
      metrics: validMetrics,
      violations: [],
      algo: 'local-search',
      durationMs: expect.any(Number),
      suggestSA: expect.any(Boolean),
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('[RP-5] suggestSA = true khi balanceScore < 60 và algo !== sa', async () => {
    vi.mocked(validatePartition).mockReturnValue({
      ...validValidation,
      metrics: { ...validMetrics, balanceScore: 45 },
    } as any);
    const svc = new TerritoryService();
    const result = await svc.runPartition(zones4, 2, 'local-search');
    expect(result.suggestSA).toBe(true);
  });

  it('[RP-6] suggestSA = false khi algo === sa (kể cả balanceScore thấp)', async () => {
    vi.mocked(validatePartition).mockReturnValue({
      ...validValidation,
      metrics: { ...validMetrics, balanceScore: 30 },
    } as any);
    const svc = new TerritoryService();
    const result = await svc.runPartition(zones4, 2, 'sa');
    expect(result.suggestSA).toBe(false);
  });

  it('[RP-7] m < 2 → ServiceError INVALID_INPUT, không gọi partition', async () => {
    const svc = new TerritoryService();
    await expect(svc.runPartition(zones4, 1, 'local-search'))
      .rejects.toMatchObject({ details: { code: 'INVALID_INPUT' } });
    expect(mockPartitionFn).not.toHaveBeenCalled();
  });

  it('[RP-8] zones rỗng → ServiceError INVALID_INPUT', async () => {
    const svc = new TerritoryService();
    await expect(svc.runPartition([], 2, 'local-search'))
      .rejects.toMatchObject({ details: { code: 'INVALID_INPUT' } });
  });

  it('[RP-9] PartitionError từ L1 → wrap thành PARTITION_FAILED, validatePartition không gọi', async () => {
    // PartitionError từ cùng mock factory → instanceof check hoạt động đúng
    mockPartitionFn.mockImplementation(() => {
      throw new (PartitionError as any)('zones too large', 'M_TOO_LARGE');
    });
    const svc = new TerritoryService();
    await expect(svc.runPartition(zones4, 2, 'local-search'))
      .rejects.toMatchObject({ details: { code: 'PARTITION_FAILED' } });
    expect(validatePartition).not.toHaveBeenCalled();
  });

  it('[RP-10] validatePartition throw → wrap thành VALIDATION_FAILED', async () => {
    // Đảm bảo partition fn thành công (không ảnh hưởng từ RP-9)
    mockPartitionFn.mockReturnValue(validAssignments);
    vi.mocked(validatePartition).mockImplementation(() => {
      throw new Error('unexpected internal error');
    });
    const svc = new TerritoryService();
    await expect(svc.runPartition(zones4, 2, 'local-search'))
      .rejects.toMatchObject({ details: { code: 'VALIDATION_FAILED' } });
  });

  it('[RP-11] emit partition:progress cho mỗi iter từ onProgress callback', async () => {
    mockPartitionFn.mockImplementation((_z: any, _m: any, opts: any) => {
      opts?.onProgress?.(1, 42.5);
      opts?.onProgress?.(2, 38.1);
      return validAssignments;
    });
    const svc = new TerritoryService();
    const progressEvents: any[] = [];
    svc.on('partition:progress', (payload) => progressEvents.push(payload));
    await svc.runPartition(zones4, 2, 'sa');
    expect(progressEvents).toHaveLength(2);
    expect(progressEvents[0]).toEqual({ iter: 1, cost: 42.5 });
    expect(progressEvents[1]).toEqual({ iter: 2, cost: 38.1 });
  });

  it('[RP-12] emit partition:complete với same reference của PartitionResult', async () => {
    const svc = new TerritoryService();
    let emitted: PartitionResult | null = null;
    svc.on('partition:complete', (payload) => { emitted = payload; });
    const result = await svc.runPartition(zones4, 2, 'local-search');
    expect(emitted).toBe(result); // same object reference
  });

  it('[RP-13] KHÔNG emit partition:complete nếu operation throw', async () => {
    // Non-PartitionError → re-thrown trực tiếp, không emit
    mockPartitionFn.mockImplementation(() => { throw new Error('fail'); });
    const svc = new TerritoryService();
    const events: any[] = [];
    svc.on('partition:complete', (p) => events.push(p));
    await expect(svc.runPartition(zones4, 2, 'local-search')).rejects.toThrow();
    expect(events).toHaveLength(0);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// TerritoryService.manualSwap()
// ══════════════════════════════════════════════════════════════════════════════

describe('TerritoryService.manualSwap', () => {

  it('[MS-1] zoneId không tồn tại → ZONE_NOT_FOUND', async () => {
    const svc = new TerritoryService();
    await expect(
      svc.manualSwap('nonexistent', 1, validAssignments, zones4),
    ).rejects.toMatchObject({ details: { code: 'ZONE_NOT_FOUND' } });
  });

  it('[MS-2] fromDistrict === toDistrict → SAME_DISTRICT (z1 đang ở D0)', async () => {
    const svc = new TerritoryService();
    await expect(
      svc.manualSwap('z1', 0, validAssignments, zones4), // z1 đang ở D0 → toDistrict=0 same
    ).rejects.toMatchObject({ details: { code: 'SAME_DISTRICT' } });
  });

  it('[MS-3] swap hợp lệ → trả SwapResult với ok: true', async () => {
    const svc = new TerritoryService();
    const result: SwapResult = await svc.manualSwap('z1', 1, validAssignments, zones4);
    expect(result.ok).toBe(true);
    expect(result.newAssignments).toHaveLength(4);
    expect(result.newMetrics).toBeDefined();
  });

  it('[MS-4] swap hợp lệ → z1 bây giờ ở district 1 trong newAssignments', async () => {
    const svc = new TerritoryService();
    const result = await svc.manualSwap('z1', 1, validAssignments, zones4);
    const z1 = result.newAssignments.find((a) => a.zoneId === 'z1');
    expect(z1?.districtId).toBe(1);
  });

  it('[MS-5] swap tạo DISCONNECTED ở fromDistrict → SWAP_DISCONNECTS với districtId', async () => {
    vi.mocked(validatePartition).mockReturnValue({
      valid: false,
      violations: [{ type: 'DISCONNECTED', districtId: 0 }], // fromDistrict của z1 = 0
      metrics: validMetrics,
    } as any);
    const svc = new TerritoryService();
    await expect(
      svc.manualSwap('z1', 1, validAssignments, zones4),
    ).rejects.toMatchObject({
      details: { code: 'SWAP_DISCONNECTS', districtId: 0 },
    });
  });

  it('[MS-6] emit zone:swapped SAU swap thành công', async () => {
    const svc = new TerritoryService();
    let emitted: any = null;
    svc.on('zone:swapped', (p) => { emitted = p; });
    await svc.manualSwap('z1', 1, validAssignments, zones4);
    expect(emitted).toEqual({ zoneId: 'z1', fromDistrict: 0, toDistrict: 1 });
  });

  it('[MS-7] KHÔNG emit zone:swapped nếu swap throw (SWAP_DISCONNECTS)', async () => {
    vi.mocked(validatePartition).mockReturnValue({
      valid: false,
      violations: [{ type: 'DISCONNECTED', districtId: 0 }],
      metrics: validMetrics,
    } as any);
    const svc = new TerritoryService();
    const events: any[] = [];
    svc.on('zone:swapped', (p) => events.push(p));
    await expect(
      svc.manualSwap('z1', 1, validAssignments, zones4),
    ).rejects.toThrow();
    expect(events).toHaveLength(0);
  });

  it('[MS-8] validatePartition được gọi với newAssignments (z1 đã đổi sang D1)', async () => {
    const svc = new TerritoryService();
    await svc.manualSwap('z1', 1, validAssignments, zones4);
    const calledWith = vi.mocked(validatePartition).mock.calls[0]!;
    const assignmentsArg = calledWith[1] as typeof validAssignments;
    const z1InCall = assignmentsArg.find((a) => a.zoneId === 'z1');
    expect(z1InCall?.districtId).toBe(1); // bị đổi sang D1, không phải D0 cũ
  });

  it('[MS-9] currentAssignments không bị mutate sau swap', async () => {
    const svc = new TerritoryService();
    const original = validAssignments.map((a) => ({ ...a })); // snapshot
    await svc.manualSwap('z1', 1, validAssignments, zones4);
    expect(validAssignments).toEqual(original); // immutable
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// TerritoryService.getSuggestions()
// ══════════════════════════════════════════════════════════════════════════════

describe('TerritoryService.getSuggestions', () => {

  it('[GS-1] gọi suggestFix với adjThresholdKm: 50', () => {
    const svc = new TerritoryService();
    svc.getSuggestions(zones4, validAssignments);
    expect(suggestFix).toHaveBeenCalledWith(
      zones4,
      validAssignments,
      expect.objectContaining({ adjThresholdKm: 50 }),
    );
  });

  it('[GS-2] trả về kết quả đã sort ascending theo deltaBalance', () => {
    const mockSuggestions = [
      { zoneId: 'z1', fromDistrict: 0, toDistrict: 1, deltaBalance: -1.0 },
      { zoneId: 'z3', fromDistrict: 0, toDistrict: 1, deltaBalance: -3.0 },
      { zoneId: 'z2', fromDistrict: 1, toDistrict: 0, deltaBalance: -2.0 },
    ];
    vi.mocked(suggestFix).mockReturnValue(mockSuggestions as any);
    const svc = new TerritoryService();
    const result = svc.getSuggestions(zones4, validAssignments);
    // Sorted: -3.0, -2.0, -1.0
    expect(result[0]!.deltaBalance).toBe(-3.0);
    expect(result[1]!.deltaBalance).toBe(-2.0);
    expect(result[2]!.deltaBalance).toBe(-1.0);
  });

  it('[GS-3] trả về [] khi suggestFix trả về []', () => {
    vi.mocked(suggestFix).mockReturnValue([]);
    const svc = new TerritoryService();
    expect(svc.getSuggestions(zones4, validAssignments)).toHaveLength(0);
  });

});
