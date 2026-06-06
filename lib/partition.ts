/**
 * L1b — Partition Engine
 *
 * Pure functions cho hệ thống Commercial Territory Design.
 * Import từ types/domain.ts (L0) và lib/geometry.ts (L1a).
 *
 * Contracts:
 *  - Không có side effects — mọi hàm là pure function (trừ callback onProgress).
 *  - Kết quả luôn bao gồm tất cả zones (không zone nào bị bỏ sót).
 *  - districtId ∈ [0, m-1] với mọi Assignment.
 *  - Các tham số không hợp lệ → throw PartitionError ngay lập tức.
 *
 * @module partition
 */

import type { Zone, AdjacencyMatrix } from '../types/domain.js';
import { haversineDistance, buildAdjacencyMatrix, meanCoordinate } from './geometry.js';

// ==========================================
// ERROR TYPE
// ==========================================

/** Error codes cho từng loại vi phạm contract. */
export type PartitionErrorCode =
  | 'NO_ZONES'      // zones array rỗng
  | 'M_TOO_SMALL'   // m < 2
  | 'M_TOO_LARGE'   // m > zones.length
  | 'DISCONNECTED_GRAPH' // input adjacency graph has multiple components
  | 'INVALID_ITER'  // maxIter < 0 hoặc không nguyên
  | 'INVALID_COOLING' // cooling ngoài (0,1)
  | 'INVALID_TEMP'; // initialTemp <= 0

/**
 * Lỗi do vi phạm contract của Partition Engine.
 * Mỗi lỗi có một `code` định danh để test có thể match cụ thể.
 */
export class PartitionError extends Error {
  readonly code: PartitionErrorCode;
  constructor(message: string, code: PartitionErrorCode) {
    super(message);
    this.name = 'PartitionError';
    this.code = code;
  }
}

// ==========================================
// PUBLIC TYPES
// ==========================================

/** Kết quả gán một zone vào một district. */
export interface Assignment {
  zoneId: string;
  /** INVARIANT: districtId ∈ [0, m-1] */
  districtId: number;
  /**
   * Explicit SalesAgent ID — undefined tại L1 (algorithms không biết về salesAgents).
   * Được wire bởi L2 TerritoryService.runPartition() sau khi pagination hoàn tất.
   * Dùng cho L2/L3 lookup thay vì modulo index.
   */
  salesAgentId?: string;
}

/** Callback để log tiến trình — không ảnh hưởng logic thuật toán. */
export type ProgressCallback = (iter: number, cost: number) => void;

/** Tùy chọn chung cho mọi thuật toán phân vùng. */
export interface PartitionOpts {
  /** Callback nhận tiến trình mỗi iteration. */
  onProgress?: ProgressCallback;

  /** Số vòng lặp tối đa. Default: 100 (Greedy), 500 (Local Search), 10000 (SA). */
  maxIter?: number;

  // --- Simulated Annealing ---
  /** Nhiệt độ ban đầu. Default: 2000. */
  initialTemp?: number;
  /** Hệ số làm nguội (0 < cooling < 1). Default: 0.997. */
  cooling?: number;
  /** Trọng số cho thành phần dispersion trong objective. Default: 0.35. */
  alpha?: number;
  /** Trọng số cho thành phần imbalance trong objective. Default: 0.65. */
  beta?: number;
  /**
   * Gap threshold (km) để bổ sung adjacency khi polygon có khe hở nhỏ.
   * Default: 0.12 km (~120m). Giá trị lớn dễ "nối tắt" qua vùng khác → làm sai liên thông.
   */
  adjThresholdKm?: number;
  /** Balance weights — default: { customers: 1.0, orders: 1.0 } */
  balanceWeights?: { customers: number; orders: number };
  /** Objective function: 'p-median' (minimize tổng distance — recommended, Salazar-Aguilar et al. 2011) hoặc 'p-center' (minimize max diameter). Default: 'p-median'. */
  objective?: 'p-center' | 'p-median';
}

/**
 * Interface chung cho mọi thuật toán phân vùng.
 * @param zones  - Các zone cần phân vùng. Phải có ít nhất m zones.
 * @param m      - Số districts cần tạo. Phải >= 1.
 * @param opts   - Tùy chọn bổ sung.
 * @returns      - Mảng Assignment, mỗi phần tử tương ứng với 1 zone.
 */
export type PartitionFn = (
  zones: Zone[],
  m: number,
  opts?: PartitionOpts,
) => Assignment[];

