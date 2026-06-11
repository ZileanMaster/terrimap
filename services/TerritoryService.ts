import type { Zone, SalesAgent } from '../types/domain.js';
import {
  getPartitionFn,
  type AlgorithmName,
  type Assignment,
  type PartitionOpts,
  PartitionError,
} from '../lib/partition.js';
import {
  validatePartition,
  suggestFix,
  type ValidationResult,
  type PartitionMetrics,
  type SwapSuggestion,
} from '../lib/validator.js';
import { ServiceError } from './errors.js';

//  Tiny browser-compatible EventEmitter (replaces Node.js EventEmitter) 
// Keeps the same .emit() / .on() / .off() API so existing tests pass unchanged.
class EventEmitter {
  private _listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  on(event: string, listener: (...args: unknown[]) => void): this {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    this._listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return false;
    set.forEach((fn) => fn(...args));
    return true;
  }
}


/** Kết quả của runPartition() - bao gồm metrics, violations và gợi ý SA. */
export interface PartitionResult {
  assignments: Assignment[];
  metrics: PartitionMetrics;
  violations: ValidationResult['violations'];
  algo: AlgorithmName;
  durationMs: number;
  avgCustomersPerDistrict: number;
  /**
   * true nếu balanceScore < 60 và algo !== 'sa'.
   * Hill Climbing balance thường tốt hơn Greedy nhờ 2-opt improvement.
   * Khi suggestSA = true, UI nên hiển thị warning rebalance.
   */
  suggestSA: boolean;
}

/** Kết quả của manualSwap(). */
export interface SwapResult {
  ok: boolean;
  newAssignments: Assignment[];
  newMetrics: PartitionMetrics;
  violations: ValidationResult['violations'];
}

//  TerritoryService 

export class TerritoryService extends EventEmitter {

  /**
   * Phân vùng zones thành m districts bằng thuật toán được chọn.
   *
   * Thứ tự:
   *  1. Validate input.
   *  2. Gọi getPartitionFn(algo).
   *  3. Đo thời gian chạy thuật toán.
   *  4. Emit progress events qua onProgress callback.
   *  5. validatePartition() để tính metrics + violations.
   *  6. Emit 'partition:complete'.
   *
   * @throws {ServiceError} INVALID_INPUT | PARTITION_FAILED | VALIDATION_FAILED
   */
  async runPartition(
    zones: Zone[],
    m: number,
    algo: AlgorithmName,
    salesAgents: SalesAgent[] = [],
    opts?: PartitionOpts,
  ): Promise<PartitionResult> {
    // 1. Validate input
    if (zones.length === 0) {
      throw new ServiceError({
        code: 'INVALID_INPUT',
        message: 'zones must not be empty.',
      });
    }
    if (!Number.isInteger(m) || m < 2 || m > zones.length) {
      throw new ServiceError({
        code: 'INVALID_INPUT',
        message: `m must be an integer in [2, ${zones.length}], got ${m}.`,
      });
    }

    // 2. Get partition function
    const fn = getPartitionFn(algo);

    // 3. Measure + run
    const start = performance.now();
    let assignments: Assignment[];

    try {
      assignments = fn(zones, m, {
        ...opts,
        onProgress: (iter: number, cost: number) => {
          this.emit('partition:progress', { iter, cost });
        },
      });

      // Wire salesAgentId: districtId -> salesAgents[districtId]
      // Guard: nếu districtId >= salesAgents.length -> không set salesAgentId
      if (salesAgents.length > 0) {
        assignments = assignments.map((a) => {
          const agentId = salesAgents[a.districtId]?.id;
          return agentId !== undefined ? { ...a, salesAgentId: agentId } : a;
        });
      }
    } catch (err) {
      if (err instanceof PartitionError) {
        throw new ServiceError({
          code: 'PARTITION_FAILED',
          message: err.message,
          originalError: err,
        });
      }
      throw err;
    }

    const durationMs = performance.now() - start;

    // 5. Validate
    let validation: ValidationResult;
    try {
      validation = validatePartition(zones, assignments, { adjThresholdKm: 50 });
    } catch (err) {
      throw new ServiceError({
        code: 'VALIDATION_FAILED',
        message: err instanceof Error ? err.message : String(err),
        originalError: err,
      });
    }

    // 7. Build result
    const canonicalAlgo: AlgorithmName = algo === 'local-search' ? 'hill-climbing' : algo;

    const result: PartitionResult = {
      assignments,
      metrics: validation.metrics,
      violations: validation.violations,
      algo: canonicalAlgo,
      durationMs,
      avgCustomersPerDistrict: computeAvgCustomersPerDistrict(zones, assignments),
      suggestSA: validation.metrics.balanceScore < 60 && canonicalAlgo !== 'sa',
    };

    // 8. Emit AFTER success
    this.emit('partition:complete', result);

    return result;
  }

