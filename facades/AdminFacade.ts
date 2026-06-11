import type { Zone, SalesAgent } from '../types/domain.js';
import type { Assignment, AlgorithmName, PartitionOpts } from '../lib/partition.js';
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
  /** Cấu hình ràng buộc - lưu trong bộ nhớ, cập nhật qua configureConstraints(). */
  private _constraints: ConstraintConfig = {
    adjThresholdKm: 50,
    balanceThreshold: 1.5,
    defaultAlgo: 'hill-climbing',
  };

  constructor(
    private readonly territorySvc: TerritoryService,
    private readonly versionSvc: VersionService,
    private readonly activitySvc: ActivityService,
    private readonly mapSvc?: MapService,    // tùy chọn - tương thích ngược
  ) {}

  //  getSalesManagement 

  getSalesManagement(
    zones: Zone[],
    assignments: Assignment[],
    salesAgents: SalesAgent[],
  ): SalesManagement {
    const districtIds = [...new Set(assignments.map((a) => a.districtId))].sort(
      (a, b) => a - b,
    );
    const districtMap: DistrictMap = {};
    // Sửa lỗi: dùng salesAgentId từ Assignment thay vì districtId % salesAgents.length
    districtIds.forEach((did) => {
      const agentId = assignments.find((a) => a.districtId === did)?.salesAgentId;
      if (agentId) districtMap[did] = agentId;
    });
    return { sales: [...salesAgents], districtMap };
  }

  //  getVersionHistory 

  getVersionHistory(): Snapshot[] {
    return this.versionSvc.listHistory();
  }

  //  createVersion 

  /**
   * Tạo snapshot - Admin có quyền.
   * @throws {VersionError} DUPLICATE_LABEL
   */
  async createVersion(
    label: string,
    zones: Zone[],
    assignments: Assignment[],
  ): Promise<Snapshot> {
    return this.versionSvc.createSnapshot(label, zones, assignments);
  }

  //  runAlgorithm 

  /**
   * Chạy thuật toán partition và trả AlgorithmResultVM cho L4.
   *
   * @param algo  - 'greedy' | 'hill-climbing' | 'local-search' | 'sa'
   * @param zones - danh sách zones cần phân vùng
   * @param m     - số districts
   * @param salesAgents - danh sách sales agents (OPEN-4: giữ nguyên thứ tự canonical)
   * @param opts  - tùy chọn bổ sung (cooling, alpha, ...)
   */
  async runAlgorithm(
    algo: AlgorithmName,
    zones: Zone[],
    m: number,
    salesAgents: SalesAgent[] = [],
    opts?: PartitionOpts,
  ): Promise<AlgorithmResultVM> {
    const result = await this.territorySvc.runPartition(zones, m, algo, salesAgents, opts);
    return this.toAlgorithmResultVM(result);
  }

  //  configureConstraints 

  configureConstraints(config: ConstraintConfig): void {
    this._constraints = { ...this._constraints, ...config };
  }

  getConstraints(): Readonly<ConstraintConfig> {
    return { ...this._constraints };
  }

  //  exportReport 

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
      avgBalanceScore: 0, // được lập báo cáo tĩnh khi có đủ dữ liệu.
      snapshotCount: this.versionSvc.listHistory().length,
    };
  }

  //  Quản lý activity (chuyển tiếp sang ActivityService) 

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
   * Parse chuỗi CSV -> ActivityRecord[].
   * Định dạng: zone_id,customers,orders (header + data rows).
   */
  importActivitiesCSV(csv: string): Array<{ zoneId: string; customers: number; orders: number }> {
    return this.activitySvc.importActivitiesFromCSV(csv);
  }

  //  Phương thức Map / Matrix (chuyển tiếp sang MapService) 

  /**
   * Tính ma trận kề + ma trận khoảng cách.
   * adjThresholdKm = 50 (mặc định chuẩn Việt Nam).
   * @throws Error nếu MapService chưa được inject.
   */
  computeMatrices(zones: Zone[]): { adj: Record<string, string[]>; dist: Record<string, Record<string, number>> } {
    if (!this.mapSvc) throw new Error('MapService not injected into AdminFacade');
    return this.mapSvc.computeMatrices(zones);
  }

  /**
   * Phát hiện "island zones" - zones không kề zone nào trong ma trận kề.
   * @returns string[] - danh sách zoneIds bị cô lập.
   */
  getIslandZones(zones: Zone[]): string[] {
    if (!this.mapSvc) return [];
    const { adj } = this.mapSvc.computeMatrices(zones);
    return zones
      .filter(z => (adj[z.id] ?? []).length === 0)
      .map(z => z.id);
  }

  //  wrapAssignmentsAsResult 

  /**
   * Bọc Assignment[] thô (từ Web Worker) thành AlgorithmResultVM.
   * Worker trả về assignments không có salesAgentId - method này gắn lại chúng
   * and validates constraints to produce violations/metrics.
   */
  wrapAssignmentsAsResult(
    algo: AlgorithmName,
    zones: Zone[],
    rawAssignments: Assignment[],
    salesAgents: SalesAgent[],
    durationMs: number,
  ): AlgorithmResultVM {
    // G?n salesAgentId theo th? t? canonical c?a salesAgents
    const assignments = rawAssignments.map(a => ({
      ...a,
      salesAgentId: a.salesAgentId ?? salesAgents[a.districtId % salesAgents.length]?.id ?? '',
    }));

    // Validate ?? l?y metrics + violations
    const validation = validatePartition(zones, assignments, { adjThresholdKm: 50 });

    const canonicalAlgo: AlgorithmName = algo === 'local-search' ? 'hill-climbing' : algo;

    return {
      assignments,
      balanceScore:   validation.metrics.balanceScore,
      avgCustomersPerDistrict: this.computeAvgCustomersPerDistrict(zones, assignments),
      violationCount: validation.violations.length,
      maxDiameter:    validation.metrics.maxDiameter,
      algo:           canonicalAlgo,
      durationMs,
      suggestSA:      validation.metrics.balanceScore < 60 && canonicalAlgo !== 'sa',
      violations:     validation.violations.map((v: PartitionResult['violations'][number]) => this.toViolationVM(v)),
    };
  }

  //  Private helpers 

  /**
   * Convert L2 PartitionResult -> L4 AlgorithmResultVM.
   * Flatten PartitionMetrics ra top-level. Map violations union -> ViolationVM[].
   * L4 không bao giờ thấy PartitionMetrics hay violation union types từ L1.
   */
  private toAlgorithmResultVM(result: PartitionResult): AlgorithmResultVM {
    return {
      assignments:    result.assignments,
      balanceScore:   result.metrics.balanceScore,
      avgCustomersPerDistrict: result.avgCustomersPerDistrict,
      violationCount: result.violations.length,
      maxDiameter:    result.metrics.maxDiameter,
      algo:           result.algo,
      durationMs:     result.durationMs,
      suggestSA:      result.suggestSA,
      violations:     result.violations.map((v) => this.toViolationVM(v)),
    };
  }

  private computeAvgCustomersPerDistrict(zones: Zone[], assignments: Assignment[]): number {
    if (assignments.length === 0) return 0;
    const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
    const totals = new Map<number, number>();

    for (const assignment of assignments) {
      const zone = zoneById.get(assignment.zoneId);
      if (!zone) continue;
      const customers = zone.activities
        .filter((activity) => activity.type === 'CUSTOMER')
        .reduce((sum, activity) => sum + activity.value, 0);
      totals.set(assignment.districtId, (totals.get(assignment.districtId) ?? 0) + customers);
    }

    const districts = [...totals.values()];
    if (districts.length === 0) return 0;
    return districts.reduce((sum, value) => sum + value, 0) / districts.length;
  }

  /**
   * Map từng violation union member -> ViolationVM.
   * Dùng discriminated union type: 'OVER_LOADED' | 'UNDER_LOADED' -> BALANCE,
   * 'DISCONNECTED' -> CONTIGUITY, DiameterViolation (no .type field) -> DIAMETER.
   */
  private toViolationVM(
    v: PartitionResult['violations'][number],
  ): ViolationVM {
    // DiameterViolation không có .type field -> kiểm tra 'diameterKm' key
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
        message:    `District ${v.districtId} bị tách rời - không liên thông`,
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