// ==========================================
// INTERNAL HELPERS
// ==========================================

function getGraphComponents(zones: Zone[], adjMatrix: AdjacencyMatrix): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const zone of zones) {
    if (visited.has(zone.id)) continue;

    const component: string[] = [];
    const queue = [zone.id];
    visited.add(zone.id);

    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]!;
      component.push(current);

      for (const neighbor of adjMatrix[current] ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function ensureConnectedInputGraph(zones: Zone[], adjMatrix: AdjacencyMatrix): void {
  const components = getGraphComponents(zones, adjMatrix);
  if (components.length <= 1) return;

  throw new PartitionError(
    `zone adjacency graph has ${components.length} disconnected components; ` +
      'cannot guarantee connected districts without artificial bridge edges',
    'DISCONNECTED_GRAPH',
  );
}

/**
 * Tính tổng customers của một zone.
 * @internal
 */
function zoneCustomers(zone: Zone): number {
  return zone.activities
    .filter((a) => a.type === 'CUSTOMER')
    .reduce((sum, a) => sum + a.value, 0);
}

/**
 * Tính tổng orders của một zone.
 * @internal
 */
function zoneOrders(zone: Zone): number {
  return zone.activities
    .filter((a) => a.type === 'ORDER')
    .reduce((sum, a) => sum + a.value, 0);
}

interface ZoneActivityTotals {
  customers: Float64Array;
  orders: Float64Array;
}

function buildZoneActivityTotals(zones: Zone[]): ZoneActivityTotals {
  const customers = new Float64Array(zones.length);
  const orders = new Float64Array(zones.length);

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i]!;
    let customerTotal = 0;
    let orderTotal = 0;

    for (const activity of zone.activities) {
      if (activity.type === 'CUSTOMER') customerTotal += activity.value;
      else if (activity.type === 'ORDER') orderTotal += activity.value;
    }

    customers[i] = customerTotal;
    orders[i] = orderTotal;
  }

  return { customers, orders };
}

/**
 * Chọn m seeds xa nhau nhất bằng greedy farthest-point.
 * Seed đầu tiên = zone index 0 (arbitrary).
 *
 * @complexity O(m × n)
 * @internal
 */
function selectFarthestSeeds(zones: Zone[], m: number): number[] {
  if (zones.length === 0 || m <= 0) return [];
  if (m >= zones.length) return zones.map((_, i) => i);

  const seeds: number[] = [0]; // start từ zone đầu tiên
  const inSeed = new Uint8Array(zones.length); // bitmask: zone đã là seed
  inSeed[0] = 1;
  const minDist = new Float64Array(zones.length).fill(Infinity);

  // Cập nhật minDist từ seed đầu
  for (let j = 0; j < zones.length; j++) {
    minDist[j] = haversineDistance(
      zones[0]!.centroid,
      zones[j]!.centroid,
    );
  }
  minDist[0] = -1; // đánh dấu seed đã chọn

  for (let s = 1; s < m; s++) {
    // Chọn zone CHƯA là seed, có minDist lớn nhất
    let farthest = -1;
    let maxD = -1;
    for (let j = 0; j < zones.length; j++) {
      if (inSeed[j]) continue; // bỏ qua seeds đã chọn
      if (minDist[j]! > maxD) {
        maxD = minDist[j]!;
        farthest = j;
      }
    }
    // Nếu tất cả zones trùng tọa độ, fallback: chọn index tiếp theo chưa là seed
    if (farthest === -1) {
      for (let j = 0; j < zones.length; j++) {
        if (!inSeed[j]) { farthest = j; break; }
      }
    }
    if (farthest === -1) break; // không còn zone nào để chọn
    seeds.push(farthest);
    inSeed[farthest] = 1;

    // Cập nhật minDist với seed mới
    for (let j = 0; j < zones.length; j++) {
      if (inSeed[j]) continue;
      const d = haversineDistance(
        zones[farthest]!.centroid,
        zones[j]!.centroid,
      );
      if (d < minDist[j]!) minDist[j] = d;
    }
  }

  return seeds;
}

/**
 * Tính objective cost của một assignment.
 * cost = alpha × dispersion + beta × totalImbalance + gamma × fragmentPenalty
 *
 * dispersion: p-center (max diameter) hoặc p-median (tổng distance → center).
 * totalImbalance: weighted sum of std-dev per activity measure.
 * fragmentPenalty = số connected-component thừa trong mỗi district.
 * @internal
 */