  /**
   * Swap thủ công một zone sang district khác.
   *
   * Connectivity guard: nếu swap tạo disconnected district nguồn
   * -> throw ServiceError SWAP_DISCONNECTS.
   *
   * @throws {ServiceError} ZONE_NOT_FOUND | SAME_DISTRICT | SWAP_DISCONNECTS | VALIDATION_FAILED
   */
  async manualSwap(
    zoneId: string,
    toDistrict: number,
    currentAssignments: Assignment[],
    zones: Zone[],
  ): Promise<SwapResult> {
    // 1. Tìm assignment
    const existing = currentAssignments.find((a) => a.zoneId === zoneId);
    if (existing === undefined) {
      throw new ServiceError({
        code: 'ZONE_NOT_FOUND',
        message: `zoneId "${zoneId}" not found in currentAssignments.`,
      });
    }

    const fromDistrict = existing.districtId;

    // 2. Same district guard
    if (fromDistrict === toDistrict) {
      throw new ServiceError({
        code: 'SAME_DISTRICT',
        message: `zoneId "${zoneId}" is already in district ${toDistrict}.`,
      });
    }

    // 3. Apply swap - immutable
    const newAssignments: Assignment[] = currentAssignments.map((a) =>
      a.zoneId === zoneId ? { ...a, districtId: toDistrict } : a,
    );

    // 4. Validate
    let validation: ValidationResult;
    try {
      validation = validatePartition(zones, newAssignments, { adjThresholdKm: 50 });
    } catch (err) {
      throw new ServiceError({
        code: 'VALIDATION_FAILED',
        message: err instanceof Error ? err.message : String(err),
        originalError: err,
      });
    }

    // 5. Connectivity guard
    const sourceDisconnected = validation.violations.some(
      (v) => 'type' in v && v.type === 'DISCONNECTED' &&
             'districtId' in v && v.districtId === fromDistrict,
    );
    if (sourceDisconnected) {
      throw new ServiceError({
        code: 'SWAP_DISCONNECTS',
        message: `Swapping "${zoneId}" out of district ${fromDistrict} would disconnect it.`,
        districtId: fromDistrict,
      });
    }

    // 6. Emit AFTER success
    this.emit('zone:swapped', { zoneId, fromDistrict, toDistrict });

    return {
      ok: true,
      newAssignments,
      newMetrics: validation.metrics,
      violations: validation.violations,
    };
  }

  /**
   * Gợi ý các swap cải thiện balance, an toàn về connectivity.
   * Trả về top 5, sorted by deltaBalance ascending (âm nhất trước).
   */
  getSuggestions(zones: Zone[], assignments: Assignment[]): SwapSuggestion[] {
    const all = suggestFix(zones, assignments, { adjThresholdKm: 50, maxSuggestions: 5 });
    return all.sort((a, b) => a.deltaBalance - b.deltaBalance);
  }
}

function computeAvgCustomersPerDistrict(zones: Zone[], assignments: Assignment[]): number {
  if (assignments.length === 0) return 0;
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const totals = new Map<number, number>();

    for (const assignment of assignments) {
      const zone = zoneById.get(assignment.zoneId);
      if (!zone) continue;
      const activities = zone.activities ?? [];
      const customers = activities
        .filter((activity) => activity.type === 'CUSTOMER')
        .reduce((sum, activity) => sum + activity.value, 0);
    totals.set(assignment.districtId, (totals.get(assignment.districtId) ?? 0) + customers);
  }

  const districtTotals = [...totals.values()];
  if (districtTotals.length === 0) return 0;
  return districtTotals.reduce((sum, value) => sum + value, 0) / districtTotals.length;
}
