/**
 * services/VersionService.ts — L2 Domain Service
 *
 * Quản lý snapshot history của Territory partitions.
 * Import từ types/domain.ts, lib/partition.ts.
 * Extends EventEmitter — không import UI framework.
 *
 * Events:
 *  'snapshot:created'  Snapshot
 */

import type { Zone } from '../types/domain.js';
import type { Assignment } from '../lib/partition.js';
import { VersionError } from './errors.js';

// ── Tiny browser-compatible EventEmitter ────────────────────────────────────
class EventEmitter {
  private _listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  on(event: string, fn: (...args: unknown[]) => void): this {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(fn); return this;
  }
  off(event: string, fn: (...args: unknown[]) => void): this {
    this._listeners.get(event)?.delete(fn); return this;
  }
  emit(event: string, ...args: unknown[]): boolean {
    const s = this._listeners.get(event);
    if (!s?.size) return false;
    s.forEach((f) => f(...args)); return true;
  }
}



// ─── Types ────────────────────────────────────────────────────────────────────

/** Một snapshot bất biến của territory partition tại một thời điểm. */
export interface Snapshot {
  label: string;
  version: string;        // 'v1', 'v2', ...
  timestamp: string;      // ISO 8601
  zones: Zone[];          // deep copy
  assignments: Assignment[]; // deep copy
}

/** Kết quả so sánh 2 snapshots. */
export interface SnapshotDiff {
  /** Zone bị chuyển district. */
  changed: Array<{ zoneId: string; from: number; to: number }>;
  /** Zone có trong v2 nhưng không có trong v1. */
  added: Array<{ zoneId: string; districtId: number }>;
  /** Zone có trong v1 nhưng không có trong v2. */
  removed: Array<{ zoneId: string; districtId: number }>;
  metrics: {
    /** Tổng customers v2 - v1. */
    customerDelta: number;
    /** Số zones v2 - v1. */
    zoneDelta: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tổng customers của một zone. @internal */
function _totalCustomers(zone: Zone): number {
  return zone.activities
    .filter((a) => a.type === 'CUSTOMER')
    .reduce((s, a) => s + a.value, 0);
}

// ─── VersionService ───────────────────────────────────────────────────────────

const MAX_SNAPSHOTS = 50;

export class VersionService extends EventEmitter {
  private _snapshots: Snapshot[] = [];

  /**
   * Tạo snapshot mới từ zones + assignments hiện tại.
   *
   * Contracts:
   *  - Label trùng → throw VersionError DUPLICATE_LABEL.
   *  - Deep copy zones + assignments (không giữ reference).
   *  - snapshots.length > 50 → xóa snapshot cũ nhất.
   *  - Emit 'snapshot:created' SAU khi thêm vào list.
   *
   * @throws {VersionError} DUPLICATE_LABEL
   */
  createSnapshot(label: string, zones: Zone[], assignments: Assignment[]): Snapshot {
    // Kiểm tra trùng label
    if (this._snapshots.some((s) => s.label === label)) {
      throw new VersionError({
        code: 'DUPLICATE_LABEL',
        message: `Snapshot label "${label}" already exists.`,
      });
    }

    const snapshot: Snapshot = {
      label,
      version: `v${this._snapshots.length + 1}`,
      timestamp: new Date().toISOString(),
      // Deep copy — tránh mutation từ bên ngoài
      zones: JSON.parse(JSON.stringify(zones)) as Zone[],
      assignments: assignments.map((a) => ({ ...a })),
    };

    this._snapshots.push(snapshot);

    // Giới hạn 50 snapshots — xóa cũ nhất (FIFO)
    if (this._snapshots.length > MAX_SNAPSHOTS) {
      this._snapshots.shift();
    }

    // Emit SAU khi thêm thành công
    this.emit('snapshot:created', snapshot);

    return snapshot;
  }

  /**
   * So sánh 2 snapshots, trả về diff chi tiết.
   *
   * @complexity O(n) — n = tổng zones trong cả 2 snapshots.
   */
  diffSnapshots(v1: Snapshot, v2: Snapshot): SnapshotDiff {
    const map1 = new Map<string, number>(v1.assignments.map((a) => [a.zoneId, a.districtId]));
    const map2 = new Map<string, number>(v2.assignments.map((a) => [a.zoneId, a.districtId]));

    const changed: SnapshotDiff['changed'] = [];
    const added: SnapshotDiff['added'] = [];
    const removed: SnapshotDiff['removed'] = [];

    // Zones trong v2
    for (const [zoneId, d2] of map2) {
      const d1 = map1.get(zoneId);
      if (d1 === undefined) {
        added.push({ zoneId, districtId: d2 });
      } else if (d1 !== d2) {
        changed.push({ zoneId, from: d1, to: d2 });
      }
    }

    // Zones trong v1 nhưng không có trong v2
    for (const [zoneId, d1] of map1) {
      if (!map2.has(zoneId)) {
        removed.push({ zoneId, districtId: d1 });
      }
    }

    // Metrics
    const totalCustomers = (snap: Snapshot) =>
      snap.zones.reduce((s, z) => s + _totalCustomers(z), 0);

    return {
      changed,
      added,
      removed,
      metrics: {
        customerDelta: totalCustomers(v2) - totalCustomers(v1),
        zoneDelta: v2.zones.length - v1.zones.length,
      },
    };
  }

  /**
   * Danh sách snapshots, mới nhất trước.
   * filter.period: 'week' = 7 ngày, 'month' = 30 ngày.
   */
  listHistory(filter?: { period: 'week' | 'month' }): Snapshot[] {
    let list = [...this._snapshots].reverse(); // mới nhất trước

    if (filter?.period) {
      const now = Date.now();
      const days = filter.period === 'week' ? 7 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      list = list.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
    }

    return list;
  }

  /**
   * Tìm snapshot theo label. Trả về undefined nếu không tìm thấy.
   */
  getSnapshot(label: string): Snapshot | undefined {
    return this._snapshots.find((s) => s.label === label);
  }
}