function computeCost(
  zones: Zone[],
  assignment: ArrayLike<number>, // assignment[i] = districtId c?a zones[i]
  m: number,
  alpha: number,
  beta: number,
  adjMatrix?: AdjacencyMatrix, // optional ? khi c? ? t?nh contiguity penalty
  balanceWeights?: { customers: number; orders: number },
  objective?: 'p-center' | 'p-median',
  activityTotals?: ZoneActivityTotals,
): number {
  const weights = balanceWeights ?? { customers: 1.0, orders: 1.0 }
  const obj = objective ?? 'p-median' // p-median ???c khuy?n ngh? theo Salazar-Aguilar et al. (2011)

  // Nh?m c?c zones theo district
  const groups: Zone[][] = Array.from({ length: m }, () => [])
  const customerTotals = new Float64Array(m)
  const orderTotals = new Float64Array(m)
  for (let i = 0; i < zones.length; i++) {
    const dId = assignment[i]!
    if (dId < 0 || dId >= m) continue  // skip unassigned (dId=-1 mid-BFS)
    const zone = zones[i]!
    groups[dId]!.push(zone)
    const customerTotal = activityTotals ? activityTotals.customers[i]! : zoneCustomers(zone)
    const orderTotal = activityTotals ? activityTotals.orders[i]! : zoneOrders(zone)
    customerTotals[dId] = (customerTotals[dId] ?? 0) + customerTotal
    orderTotals[dId] = (orderTotals[dId] ?? 0) + orderTotal
  }

  // T?nh dispersion theo objective
  let dispersion: number
  if (obj === 'p-median') {
    // p-Median: t?ng kho?ng c?ch t? m?i zone ??n center district
    dispersion = 0
    for (let d = 0; d < m; d++) {
      const group = groups[d]!
      if (group.length === 0) continue
      const center = meanCoordinate(group.map((z) => z.centroid))
      for (const z of group) {
        dispersion += haversineDistance(z.centroid, center)
      }
    }
  } else {
    // p-Center: max diameter (default)
    dispersion = 0
    for (const group of groups) {
      if (group.length < 2) continue
      for (let a = 0; a < group.length - 1; a++) {
        for (let b = a + 1; b < group.length; b++) {
          const d = haversineDistance(
            group[a]!.centroid,
            group[b]!.centroid,
          )
          if (d > dispersion) dispersion = d
        }
      }
    }
  }

  // T?nh imbalance cho T?NG activity (weighted)
  let totalImbalance = 0

  if (weights.customers > 0) {
    const mean = customerTotals.reduce((s, c) => s + c, 0) / m
    const variance = customerTotals.reduce((s, c) => s + (c - mean) ** 2, 0) / m
    totalImbalance += weights.customers * Math.sqrt(variance)
  }

  if (weights.orders > 0) {
    const mean = orderTotals.reduce((s, c) => s + c, 0) / m
    const variance = orderTotals.reduce((s, c) => s + (c - mean) ** 2, 0) / m
    totalImbalance += weights.orders * Math.sqrt(variance)
  }

  // Contiguity penalty: ??m connected components th?a (BFS)
  let totalFragments = 0
  if (adjMatrix) {
    for (let d = 0; d < m; d++) {
      const groupIds = new Set(groups[d]!.map((z) => z.id))
      if (groupIds.size <= 1) continue

      const visited = new Set<string>()
      let components = 0
      for (const startId of groupIds) {
        if (visited.has(startId)) continue
        components++
        const queue = [startId]
        while (queue.length > 0) {
          const current = queue.pop()!
          if (visited.has(current)) continue
          visited.add(current)
          for (const neighborId of (adjMatrix[current] ?? [])) {
            if (groupIds.has(neighborId) && !visited.has(neighborId)) {
              queue.push(neighborId)
            }
          }
        }
      }
      totalFragments += Math.max(0, components - 1)
    }
  }

  const gamma = 500 // Very heavy penalty per disconnected fragment
                     // Connectivity is HARD CONSTRAINT per Salazar-Aguilar et al. (2011)
  return alpha * dispersion + beta * totalImbalance + gamma * totalFragments
}
// ==========================================
// INTERNAL: BFS SHORTEST PATH TO ASSIGNED
// ==========================================

