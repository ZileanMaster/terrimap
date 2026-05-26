/**
 * facades/AdminFacade.ts — L3 Role Façade (stateless)
 *
 * Role: Admin — toàn quyền.
 * Không lưu zones/assignments trong constructor — nhận qua method params.
 */

import type { Zone, SalesAgent } from '../types/domain.js';
import type { Assignment, PartitionOpts } from '../lib/partition.js';
import { validatePartition } from '../lib/validator.js';
import type { TerritoryService, PartitionResult } from '../services/TerritoryService.js';
import type { VersionService, Snapshot } from '../services/VersionService.js';
import type { ActivityService } from '../services/ActivityService.js';
import type { MapService } from '../services/MapService.js';
import type {
  AlgorithmResultVM,
  ViolationVM,
  SalesManagement,
  DistrictMap,
  ConstraintConfig,
  ReportData,
} from './viewmodels.js';

export class AdminFacade {
  /** Constraint config — persisted in-memory, cập nhật qua configureConstraints(). */
  private _constraints: ConstraintConfig = {
    adjThresholdKm: 50,
    balanceThreshold: 1.5,
    defaultAlgo: 'local-search',
  };

  constructor(
    private readonly territorySvc: TerritoryService,
    private readonly versionSvc: VersionService,
    private readonly activitySvc: ActivityService,
    private readonly mapSvc?: MapService,    // optional — backward-compatible
  ) {}

  // ─── getSalesManagement ───────────────────────────────────────────────────────

  getSalesManagement(
    zones: Zone[],
    assignments: Assignment[],
    salesAgents: SalesAgent[],
  ): SalesManagement {
    const districtIds = [...new Set(assignments.map((a) => a.districtId))].sort(
      (a, b) => a - b,
    );
    const districtMap: DistrictMap = {};
    // BUG FIX: Dùng salesAgentId từ Assignment thay vì districtId % salesAgents.length
    districtIds.forEach((did) => {
      const agentId = assignments.find((a) => a.districtId === did)?.salesAgentId;
      if (agentId) districtMap[did] = agentId;
    });
    return { sales: [...salesAgents], districtMap };
  }

  // ─── getVersionHistory ────────────────────────────────────────────────────────

  getVersionHistory(): Snapshot[] {
    return this.versionSvc.listHistory();
  }

  // ─── createVersion ────────────────────────────────────────────────────────────

  /**
   * Tạo snapshot — Admin có quyền.
   * @throws {VersionError} DUPLICATE_LABEL
   */
  async createVersion(
    label: string,
    zones: Zone[],
    assignments: Assignment[],
  ): Promise<Snapshot> {
    return this.versionSvc.createSnapshot(label, zones, assignments);
  }

  // ─── runAlgorithm ─────────────────────────────────────────────────────────────

  /**
   * Chạy thuật toán partition và trả AlgorithmResultVM cho L4.
   *
   * @param algo  — 'greedy' | 'local-search' | 'sa'
   * @param zones — danh sách zones cần phân vùng
   * @param m     — số districts
   * @param salesAgents — danh sách sales agents (OPEN-4: giữ nguyên thứ tự canonical)
   * @param opts  — tùy chọn bổ sung (cooling, alpha, ...)
   *
   * Return type đổi từ PartitionResult → AlgorithmResultVM để L4 không bị
   * expose L1/L2 internal types (PartitionMetrics, violations union).
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

  // ─── configureConstraints ─────────────────────────────────────────────────────

  configureConstraints(config: ConstraintConfig): void {
    this._constraints = { ...this._constraints, ...config };
  }

  getConstraints(): Readonly<ConstraintConfig> {
    return { ...this._constraints };
  }

  // ─── exportReport ─────────────────────────────────────────────────────────────

  /**
   * Tổng hợp báo cáo từ zones + assignments + salesAgents hiện tại.
   * Bao gồm raw zones/assignments arrays để export downstream.
   */
  exportReport(
    zones: Zone[],
    assignments: Assignment[],
    salesAgents: SalesAgent[],
  ): ReportData {
    const districtIds = [...new Set(assignments.map((a) => a.districtId))];

    let totalCustomers = 0;
    let totalOrders = 0;
    for (const z of zones) {
      totalCustomers += z.activities
        .filter((a) => a.type === 'CUSTOMER')
        .reduce((s, a) => s + a.value, 0);
      totalOrders += z.activities
        .filter((a) => a.type === 'ORDER')
        .reduce((s, a) => s + a.value, 0);
    }

    return {
      generatedAt: new Date().toISOString(),
      zones,
      assignments,
      totalZones: zones.length,
      totalDistricts: districtIds.length,
      totalSales: salesAgents.length,
      totalCustomers,
      totalOrders,
      avgBalanceScore: 0, // Computed by the reporting layer when metrics are available.
      snapshotCount: this.versionSvc.listHistory().length,
    };
  }

  // ─── Activity management (passthrough to ActivityService) ─────────────────

