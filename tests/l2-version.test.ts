/**
 * tests/l2-version.test.ts
 *
 * Unit tests cho VersionService (L2).
 * VersionService KHÔNG gọi L1 → không cần mock L1.
 */

import { describe, it, expect } from 'vitest';
import { VersionService, VersionError } from '../services/index.js';

// ─── Zone helper ──────────────────────────────────────────────────────────────
// Dùng Activity[] format chuẩn L0 để _totalCustomers() không throw

function makeZone(id: string, customers = 100) {
  return {
    id,
    activities: customers > 0
      ? [{ id: `act-${id}`, type: 'CUSTOMER', value: customers }]
      : [],
    centroid: { lat: 21.0, lng: 105.8 },
    status: 'unassigned',
  } as any;
}


function makeAssignment(zoneId: string, districtId: number) {
  return { zoneId, districtId };
}

// ══════════════════════════════════════════════════════════════════════════════
// VersionService
// ══════════════════════════════════════════════════════════════════════════════

describe('VersionService', () => {

  it('[VS-1] createSnapshot deep copy — mutate input sau khi snapshot không ảnh hưởng', () => {
    const svc = new VersionService();
    const zones = [makeZone('z1', 100)];
    const assignments = [makeAssignment('z1', 0)];

    const snap = svc.createSnapshot('v1', zones as any, assignments);

    // Mutate original sau khi snapshot
    (zones[0] as any).activities[0].value = 999;  // mutate activity value
    assignments[0]!.districtId = 5;

    // Snapshot không bị ảnh hưởng (deep copy)
    expect((snap.zones[0] as any).activities[0].value).toBe(100);
    expect(snap.assignments[0]!.districtId).toBe(0);
  });

  it('[VS-2] label trùng → VersionError DUPLICATE_LABEL', () => {
    const svc = new VersionService();
    svc.createSnapshot('same-label', [], []);
    expect(() => svc.createSnapshot('same-label', [], []))
      .toThrow(expect.objectContaining({
        details: { code: 'DUPLICATE_LABEL', message: expect.any(String) },
      }));
  });

  it('[VS-2b] VersionError có details.code === DUPLICATE_LABEL', () => {
    const svc = new VersionService();
    svc.createSnapshot('dup', [], []);
    try {
      svc.createSnapshot('dup', [], []);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(VersionError);
      expect((e as VersionError).details.code).toBe('DUPLICATE_LABEL');
    }
  });

  it('[VS-3] version number tự tăng từ v1', () => {
    const svc = new VersionService();
    const s1 = svc.createSnapshot('a', [], []);
    const s2 = svc.createSnapshot('b', [], []);
    const s3 = svc.createSnapshot('c', [], []);
    expect(s1.version).toBe('v1');
    expect(s2.version).toBe('v2');
    expect(s3.version).toBe('v3');
  });

  it('[VS-4] emit snapshot:created SAU khi tạo — same reference', () => {
    const svc = new VersionService();
    let emitted: any = null;
    svc.on('snapshot:created', (p) => { emitted = p; });
    const snap = svc.createSnapshot('test', [], []);
    expect(emitted).toBe(snap); // same reference
  });

  it('[VS-5] hơn 50 snapshots → chỉ giữ 50 mới nhất', () => {
    const svc = new VersionService();
    for (let i = 0; i < 55; i++) {
      svc.createSnapshot(`label-${i}`, [], []);
    }
    const history = svc.listHistory();
    expect(history).toHaveLength(50);
  });

  it('[VS-5b] sau 55 snapshots → snapshot cũ nhất (label-0) bị xóa', () => {
    const svc = new VersionService();
    for (let i = 0; i < 55; i++) {
      svc.createSnapshot(`label-${i}`, [], []);
    }
    expect(svc.getSnapshot('label-0')).toBeUndefined();
    expect(svc.getSnapshot('label-4')).toBeUndefined();   // 0-4 bị xóa
    expect(svc.getSnapshot('label-5')).toBeDefined();     // 5-54 còn lại
  });

  it('[VS-6] diffSnapshots: same assignments → tất cả arrays rỗng, customerDelta = 0', () => {
    const svc = new VersionService();
    const zones = [makeZone('z1', 100)] as any;
    const assignments = [makeAssignment('z1', 0)];
    const s1 = svc.createSnapshot('s1', zones, assignments);
    const s2 = svc.createSnapshot('s2', zones, assignments);

    const diff = svc.diffSnapshots(s1, s2);
    expect(diff.changed).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.metrics.customerDelta).toBe(0);
  });

  it('[VS-7] diffSnapshots: zone đổi district → nằm trong changed', () => {
    const svc = new VersionService();
    const zones = [makeZone('z1'), makeZone('z2')] as any;
    const a1 = [makeAssignment('z1', 0), makeAssignment('z2', 1)];
    const a2 = [makeAssignment('z1', 1), makeAssignment('z2', 1)]; // z1 đổi sang D1

    const s1 = svc.createSnapshot('s1', zones, a1);
    const s2 = svc.createSnapshot('s2', zones, a2);

    const diff = svc.diffSnapshots(s1, s2);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toEqual({ zoneId: 'z1', from: 0, to: 1 });
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('[VS-8] diffSnapshots: zone mới trong v2 → trong added', () => {
    const svc = new VersionService();
    const zones1 = [makeZone('z1')] as any;
    const zones2 = [makeZone('z1'), makeZone('z2')] as any;
    const a1 = [makeAssignment('z1', 0)];
    const a2 = [makeAssignment('z1', 0), makeAssignment('z2', 1)];

    const s1 = svc.createSnapshot('s1', zones1, a1);
    const s2 = svc.createSnapshot('s2', zones2, a2);

    const diff = svc.diffSnapshots(s1, s2);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]).toEqual({ zoneId: 'z2', districtId: 1 });
    expect(diff.changed).toHaveLength(0);
  });

  it('[VS-9] diffSnapshots: zone bị xóa trong v2 → trong removed', () => {
    const svc = new VersionService();
    const zones1 = [makeZone('z1'), makeZone('z2')] as any;
    const zones2 = [makeZone('z1')] as any;
    const a1 = [makeAssignment('z1', 0), makeAssignment('z2', 1)];
    const a2 = [makeAssignment('z1', 0)];

    const s1 = svc.createSnapshot('s1', zones1, a1);
    const s2 = svc.createSnapshot('s2', zones2, a2);

    const diff = svc.diffSnapshots(s1, s2);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toEqual({ zoneId: 'z2', districtId: 1 });
    expect(diff.added).toHaveLength(0);
  });

  it('[VS-10] listHistory mới nhất trước', () => {
    const svc = new VersionService();
    svc.createSnapshot('first', [], []);
    svc.createSnapshot('second', [], []);
    svc.createSnapshot('third', [], []);
    const history = svc.listHistory();
    expect(history[0]!.label).toBe('third');
    expect(history[1]!.label).toBe('second');
    expect(history[2]!.label).toBe('first');
  });

  it('[VS-11] listHistory filter week → chỉ trả snapshots trong 7 ngày', () => {
    const svc = new VersionService();
    svc.createSnapshot('recent', [], []);
    const history = svc.listHistory({ period: 'week' });
    expect(history).toHaveLength(1);
    expect(history[0]!.label).toBe('recent');
  });

  it('[VS-12] listHistory filter month → chỉ trả snapshots trong 30 ngày', () => {
    const svc = new VersionService();
    svc.createSnapshot('this-month', [], []);
    svc.createSnapshot('also-this-month', [], []);
    const history = svc.listHistory({ period: 'month' });
    expect(history).toHaveLength(2);
  });

  it('[VS-13] getSnapshot tìm theo label — not found trả undefined', () => {
    const svc = new VersionService();
    svc.createSnapshot('exists', [], []);
    expect(svc.getSnapshot('exists')).toBeDefined();
    expect(svc.getSnapshot('no-such-label')).toBeUndefined();
  });

  it('[VS-14] snapshot.timestamp là ISO 8601 hợp lệ', () => {
    const svc = new VersionService();
    const snap = svc.createSnapshot('ts-test', [], []);
    expect(() => new Date(snap.timestamp)).not.toThrow();
    expect(new Date(snap.timestamp).toISOString()).toBe(snap.timestamp);
  });

});