/**
 * BFS trên full adjacency graph G=(V,E) để tìm đường đi ngắn nhất
 * từ zone `startIdx` đến zone đã-assigned gần nhất.
 *
 * Trả về path (danh sách index từ start → target) và districtId của target.
 * Nếu không có path (zone hoàn toàn cô lập), trả về null.
 *
 * Đây là cốt lõi của "Grow-to-Reach" strategy theo paper:
 * khi frontier BFS bị kẹt, tìm đường nối zone cô lập đến district gần nhất
 * qua graph adjacency, rồi gán toàn bộ đường đi → đảm bảo liên thông.
 *
 * @internal
 */
function bfsShortestPathToAssigned(
  zones: Zone[],
  adjMatrix: AdjacencyMatrix,
  idToIdx: Map<string, number>,
  assignment: Int32Array,
  startIdx: number,
): { path: number[]; targetDistrict: number } | null {
  // BFS from startIdx on the full adjacency graph
  const visited = new Set<number>([startIdx]);
  // Each entry: [currentIdx, pathFromStart]
  const queue: Array<[number, number[]]> = [[startIdx, [startIdx]]];

  while (queue.length > 0) {
    const [currentIdx, path] = queue.shift()!;
    const currentId = zones[currentIdx]!.id;

    for (const neighborId of (adjMatrix[currentId] ?? [])) {
      const nIdx = idToIdx.get(neighborId);
      if (nIdx === undefined || visited.has(nIdx)) continue;
      visited.add(nIdx);

      const newPath = [...path, nIdx];

      // Found an assigned zone → return path
      if (assignment[nIdx] !== -1) {
        return {
          path: newPath,
          targetDistrict: assignment[nIdx]!,
        };
      }

      // Continue BFS through unassigned zones
      queue.push([nIdx, newPath]);
    }
  }

  // No path found — zone is truly isolated in graph G
  return null;
}

// ==========================================
// QUALITY-FIRST REFINE HELPERS
// ==========================================

/**
 * Best-improvement refinement: qu?t to?n b? move h?p l? v? ch?n move t?t nh?t
 * ? m?i v?ng l?p. ?u ti?n ch?t l??ng h?n t?c ??.
 */
function refineByBestImprovement(
  zones: Zone[],
  initialAssignment: number[] | Int32Array,
  m: number,
  adjMatrix: AdjacencyMatrix,
  idToIdx: Map<string, number>,
  alpha: number,
  beta: number,
  balanceWeights?: { customers: number; orders: number },
  objective?: 'p-center' | 'p-median',
  activityTotals?: ZoneActivityTotals,
  maxIter = 500,
  onProgress?: ProgressCallback,
): { assignment: number[]; cost: number } {
  const assignment = Array.from(initialAssignment, (d) => Number(d));
  const districtSizes = new Array<number>(m).fill(0);
  for (const districtId of assignment) {
    districtSizes[districtId] = (districtSizes[districtId] ?? 0) + 1;
  }

  let currentCost = computeCost(
    zones,
    assignment,
    m,
    alpha,
    beta,
    adjMatrix,
    balanceWeights,
    objective,
    activityTotals,
  );

  for (let iter = 0; iter < maxIter; iter++) {
    let bestMove: null | {
      idx: number;
      from: number;
      to: number;
      cost: number;
    } = null;

    for (let i = 0; i < zones.length; i++) {
      const currentDistrict = assignment[i]!;
      if ((districtSizes[currentDistrict] ?? 0) <= 1) continue;

      const zoneId = zones[i]!.id;
      const neighborDistricts = new Set<number>();
      for (const neighborId of (adjMatrix[zoneId] ?? [])) {
        const nIdx = idToIdx.get(neighborId);
        if (nIdx !== undefined && assignment[nIdx] !== currentDistrict) {
          neighborDistricts.add(assignment[nIdx]!);
        }
      }
      if (neighborDistricts.size === 0) continue;

      for (const targetDistrict of neighborDistricts) {
        if (targetDistrict === currentDistrict) continue;

        assignment[i] = targetDistrict;
        const sourceStillConnected = isDistrictConnected(
          zones,
          assignment,
          currentDistrict,
          adjMatrix,
          idToIdx,
        );

        if (!sourceStillConnected) {
          assignment[i] = currentDistrict;
          continue;
        }

        const newCost = computeCost(
          zones,
          assignment,
          m,
          alpha,
          beta,
          adjMatrix,
          balanceWeights,
          objective,
          activityTotals,
        );

        assignment[i] = currentDistrict;

        if (newCost + 1e-9 < currentCost && (!bestMove || newCost + 1e-9 < bestMove.cost)) {
          bestMove = { idx: i, from: currentDistrict, to: targetDistrict, cost: newCost };
        }
      }
    }

    if (!bestMove) break;

    assignment[bestMove.idx] = bestMove.to;
    districtSizes[bestMove.from]!--;
    districtSizes[bestMove.to] = (districtSizes[bestMove.to] ?? 0) + 1;
    currentCost = bestMove.cost;
    onProgress?.(iter + 1, currentCost);
  }

  return { assignment, cost: currentCost };
}