  /**
   * Cập nhật activities (KH, đơn hàng) cho 1 zone.
   * @returns zones[] mới (immutable).
   * @throws {ServiceError} ZONE_NOT_FOUND | INVALID_INPUT
   */
  updateZoneActivity(
    zoneId: string,
    zones: Zone[],
    data: { customers?: number; orders?: number },
  ): Zone[] {
    return this.activitySvc.updateZoneActivity(zoneId, zones, data);
  }

  /**
   * Parse CSV string → ActivityRecord[].
   * Format: zone_id,customers,orders (header + data rows).
   */
  importActivitiesCSV(csv: string): Array<{ zoneId: string; customers: number; orders: number }> {
    return this.activitySvc.importActivitiesFromCSV(csv);
  }

  // ─── Map / Matrix methods (passthrough to MapService) ─────────────────────

  /**
   * Tính ma trận kề + ma trận khoảng cách.
   * adjThresholdKm = 50 (default chuẩn Việt Nam).
   * @throws Error nếu MapService chưa được inject.
   */
  computeMatrices(zones: Zone[]): { adj: Record<string, string[]>; dist: Record<string, Record<string, number>> } {
    if (!this.mapSvc) throw new Error('MapService not injected into AdminFacade');
    return this.mapSvc.computeMatrices(zones);
  }

  /**
   * Phát hiện "island zones" — zones không kề zone nào trong adj matrix.
   * @returns string[] — danh sách zoneIds bị cô lập.
   */
  getIslandZones(zones: Zone[]): string[] {
    if (!this.mapSvc) return [];
    const { adj } = this.mapSvc.computeMatrices(zones);
    return zones
      .filter(z => (adj[z.id] ?? []).length === 0)
      .map(z => z.id);
  }

  // ─── wrapAssignmentsAsResult ─────────────────────────────────────────────────

  /**
   * Wrap raw Assignment[] (from Web Worker) into AlgorithmResultVM.
   * Worker returns assignments without salesAgentId — this method wires them
   * and validates constraints to produce violations/metrics.
   */
  wrapAssignmentsAsResult(
    algo: 'greedy' | 'local-search' | 'sa',
    zones: Zone[],
    rawAssignments: Assignment[],
    salesAgents: SalesAgent[],
    durationMs: number,
  ): AlgorithmResultVM {
    // Wire salesAgentId using canonical salesAgents order
    const assignments = rawAssignments.map(a => ({
      ...a,
      salesAgentId: a.salesAgentId ?? salesAgents[a.districtId % salesAgents.length]?.id ?? `sa${a.districtId}`,
    }));

    // Validate to get metrics + violations
    const validation = validatePartition(zones, assignments, { adjThresholdKm: 50 });

    return {
      assignments,
      balanceScore:   validation.metrics.balanceScore,
      violationCount: validation.violations.length,
      maxDiameter:    validation.metrics.maxDiameter,
      algo,
      durationMs,
      suggestSA:      validation.metrics.balanceScore < 60 && algo !== 'sa',
      violations:     validation.violations.map((v: PartitionResult['violations'][number]) => this.toViolationVM(v)),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Convert L2 PartitionResult → L4 AlgorithmResultVM.
   * Flatten PartitionMetrics ra top-level. Map violations union → ViolationVM[].
   * L4 không bao giờ thấy PartitionMetrics hay violation union types từ L1.
   */
  private toAlgorithmResultVM(result: PartitionResult): AlgorithmResultVM {
    return {
      assignments:    result.assignments,
      balanceScore:   result.metrics.balanceScore,
      violationCount: result.violations.length,
      maxDiameter:    result.metrics.maxDiameter,
      algo:           result.algo,
      durationMs:     result.durationMs,
      suggestSA:      result.suggestSA,
      violations:     result.violations.map((v) => this.toViolationVM(v)),
    };
  }

  /**
   * Map từng violation union member → ViolationVM.
   * Dùng discriminated union type: 'OVER_LOADED' | 'UNDER_LOADED' → BALANCE,
   * 'DISCONNECTED' → CONTIGUITY, DiameterViolation (no .type field) → DIAMETER.
   */
  private toViolationVM(
    v: PartitionResult['violations'][number],
  ): ViolationVM {
    // DiameterViolation không có .type field → kiểm tra 'diameterKm' key
    if ('diameterKm' in v) {
      return {
        type:       'DIAMETER',
        districtId: v.districtId,
        message:    `District ${v.districtId}: diameter ${v.diameterKm.toFixed(1)} km > ${v.maxAllowed} km`,
        severity:   'warning',
      };
    }

    if (v.type === 'DISCONNECTED') {
      return {
        type:       'CONTIGUITY',
        districtId: v.districtId,
        message:    `District ${v.districtId} bị tách rời — không liên thông`,
        severity:   'error',
      };
    }

    // BalanceViolation: OVER_LOADED | UNDER_LOADED
    return {
      type:       'BALANCE',
      districtId: v.districtId,
      message:    `District ${v.districtId}: ${v.type === 'OVER_LOADED' ? 'quá tải' : 'thiếu tải'} (${v.customerCount} KH, mean ${v.mean.toFixed(0)})`,
      severity:   'warning',
    };
  }
}
