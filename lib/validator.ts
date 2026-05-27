/**
 * L1 — Validator & Quality Metrics
 *
 * Section 1: validateAll(TerritoryVersion) — QualityMetrics cho version đã commit.
 * Section 2: L1c Partition Validator — violation-based API cho Assignment[] trước khi commit.
 *
 * KHÔNG import gì từ UI layer hay L2+ layer.
 */

import type { TerritoryVersion, Zone, AdjacencyMatrix } from '../types/domain.js';
import { zoneDiameter, buildAdjacencyMatrix } from './geometry.js';
import type { Assignment } from './partition.js';

// ==========================================
// SECTION 1 — TERRITORY VERSION VALIDATOR
// ==========================================

/**
 * Bộ chỉ số chất lượng của một TerritoryVersion.
 * Tất cả values phải finite và sẵn sàng được lưu vào L0 District.balanceScore.
 */
export interface QualityMetrics {
  /** Điểm cân bằng tải (0–100). Cao hơn = phân phối đều hơn. */
  balanceScore: number;
  /** Workload nặng nhất trong tất cả districts */
  maxWorkload: number;
  /** Workload nhẹ nhất trong tất cả districts */
  minWorkload: number;
  /** Trung bình workload */
  meanWorkload: number;
  /** Tổng đường kính tất cả districts (km) */
  totalDiameter: number;
}

/**
 * Tính toán QualityMetrics cho toàn bộ TerritoryVersion.
 *
 * CONTRACTS:
 *  1. Nếu không có district nào → tất cả metrics = 0, balanceScore = 100.
 *  2. Nếu tất cả districts có totalWorkload = 0 → balanceScore = 100 (không /0).
 *  3. balanceScore luôn clamp vào [0, 100].
 *  4. Assertion cuối: mọi metric phải Number.isFinite — throw nếu vi phạm.
 *
 * @param version - TerritoryVersion đã validate bởi L0 TerritoryVersionSchema.
 * @returns QualityMetrics với mọi field finite.
 * @throws {Error} Nếu metric nội bộ là non-finite (lỗi lập trình).
 */
export function validateAll(version: TerritoryVersion): QualityMetrics {
  const districts = Object.values(version.districts);
  const zonesMap = version.zones;

  if (districts.length === 0) {
    return { balanceScore: 100, maxWorkload: 0, minWorkload: 0, meanWorkload: 0, totalDiameter: 0 };
  }

  const workloads = districts.map((d) => d.totalWorkload);
  const maxWorkload = Math.max(...workloads);
  const minWorkload = Math.min(...workloads);
  const meanWorkload = workloads.reduce((s, w) => s + w, 0) / workloads.length;

  let balanceScore: number;
  if (maxWorkload === 0) {
    balanceScore = 100;
  } else {
    const variance = workloads.reduce((s, w) => s + (w - meanWorkload) ** 2, 0) / workloads.length;
    const cv = Math.sqrt(variance) / meanWorkload;
    balanceScore = Math.max(0, Math.min(100, 100 * (1 - cv)));
  }

  const totalDiameter = districts.reduce((sum, district) => {
    const districtZones: Zone[] = district.zoneIds
      .map((id) => zonesMap[id])
      .filter((z): z is Zone => z !== undefined);
    return sum + zoneDiameter(districtZones);
  }, 0);

  const result: QualityMetrics = { balanceScore, maxWorkload, minWorkload, meanWorkload, totalDiameter };

  for (const [key, val] of Object.entries(result) as [keyof QualityMetrics, number][]) {
    if (!Number.isFinite(val)) {
      throw new Error(
        `validateAll produced non-finite metric "${key}" = ${val}. ` +
          'This is a programming error — check input data.'
      );
    }
  }

  return result;
}

// ==========================================
// SECTION 2 — L1c PARTITION VALIDATOR
//
// Hoạt động trên Assignment[] từ L1b — giai đoạn TRƯỚC khi commit vào TerritoryVersion.
// Trả về danh sách violations để coordinator L2 quyết định cần rebalance không.
// ==========================================

// ─── Error ───────────────────────────────────────────────────────────────────

/** Error codes cho Partition Validator. */
export type ValidatorErrorCode =
  | 'EMPTY_INPUT'       // zones rỗng
  | 'M_MISMATCH'        // assignments.length !== zones.length
  | 'INVALID_THRESHOLD' // threshold âm hoặc non-finite
  | 'INVALID_MODE';     // mode không hợp lệ