// ==========================================
// THUẬT TOÁN 1 — GREEDY SEED EXPANSION
// ==========================================

/**
 * Phân vùng bằng Greedy Seed Expansion.
 *
 * Thuật toán:
 * 1. Chọn m seeds xa nhau nhất → làm "hạt nhân" của m districts.
 * 2. Vòng lặp BFS: mở rộng district theo adjacency matrix.
 *    - Với mỗi district, chọn neighbor zone chưa gán có nhiều customers nhất.
 * 3. Dừng khi tất cả zones đã được gán.
 *
 * @complexity O(m×n + n×k) — k = số lân cận trung bình.
 */
export function partitionGreedy(
  zones: Zone[],
  m: number,
  opts: PartitionOpts = {},
): Assignment[] {
  // --- PRECONDITIONS ---
  if (zones.length === 0) throw new PartitionError('zones must not be empty', 'NO_ZONES');
  if (m < 2) throw new PartitionError(`m must be >= 2, got ${m}`, 'M_TOO_SMALL');
  if (m > zones.length)
    throw new PartitionError(
      `m (${m}) must be <= zones.length (${zones.length})`, 'M_TOO_LARGE',
    );

  const { onProgress, adjThresholdKm = 0.12 } = opts;

  // Build strict adjacency matrix. Artificial bridge edges are intentionally not allowed.
  const adjMatrix: AdjacencyMatrix = buildAdjacencyMatrix(zones, adjThresholdKm);
  ensureConnectedInputGraph(zones, adjMatrix);

  // Map id → index để tra cứu O(1)
  const idToIdx = new Map<string, number>(zones.map((z, i) => [z.id, i]));
  const activityTotals = buildZoneActivityTotals(zones);

  // assignment[i] = districtId (-1 = chưa gán)
  const assignment = new Int32Array(zones.length).fill(-1);

  // Chọn seeds và gán district
  const seedIndices = selectFarthestSeeds(zones, m);
  for (let d = 0; d < m; d++) {
    assignment[seedIndices[d]!] = d;
  }

  // BFS Queues: một queue mỗi district, chứa các zone chưa gán lân cận
  // Dùng Set để dedup
  const frontiers: Set<number>[] = Array.from({ length: m }, () => new Set());
  for (let d = 0; d < m; d++) {
    const seedIdx = seedIndices[d]!;
    const seedId = zones[seedIdx]!.id;
    for (const neighborId of (adjMatrix[seedId] ?? [])) {
      const nIdx = idToIdx.get(neighborId);
      if (nIdx !== undefined && assignment[nIdx] === -1) {
        frontiers[d]!.add(nIdx);
      }
    }
  }

  let iter = 0;
  let unassigned = zones.length - m;

  while (unassigned > 0) {
    let progress = false;

    for (let d = 0; d < m && unassigned > 0; d++) {
      const frontier = frontiers[d]!;

      // Two-pass: snapshot frontier trước để tránh mutation trong khi iterate
      const candidates = Array.from(frontier);
      const stale: number[] = [];

      let bestIdx = -1;
      let bestCustomers = -1;
      for (const idx of candidates) {
        if (assignment[idx] !== -1) {
          stale.push(idx); // đánh dấu để xóa sau
          continue;
        }
        const c = zoneCustomers(zones[idx]!);
        if (c > bestCustomers) {
          bestCustomers = c;
          bestIdx = idx;
        }
      }
      for (const idx of stale) frontier.delete(idx);

      if (bestIdx === -1) continue; // frontier rỗng hoặc đã hết

      // Gán zone cho district d
      assignment[bestIdx] = d;
      frontier.delete(bestIdx);
      unassigned--;
      progress = true;

      // Mở rộng frontier
      const zoneId = zones[bestIdx]!.id;
      for (const neighborId of (adjMatrix[zoneId] ?? [])) {
        const nIdx = idToIdx.get(neighborId);
        if (nIdx !== undefined && assignment[nIdx] === -1) {
          frontiers[d]!.add(nIdx);
        }
      }
    }

    // ── GROW-TO-REACH (Paper-compliant) ──────────────────────────────
    // When BFS frontiers are exhausted but unassigned zones remain,
    // find the shortest path on the adjacency graph G=(V,E) from each
    // unassigned zone to the nearest assigned zone. Assign the entire
    // path to that district → guarantees contiguity.
    if (!progress) {
      // Collect all unassigned zone indices
      const unassignedIdxs: number[] = [];
      for (let i = 0; i < zones.length; i++) {
        if (assignment[i] === -1) unassignedIdxs.push(i);
      }

      for (const startIdx of unassignedIdxs) {
        if (assignment[startIdx] !== -1) continue; // already reached by a previous path

        // BFS on full adjacency graph to find shortest path to any assigned zone
        const pathResult = bfsShortestPathToAssigned(
          zones, adjMatrix, idToIdx, assignment, startIdx,
        );

        if (pathResult) {
          // Assign entire path to the target district (maintains contiguity)
          const { path, targetDistrict } = pathResult;
          for (const idx of path) {
            if (assignment[idx] === -1) {
              assignment[idx] = targetDistrict;
              unassigned--;

              // Update frontiers: add neighbors of newly assigned zone
              const zId = zones[idx]!.id;
              for (const neighborId of (adjMatrix[zId] ?? [])) {
                const nIdx = idToIdx.get(neighborId);
                if (nIdx !== undefined && assignment[nIdx] === -1) {
                  frontiers[targetDistrict]!.add(nIdx);
                }
              }
            }
          }
          progress = true;
        } else {
          throw new PartitionError(
            `zone "${zones[startIdx]!.id}" cannot reach any assigned zone in the adjacency graph`,
            'DISCONNECTED_GRAPH',
          );
        }
      }
    }

    iter++;
    if (onProgress) {
      const cost = computeCost(
        zones,
        assignment,
        m,
        0.5,
        0.5,
        adjMatrix,
        undefined,
        undefined,
        activityTotals,
      );
      onProgress(iter, cost);
    }
  }

  return zones.map((z, i) => ({
    zoneId: z.id,
    districtId: assignment[i]!,
  }));
}

