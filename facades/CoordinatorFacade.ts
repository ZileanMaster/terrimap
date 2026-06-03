/**
 * facades/CoordinatorFacade.ts — L3 Role Façade (stateless)
 *
 * Role: Coordinator — xem + gán + lịch sử + chạy phân chia, KHÔNG tạo version.
 * Không lưu state data trong constructor — nhận qua method params.
 */

import type { Zone, SalesAgent, Activity } from '../types/domain.js';
import type { Assignment, PartitionOpts } from '../lib/partition.js';
import type { TerritoryService } from '../services/TerritoryService.js';
import type { VersionService } from '../services/VersionService.js';
import type { ActivityService } from '../services/ActivityService.js';
import { PermissionError } from './errors.js';
import type {
  AlgorithmResultVM,
  TeamOverview,
  SalesWithZones,
  AssignResult,
  HistoryEntry,
  ViolationVM,
  PartitionResult,
} from './viewmodels.js';

// ─── Internal ─────────────────────────────────────────────────────────────────

interface FlaggedDistrict {
  districtId: number;
  reason: string;
  flaggedAt: string;
}

// ─── CoordinatorFacade ────────────────────────────────────────────────────────

export class CoordinatorFacade {
  private readonly _role = 'coordinator' as const;
  private readonly _flags: FlaggedDistrict[] = [];

  constructor(
    private readonly territorySvc: TerritoryService,
    private readonly versionSvc: VersionService,
    private readonly activitySvc: ActivityService,
  ) {}

  // ─── getTeamOverview ──────────────────────────────────────────────────────────

  getTeamOverview(
    zones: Zone[],
    assignments: Assignment[],
    salesAgents: SalesAgent[],
  ): TeamOverview {
    const zoneMap = new Map<string, Zone>(zones.map((z) => [z.id, z]));

    // BUG FIX: Dùng salesAgentId lookup thay vì districtId % salesAgents.length
    // Loại bỏ modulo mapping — gán chính xác theo salesAgentId trong Assignment
    const zonesBySales = new Map<string, Zone[]>(
      salesAgents.map((sa) => [sa.id, []]),
    );

    for (const a of assignments) {
      // Skip zones chưa được assign cho ai (salesAgentId undefined)
      if (!a.salesAgentId) continue;
      const zone = zoneMap.get(a.zoneId);
      if (zone) zonesBySales.get(a.salesAgentId)?.push(zone);
    }

    let totalKH = 0;
    let totalOrders = 0;

    const sales: SalesWithZones[] = salesAgents.map((sa) => {
      const agentZones = zonesBySales.get(sa.id) ?? [];
      const assignedZones = agentZones.map((z) => {
        const customers = _sumActivity(z.activities, 'CUSTOMER');
        const orders = _sumActivity(z.activities, 'ORDER');
        totalKH += customers;
        totalOrders += orders;
        return { zoneId: z.id, zoneName: z.name, customers, orders };
      });
      return {
        salesId: sa.id,
        salesName: sa.name,
        activeRegion: sa.activeRegion,
        capacity: sa.capacity,
        assignedZones,
      };
    });

    return { sales, totalKH, totalOrders };
  }

  // ─── assignZone — passthrough to manualSwap ───────────────────────────────────

  /**
   * Gán zone sang district khác.
   * Coordinator gọi trực tiếp với toDistrict (numeric), không cần salesId mapping.
   */
  async assignZone(
    zoneId: string,
    toDistrict: number,
    assignments: Assignment[],
    zones: Zone[],
  ): Promise<AssignResult> {
    const result = await this.territorySvc.manualSwap(
      zoneId,
      toDistrict,
      assignments,
      zones,
    );

    const fromAssignment = assignments.find((a) => a.zoneId === zoneId);

    return {
      ok: result.ok,
      zoneId,
      newSalesId: String(toDistrict),
      previousSalesId: fromAssignment ? String(fromAssignment.districtId) : null,
    };
  }

  // ─── getUpdateHistory ─────────────────────────────────────────────────────────

  getUpdateHistory(filter?: { period: 'week' | 'month' }): HistoryEntry[] {
    const snapshots = this.versionSvc.listHistory(filter);
    return snapshots.map((s) => ({
      label: s.label,
      version: s.version,
      timestamp: s.timestamp,
      zoneCount: s.zones.length,
    }));
  }

  // ─── flagForReview ────────────────────────────────────────────────────────────

  flagForReview(districtId: number, reason: string): void {
    const existing = this._flags.find((f) => f.districtId === districtId);
    if (existing) {
      existing.reason = reason;
      existing.flaggedAt = new Date().toISOString();
    } else {
      this._flags.push({
        districtId,
        reason,
        flaggedAt: new Date().toISOString(),
      });
    }
  }

  getFlags(): ReadonlyArray<FlaggedDistrict> {
    return this._flags;
  }

  // ─── BLOCKED — sync throw ─────────────────────────────────────────────────────

  /** @throws {PermissionError} PERMISSION_DENIED */
  createVersion(_label: string, ..._rest: unknown[]): never {
    throw new PermissionError({
      code: 'PERMISSION_DENIED',
      role: this._role,
      method: 'createVersion',
      message: 'Coordinators cannot create versions. Use AdminFacade instead.',
    });
  }

  // ─── BLOCKED — async throw (returns rejected Promise) ────────────────────────

  /**
   * Chạy thuật toán partition cho điều phối viên.
   * Điều phối viên được phép phân chia lại trong phạm vi khu vực phụ trách,
   * nhưng vẫn không có quyền tạo version snapshot.
   */
  async runAlgorithm(
    algo: 'greedy' | 'local-search' | 'sa',
    zones: Zone[],
    m: number,
    salesAgents: SalesAgent[] = [],
    opts?: PartitionOpts,
  ): Promise<AlgorithmResultVM> {
    const result = await this.territorySvc.runPartition(zones, m, algo, salesAgents, opts);
    return this.toAlgorithmResultVM(result);
  }

  private toAlgorithmResultVM(result: PartitionResult): AlgorithmResultVM {
    return {
      assignments: result.assignments,
      balanceScore: result.metrics.balanceScore,
      violationCount: result.violations.length,
      maxDiameter: result.metrics.maxDiameter,
      algo: result.algo,
      durationMs: result.durationMs,
      suggestSA: result.suggestSA,
      violations: result.violations.map((v) => this.toViolationVM(v)),
    };
  }

  private toViolationVM(v: PartitionResult['violations'][number]): ViolationVM {
    if ('diameterKm' in v) {
      return {
        type: 'DIAMETER',
        districtId: v.districtId,
        message: `District ${v.districtId}: diameter ${v.diameterKm.toFixed(1)} km > ${v.maxAllowed} km`,
        severity: 'warning',
      };
    }

    if (v.type === 'DISCONNECTED') {
      return {
        type: 'CONTIGUITY',
        districtId: v.districtId,
        message: `District ${v.districtId} bị tách rời — không liên thông`,
        severity: 'error',
      };
    }

    return {
      type: 'BALANCE',
      districtId: v.districtId,
      message: `District ${v.districtId}: ${v.type === 'OVER_LOADED' ? 'quá tải' : 'thiếu tải'} (${v.customerCount} KH, mean ${v.mean.toFixed(0)})`,
      severity: 'warning',
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _sumActivity(activities: Activity[], type: Activity['type']): number {
  return activities
    .filter((a) => a.type === type)
    .reduce((s, a) => s + a.value, 0);
}