/** Lỗi do vi phạm contract của Partition Validator. */
export class ValidatorError extends Error {
  readonly code: ValidatorErrorCode;
  constructor(message: string, code: ValidatorErrorCode) {
    super(message);
    this.name = 'ValidatorError';
    this.code = code;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Mode tính balance.
 *  - `'ratio'`:  (max - min) / (min + 1) — dễ explain cho end-user, default threshold 1.5.
 *  - `'stddev'`: stdDev / (mean + 1)     — consistent với partition engine, default threshold 0.5.
 */
export type BalanceMode = 'ratio' | 'stddev';

/**
 * Violation khi một district quá tải hoặc thiếu tải.
 *  - OVER_LOADED  = district có count cao nhất (chỉ 1 district).
 *  - UNDER_LOADED = district có count thấp nhất (có thể nhiều).
 */
export interface BalanceViolation {
  type: 'OVER_LOADED' | 'UNDER_LOADED';
  districtId: number;
  customerCount: number;
  mean: number;
  /** Giá trị metric (ratio hoặc stddev) khi vi phạm. */
  ratio: number;
}

/** Violation khi district bị tách thành nhiều cụm không liên thông. */
export interface ContiguityViolation {
  type: 'DISCONNECTED';
  districtId: number;
}

/** Violation khi district có diameter vượt ngưỡng. */
export interface DiameterViolation {
  districtId: number;
  diameterKm: number;
  maxAllowed: number;
}

/** Một đề xuất swap zone giữa 2 districts. */
export interface SwapSuggestion {
  zoneId: string;
  fromDistrict: number;
  toDistrict: number;
  /** Số âm = balance giảm = cải thiện. */
  deltaBalance: number;
}

/** Kết quả validateGeometry. */
export interface GeometryValidationResult {
  contiguityViolations: ContiguityViolation[];
  diameterViolations: DiameterViolation[];
}

/** Metrics tổng hợp từ validatePartition. */
export interface PartitionMetrics {
  /** 0-100, cao hơn = cân bằng hơn. */
  balanceScore: number;
  maxDiameter: number;
  countsPerDistrict: number[];
}

/** Kết quả của validatePartition. */
export interface ValidationResult {
  valid: boolean;
  violations: (BalanceViolation | ContiguityViolation | DiameterViolation)[];
  metrics: PartitionMetrics;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Tổng customers của một zone. @internal */
function _zoneCustomers(zone: Zone): number {
  return zone.activities
    .filter((a) => a.type === 'CUSTOMER')
    .reduce((sum, a) => sum + a.value, 0);
}

/** Nhóm zones theo districtId từ assignments. @internal */
function _groupByDistrict(
  assignments: Assignment[],
  zoneMap: Map<string, Zone>,
  numDistricts: number,
): Zone[][] {
  const groups: Zone[][] = Array.from({ length: numDistricts }, () => []);
  for (const a of assignments) {
    const zone = zoneMap.get(a.zoneId);
    if (zone !== undefined) groups[a.districtId]!.push(zone);
  }
  return groups;
}

/** Số customers mỗi district. @internal */
function _customerCounts(groups: Zone[][]): number[] {
  return groups.map((g) => g.reduce((s, z) => s + _zoneCustomers(z), 0));
}

/**
 * BFS connectivity check trên subset zoneIds trong adjacency matrix.
 * @complexity O(V + E)
 * @internal
 */
function _isConnected(zoneIds: Set<string>, adj: AdjacencyMatrix): boolean {
  if (zoneIds.size <= 1) return true;
  const [start] = zoneIds;
  const visited = new Set<string>([start!]);
  const queue: string[] = [start!];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of adj[cur] ?? []) {
      if (zoneIds.has(nb) && !visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return visited.size === zoneIds.size;
}

/** Tính balance metric theo mode. @internal */
function _computeBalanceMetric(counts: number[], mode: BalanceMode): number {
  if (counts.length === 0) return 0;
  if (mode === 'ratio') {
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    return (max - min) / (min + 1);
  }
  const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
  return Math.sqrt(variance) / (mean + 1);
}

/** Validate prerequisite guards dùng chung. @internal */
function _guardInputs(zones: Zone[], assignments: Assignment[]): void {
  if (zones.length === 0)
    throw new ValidatorError('zones must not be empty.', 'EMPTY_INPUT');
  if (assignments.length !== zones.length)
    throw new ValidatorError(
      `assignments.length (${assignments.length}) !== zones.length (${zones.length}).`,
      'M_MISMATCH',
    );
}

/** Tính số districts từ assignments. @internal */
function _numDistricts(assignments: Assignment[]): number {
  if (assignments.length === 0) return 0;
  return Math.max(...assignments.map((a) => a.districtId)) + 1;
}

// ─── checkBalance ─────────────────────────────────────────────────────────────

/**
 * Kiểm tra balance workload giữa các districts.
 *
 * Trả về [] nếu OK, hoặc danh sách BalanceViolation nếu metric > threshold.
 * Logic flag: district max → OVER_LOADED, district(s) min → UNDER_LOADED.
 *
 * @complexity O(n) — n = zones.length.
 *
 * @param opts.mode      'ratio' | 'stddev'. Default: 'ratio'.
 * @param opts.threshold Default: 1.5 (ratio) hoặc 0.5 (stddev).
 * @throws {ValidatorError} EMPTY_INPUT | M_MISMATCH | INVALID_THRESHOLD | INVALID_MODE
 */
export function checkBalance(
  zones: Zone[],
  assignments: Assignment[],
  opts: { mode?: BalanceMode; threshold?: number } = {},
): BalanceViolation[] {
  _guardInputs(zones, assignments);

  const mode: BalanceMode = opts.mode ?? 'ratio';
  if (mode !== 'ratio' && mode !== 'stddev')
    throw new ValidatorError(
      `Invalid mode "${String(mode)}". Must be 'ratio' | 'stddev'.`,
      'INVALID_MODE',
    );

  const defaultThreshold = mode === 'ratio' ? 1.5 : 0.5;
  const threshold = opts.threshold ?? defaultThreshold;
  if (!Number.isFinite(threshold) || threshold < 0)
    throw new ValidatorError(
      `threshold must be finite non-negative, got ${threshold}.`,
      'INVALID_THRESHOLD',
    );

  const m = _numDistricts(assignments);
  const zoneMap = new Map<string, Zone>(zones.map((z) => [z.id, z]));
  const groups = _groupByDistrict(assignments, zoneMap, m);
  const counts = _customerCounts(groups);
  const metric = _computeBalanceMetric(counts, mode);

  if (metric <= threshold) return [];

  const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const violations: BalanceViolation[] = [];

  for (let d = 0; d < m; d++) {
    const c = counts[d]!;
    if (c === maxCount) {
      violations.push({ type: 'OVER_LOADED', districtId: d, customerCount: c, mean, ratio: metric });
    } else if (c === minCount) {
      violations.push({ type: 'UNDER_LOADED', districtId: d, customerCount: c, mean, ratio: metric });
    }
  }

  return violations;
}

// ─── validateGeometry ─────────────────────────────────────────────────────────

/**
 * Kiểm tra connectivity và diameter từng district.
 *
 * @param opts.adjThresholdKm  Gap threshold km cho near-boundary adjacency (default 0.12km).
 * @param opts.maxDiameterKm   Nếu set, flag district có diameter > giá trị này.
 *
 * @complexity O(n² + m×V).
 * @throws {ValidatorError} EMPTY_INPUT | M_MISMATCH
 */
export function validateGeometry(
  zones: Zone[],
  assignments: Assignment[],
  opts: { adjThresholdKm?: number; maxDiameterKm?: number } = {},
): GeometryValidationResult {
  _guardInputs(zones, assignments);

  const adjKm = opts.adjThresholdKm ?? 0.12;
  const maxDiamKm = opts.maxDiameterKm;
  const m = _numDistricts(assignments);
  const adj = buildAdjacencyMatrix(zones, adjKm);
  const zoneMap = new Map<string, Zone>(zones.map((z) => [z.id, z]));
  const groups = _groupByDistrict(assignments, zoneMap, m);

  const contiguityViolations: ContiguityViolation[] = [];
  const diameterViolations: DiameterViolation[] = [];

  for (let d = 0; d < m; d++) {
    const group = groups[d]!;
    const ids = new Set(group.map((z) => z.id));

    if (!_isConnected(ids, adj)) {
      contiguityViolations.push({ type: 'DISCONNECTED', districtId: d });
    }

    if (maxDiamKm !== undefined) {
      const diam = zoneDiameter(group);
      if (diam > maxDiamKm) {
        diameterViolations.push({ districtId: d, diameterKm: diam, maxAllowed: maxDiamKm });
      }
    }
  }

  return { contiguityViolations, diameterViolations };
}

// ─── suggestFix ───────────────────────────────────────────────────────────────

/**
 * Đề xuất các swap zone để cải thiện balance.
 *
 * Connectivity guard (BFS): swap nào làm district nguồn disconnected bị loại bỏ.
 *
 * @complexity O(n² × m) worst-case. Với n=20, m=4: ~1600 BFS checks.
 * @param opts.adjThresholdKm  Gap threshold km (default 0.12km).
 * @param opts.maxSuggestions  Số tối đa (default 5).
 * @returns SwapSuggestion[] đã sắp xếp theo deltaBalance tăng dần.
 * @throws {ValidatorError} EMPTY_INPUT | M_MISMATCH
 */
export function suggestFix(
  zones: Zone[],
  assignments: Assignment[],
  opts: { mode?: BalanceMode; adjThresholdKm?: number; maxSuggestions?: number } = {},
): SwapSuggestion[] {
  _guardInputs(zones, assignments);

  const mode: BalanceMode = opts.mode ?? 'ratio';
  const adjKm = opts.adjThresholdKm ?? 0.12;
  const maxSugg = opts.maxSuggestions ?? 5;
  const m = _numDistricts(assignments);

  const zoneMap = new Map<string, Zone>(zones.map((z) => [z.id, z]));
  const adj = buildAdjacencyMatrix(zones, adjKm);
  const zoneDistrict = new Map(assignments.map((a) => [a.zoneId, a.districtId]));

  const groups = _groupByDistrict(assignments, zoneMap, m);
  const currentCounts = _customerCounts(groups);
  const currentBalance = _computeBalanceMetric(currentCounts, mode);
  const distZoneIds: Set<string>[] = groups.map((g) => new Set(g.map((z) => z.id)));

  const candidates: SwapSuggestion[] = [];

  for (const zone of zones) {
    const fromDistrict = zoneDistrict.get(zone.id);
    if (fromDistrict === undefined) continue;

    // Guard: district nguồn phải còn ≥ 2 zones (no empty district)
    if (distZoneIds[fromDistrict]!.size <= 1) continue;

    // Connectivity guard: BFS verify sau khi bỏ zone
    const remaining = new Set(distZoneIds[fromDistrict]!);
    remaining.delete(zone.id);
    if (!_isConnected(remaining, adj)) continue;

    const cust = _zoneCustomers(zone);
    for (let to = 0; to < m; to++) {
      if (to === fromDistrict) continue;
      const newCounts = [...currentCounts];
      newCounts[fromDistrict]! -= cust;
      newCounts[to]! += cust;
      const delta = _computeBalanceMetric(newCounts, mode) - currentBalance;
      if (delta < -1e-9) {
        candidates.push({ zoneId: zone.id, fromDistrict, toDistrict: to, deltaBalance: delta });
      }
    }
  }

  candidates.sort((a, b) => a.deltaBalance - b.deltaBalance);
  return candidates.slice(0, maxSugg);
}

// ─── validatePartition ────────────────────────────────────────────────────────

/**
 * Validator tổng hợp: chạy checkBalance + validateGeometry, trả về ValidationResult.
 *
 * Dùng ở L2 coordinator để quyết định có chấp nhận kết quả partition không.
 *
 * @param opts.balanceMode       Mode balance. Default: 'ratio'.
 * @param opts.balanceThreshold  Threshold balance. Default: 1.5 (ratio) | 0.5 (stddev).
 * @param opts.adjThresholdKm    Gap threshold km cho near-boundary adjacency. Default: 0.12km.
 * @param opts.maxDiameterKm     Nếu set, check diameter violations.
 * @returns ValidationResult { valid, violations, metrics }
 * @throws {ValidatorError} EMPTY_INPUT | M_MISMATCH
 */
export function validatePartition(
  zones: Zone[],
  assignments: Assignment[],
  opts: {
    balanceMode?: BalanceMode;
    balanceThreshold?: number;
    adjThresholdKm?: number;
    maxDiameterKm?: number;
  } = {},
): ValidationResult {
  _guardInputs(zones, assignments);

  const balanceViolations = checkBalance(zones, assignments, {
    mode: opts.balanceMode ?? 'ratio',
    ...(opts.balanceThreshold !== undefined && { threshold: opts.balanceThreshold }),
  });

  const geoResult = validateGeometry(zones, assignments, {
    ...(opts.adjThresholdKm !== undefined && { adjThresholdKm: opts.adjThresholdKm }),
    ...(opts.maxDiameterKm !== undefined && { maxDiameterKm: opts.maxDiameterKm }),
  });

  const allViolations: ValidationResult['violations'] = [
    ...balanceViolations,
    ...geoResult.contiguityViolations,
    ...geoResult.diameterViolations,
  ];

  // Metrics computation
  const m = _numDistricts(assignments);
  const zoneMap = new Map<string, Zone>(zones.map((z) => [z.id, z]));
  const groups = _groupByDistrict(assignments, zoneMap, m);
  const counts = _customerCounts(groups);

  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
  const meanCount = counts.length > 0
    ? counts.reduce((s, c) => s + c, 0) / counts.length
    : 0;

  let balanceScore = 100;
  if (maxCount > 0 && meanCount > 0) {
    const variance = counts.reduce((s, c) => s + (c - meanCount) ** 2, 0) / counts.length;
    const cv = Math.sqrt(variance) / meanCount;
    balanceScore = Math.max(0, Math.min(100, 100 * (1 - cv)));
  }

  // maxDiameter: tính từ tất cả districts (không chỉ violations)
  const diams = groups.map((g) => zoneDiameter(g));
  const maxDiameter = diams.length > 0 ? Math.max(...diams) : 0;

  return {
    valid: allViolations.length === 0,
    violations: allViolations,
    metrics: { balanceScore, maxDiameter, countsPerDistrict: counts },
  };
}