// ==========================================
// INTERNAL: BFS CONNECTIVITY CHECK
// ==========================================

/**
 * BFS kiểm tra 1 district có liên thông không.
 * @internal
 */
export function isDistrictConnected(
  zones: Zone[],
  assignment: ArrayLike<number>,
  districtId: number,
  adjMatrix: AdjacencyMatrix,
  idToIdx: Map<string, number>,
): boolean {
  const membersIds: string[] = [];
  for (let i = 0; i < zones.length; i++) {
    if (assignment[i] === districtId) membersIds.push(zones[i]!.id);
  }
  if (membersIds.length <= 1) return true;

  const memberSet = new Set(membersIds);
  const visited = new Set<string>();
  const queue = [membersIds[0]!];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighborId of (adjMatrix[current] ?? [])) {
      if (memberSet.has(neighborId) && !visited.has(neighborId)) {
        queue.push(neighborId);
      }
    }
  }

  return visited.size === memberSet.size;
}

// ==========================================
// THUẬT TOÁN 2 — LOCAL SEARCH (2-OPT)
// ==========================================

/**
 * Phân vùng bằng Local Search 2-opt improvement.
 *
 * Thuật toán:
 * 1. Khởi tạo solution bằng partitionGreedy.
 * 2. Lặp đến convergence (hoặc maxIter):
 *    a. Với mỗi zone ở biên district:
 *       - Thử swap sang district lân cận
 *       - BFS verify district nguồn vẫn liên thông
 *       - Tính Δcost → nếu giảm → accept swap
 * 3. Dừng khi KHÔNG có swap nào cải thiện cost (local optimum).
 *
 * Đảm bảo: 100% connectivity (chỉ accept swap an toàn).
 * Deterministic (không random).
 *
 * @complexity O(maxIter × boundary_size × neighbor_count)
 */
export function partitionLocalSearch(
  zones: Zone[],
  m: number,
  opts: PartitionOpts = {},
): Assignment[] {
  // --- PRECONDITIONS ---
  if (zones.length === 0) throw new PartitionError('zones must not be empty', 'NO_ZONES');
  if (m < 2) throw new PartitionError(`m must be >= 2, got ${m}`, 'M_TOO_SMALL');
  if (m > zones.length)
    throw new PartitionError(`m (${m}) must be <= zones.length (${zones.length})`, 'M_TOO_LARGE');

  const { onProgress, alpha = 0.35, beta = 0.65, adjThresholdKm = 0.12, maxIter = 500, balanceWeights, objective } = opts;

  const adjMatrix: AdjacencyMatrix = buildAdjacencyMatrix(zones, adjThresholdKm);
  ensureConnectedInputGraph(zones, adjMatrix);
  const idToIdx = new Map<string, number>(zones.map((z, i) => [z.id, i]));
  const activityTotals = buildZoneActivityTotals(zones);

  // Kh?i t?o t? Greedy solution
  const greedyResult = partitionGreedy(zones, m, { adjThresholdKm });
  const assignment = new Array<number>(zones.length);
  for (const { zoneId, districtId } of greedyResult) {
    const idx = idToIdx.get(zoneId);
    if (idx !== undefined) assignment[idx] = districtId;
  }

  const refined = refineByBestImprovement(
    zones,
    assignment,
    m,
    adjMatrix,
    idToIdx,
    alpha,
    beta,
    balanceWeights,
    objective,
    activityTotals,
    maxIter,
    onProgress,
  );

  return zones.map((z, i) => ({
    zoneId: z.id,
    districtId: refined.assignment[i]!,
  }));
}

export function partitionSimulatedAnnealing(
  zones: Zone[],
  m: number,
  opts: PartitionOpts = {},
): Assignment[] {
  // --- PRECONDITIONS ---
  if (zones.length === 0) throw new PartitionError('zones must not be empty', 'NO_ZONES');
  if (m < 2) throw new PartitionError(`m must be >= 2, got ${m}`, 'M_TOO_SMALL');
  if (m > zones.length)
    throw new PartitionError(
      `m (${m}) must be <= zones.length (${zones.length})`, 'M_TOO_LARGE',
    );

  const {
    onProgress,
    initialTemp = 2000,
    cooling = 0.997,
    alpha = 0.35,
    beta = 0.65,
    adjThresholdKm = 0.12,
    maxIter = 10000,
    balanceWeights,
    objective,
  } = opts;

  if (cooling <= 0 || cooling >= 1)
    throw new PartitionError(`cooling must be in (0, 1), got ${cooling}`, 'INVALID_COOLING');
  if (initialTemp <= 0)
    throw new PartitionError(`initialTemp must be > 0, got ${initialTemp}`, 'INVALID_TEMP');

  const adjMatrix: AdjacencyMatrix = buildAdjacencyMatrix(zones, adjThresholdKm);
  ensureConnectedInputGraph(zones, adjMatrix);
  const idToIdx = new Map<string, number>(zones.map((z, i) => [z.id, i]));
  const activityTotals = buildZoneActivityTotals(zones);

  // Kh?i t?o t? Greedy solution r?i refine ch?t l??ng tr??c khi anneal
  const initialResult = partitionGreedy(zones, m, { adjThresholdKm });
  const warmupBudget = Math.max(0, Math.min(maxIter, Math.floor(maxIter * 0.1)));
  const warmupAssignment = new Array<number>(zones.length);
  for (const { zoneId, districtId } of initialResult) {
    const idx = idToIdx.get(zoneId);
    if (idx !== undefined) warmupAssignment[idx] = districtId;
  }

  const warmup = refineByBestImprovement(
    zones,
    warmupAssignment,
    m,
    adjMatrix,
    idToIdx,
    alpha,
    beta,
    balanceWeights,
    objective,
    activityTotals,
    warmupBudget,
    onProgress,
  );

  const assignment = Int32Array.from(warmup.assignment);
  let currentCost = warmup.cost;
  let bestAssignment = new Int32Array(assignment);
  let bestCost = currentCost;
  let T = initialTemp;
  let iter = 0;
  const remainingIter = Math.max(0, maxIter - warmupBudget);

  const districtSizes = new Array<number>(m).fill(0);
  for (const districtId of assignment) {
    districtSizes[districtId] = (districtSizes[districtId] ?? 0) + 1;
  }

  while (iter < remainingIter && T >= 1) {
    let bestMove: null | { idx: number; from: number; to: number; cost: number } = null;

    for (let i = 0; i < zones.length; i++) {
      const currentDistrict = assignment[i]!;
      if ((districtSizes[currentDistrict] ?? 0) <= 1) continue;

      const zoneId = zones[i]!.id;
      const neighborDistricts = new Set<number>();
      for (const neighborId of (adjMatrix[zoneId] ?? [])) {
        const nIdx = idToIdx.get(neighborId);
        if (nIdx !== undefined && assignment[nIdx] !== currentDistrict) {
          neighborDistricts.add(assignment[nIdx]!);
        }
      }
      if (neighborDistricts.size === 0) continue;

      for (const targetDistrict of neighborDistricts) {
        if (targetDistrict === currentDistrict) continue;

        assignment[i] = targetDistrict;
        const sourceStillConnected = isDistrictConnected(
          zones,
          assignment,
          currentDistrict,
          adjMatrix,
          idToIdx,
        );

        if (!sourceStillConnected) {
          assignment[i] = currentDistrict;
          continue;
        }

        const newCost = computeCost(
          zones,
          assignment,
          m,
          alpha,
          beta,
          adjMatrix,
          balanceWeights,
          objective,
          activityTotals,
        );

        assignment[i] = currentDistrict;

        if (!bestMove || newCost < bestMove.cost) {
          bestMove = { idx: i, from: currentDistrict, to: targetDistrict, cost: newCost };
        }
      }
    }

    if (!bestMove) break;

    assignment[bestMove.idx] = bestMove.to;
    districtSizes[bestMove.from]!--;
    districtSizes[bestMove.to] = (districtSizes[bestMove.to] ?? 0) + 1;

    const deltaE = bestMove.cost - currentCost;
    if (deltaE <= 0 || Math.random() < Math.exp(-deltaE / T)) {
      currentCost = bestMove.cost;
      if (currentCost < bestCost) {
        bestCost = currentCost;
        bestAssignment = new Int32Array(assignment);
      }
    } else {
      assignment[bestMove.idx] = bestMove.from;
      districtSizes[bestMove.from] = (districtSizes[bestMove.from] ?? 0) + 1;
      districtSizes[bestMove.to] = (districtSizes[bestMove.to] ?? 0) - 1;
    }

    T *= cooling;
    iter++;
    onProgress?.(iter, currentCost);
  }

  const finalRefine = refineByBestImprovement(
    zones,
    bestAssignment,
    m,
    adjMatrix,
    idToIdx,
    alpha,
    beta,
    balanceWeights,
    objective,
    activityTotals,
    Math.max(0, Math.floor(maxIter * 0.2)),
    onProgress,
  );

  return zones.map((z, i) => ({
    zoneId: z.id,
    districtId: finalRefine.assignment[i]!,
  }));
}

// ==========================================
// FACTORY — getPartitionFn
// ==========================================

/** Tên các thuật toán phân vùng được hỗ trợ. */
export type AlgorithmName = 'greedy' | 'local-search' | 'sa';

/**
 * Factory trả về PartitionFn tương ứng theo tên thuật toán.
 *
 * @example
 * ```ts
 * const fn = getPartitionFn('local-search');
 * const assignments = fn(zones, 5, { maxIter: 200 });
 * ```
 *
 * @throws PartitionError nếu tên thuật toán không hợp lệ.
 */
export function getPartitionFn(algo: AlgorithmName): PartitionFn {
  switch (algo) {
    case 'greedy':
      return partitionGreedy;
    case 'local-search':
      return partitionLocalSearch;
    case 'sa':
      return partitionSimulatedAnnealing;
    default: {
      const _never: never = algo;
      throw new PartitionError(`Unknown algorithm: "${String(_never)}"`, 'M_TOO_SMALL');
    }
  }
}

/**
 * Alias ngắn gọn cho partitionSimulatedAnnealing.
 * @public
 */
export const partitionSA = partitionSimulatedAnnealing;

/**
 * Helper: nhóm lại các zones theo cluster từ Assignment[].
 * @returns Map từ districtId → danh sách Zone.
 */
export function groupZonesByCluster(
  assignments: Assignment[],
  zones: Zone[],
  m: number,
): Map<number, Zone[]> {
  const zoneMap = new Map<string, Zone>(zones.map((z) => [z.id, z]));
  const groups = new Map<number, Zone[]>();
  for (let d = 0; d < m; d++) groups.set(d, []);
  for (const { zoneId, districtId } of assignments) {
    const zone = zoneMap.get(zoneId);
    if (zone) groups.get(districtId)?.push(zone);
  }
  return groups;
}

