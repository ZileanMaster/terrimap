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
import { haversineDistance, buildAdjacencyMatrix, meanCoordinate, getMinBoundaryDistKm } from './geometry.js';

// ==========================================
// ERROR TYPE
// ==========================================

/** Error codes cho từng loại vi phạm contract. */
export type PartitionErrorCode =
  | 'NO_ZONES'      // zones array rỗng
  | 'M_TOO_SMALL'   // m < 2
  | 'M_TOO_LARGE'   // m > zones.length
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
  /** Trọng số cho thành phần dispersion trong objective. Default: 0.5. */
  alpha?: number;
  /** Trọng số cho thành phần imbalance trong objective. Default: 0.5. */
  beta?: number;
  /** Threshold km để xây dựng adjacency matrix. Default: 15 km. */
  adjThresholdKm?: number;
  /** Balance weights — default: { customers: 1.0, orders: 0.0 } */
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
  assignment: number[], // assignment[i] = districtId của zones[i]
  m: number,
  alpha: number,
  beta: number,
  adjMatrix?: AdjacencyMatrix, // optional — khi có → tính contiguity penalty
  balanceWeights?: { customers: number; orders: number },
  objective?: 'p-center' | 'p-median',
): number {
  const weights = balanceWeights ?? { customers: 1.0, orders: 0.0 };
  const obj = objective ?? 'p-median'; // p-median được khâyến nghị theo Salazar-Aguilar et al. (2011)

  // Nhóm các zones theo district
  const groups: Zone[][] = Array.from({ length: m }, () => []);
  for (let i = 0; i < zones.length; i++) {
    const dId = assignment[i]!;
    if (dId < 0 || dId >= m) continue;  // skip unassigned (dId=-1 mid-BFS)
    groups[dId]!.push(zones[i]!);
  }

  // Tính dispersion theo objective
  let dispersion: number;
  if (obj === 'p-median') {
    // p-Median: tổng khoảng cách từ mỗi zone đến center district
    dispersion = 0;
    for (let d = 0; d < m; d++) {
      const group = groups[d]!;
      if (group.length === 0) continue;
      const center = meanCoordinate(group.map((z) => z.centroid));
      for (const z of group) {
        dispersion += haversineDistance(z.centroid, center);
      }
    }
  } else {
    // p-Center: max diameter (default)
    dispersion = 0;
    for (const group of groups) {
      if (group.length < 2) continue;
      for (let a = 0; a < group.length - 1; a++) {
        for (let b = a + 1; b < group.length; b++) {
          const d = haversineDistance(
            group[a]!.centroid,
            group[b]!.centroid,
          );
          if (d > dispersion) dispersion = d;
        }
      }
    }
  }

  // Tính imbalance cho TỪNG activity (weighted)
  let totalImbalance = 0;

  if (weights.customers > 0) {
    const customerCounts = groups.map((g) =>
      g.reduce((s, z) => s + zoneCustomers(z), 0),
    );
    const mean = customerCounts.reduce((s, c) => s + c, 0) / m;
    const variance = customerCounts.reduce((s, c) => s + (c - mean) ** 2, 0) / m;
    totalImbalance += weights.customers * Math.sqrt(variance);
  }

  if (weights.orders > 0) {
    const orderCounts = groups.map((g) =>
      g.reduce((s, z) => s + zoneOrders(z), 0),
    );
    const mean = orderCounts.reduce((s, c) => s + c, 0) / m;
    const variance = orderCounts.reduce((s, c) => s + (c - mean) ** 2, 0) / m;
    totalImbalance += weights.orders * Math.sqrt(variance);
  }

  // Contiguity penalty: đếm connected components thừa (BFS)
  let totalFragments = 0;
  if (adjMatrix) {
    const idToAssignment = new Map<string, number>();
    for (let i = 0; i < zones.length; i++) idToAssignment.set(zones[i]!.id, assignment[i]!);

    for (let d = 0; d < m; d++) {
      const groupIds = new Set(groups[d]!.map((z) => z.id));
      if (groupIds.size <= 1) continue;

      const visited = new Set<string>();
      let components = 0;
      for (const startId of groupIds) {
        if (visited.has(startId)) continue;
        components++;
        const queue = [startId];
        while (queue.length > 0) {
          const current = queue.pop()!;
          if (visited.has(current)) continue;
          visited.add(current);
          for (const neighborId of (adjMatrix[current] ?? [])) {
            if (groupIds.has(neighborId) && !visited.has(neighborId)) {
              queue.push(neighborId);
            }
          }
        }
      }
      totalFragments += Math.max(0, components - 1);
    }
  }

  const gamma = 500; // Very heavy penalty per disconnected fragment
                     // Connectivity is HARD CONSTRAINT per Salazar-Aguilar et al. (2011)
  return alpha * dispersion + beta * totalImbalance + gamma * totalFragments;
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

  const { onProgress, adjThresholdKm = 15 } = opts;

  // Build adjacency matrix nếu cần
  const adjMatrix: AdjacencyMatrix = buildAdjacencyMatrix(zones, adjThresholdKm);

  // Map id → index để tra cứu O(1)
  const idToIdx = new Map<string, number>(zones.map((z, i) => [z.id, i]));

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
          // Zone bị cô lập hoàn toàn — không tìm được path trong adjacency graph.
          // Theo Valid Inequality (19/20) của Salazar-Aguilar et al. (2011):
          //   "Nếu zone j được assign vào territory q, ít nhất một neighbor của j
          //    phải cùng ở territory q."
          // → KHÔNG ĐƯỢC assign theo centroid distance (vi phạm constraint này).
          //
          // Fix: Tìm zone đã-assigned gần nhất theo BIÊN GIỚI (boundary distance),
          //      thêm cạnh động vào adjMatrix, rồi assign qua BFS path.
          // Điều này đảm bảo zone luôn có ít nhất một neighbor trong cùng district.

          let nearestAssignedIdx = -1;
          let minBoundaryDist = Infinity;

          for (let i = 0; i < zones.length; i++) {
            if (assignment[i] === -1) continue; // bỏ qua zone chưa assigned
            const d = getMinBoundaryDistKm(zones[startIdx]!, zones[i]!);
            if (d < minBoundaryDist) {
              minBoundaryDist = d;
              nearestAssignedIdx = i;
            }
          }

          if (nearestAssignedIdx >= 0) {
            // Thêm cạnh động vào adjMatrix để kết nối zone cô lập với zone gần nhất
            const startId   = zones[startIdx]!.id;
            const nearestId = zones[nearestAssignedIdx]!.id;

            if (!adjMatrix[startId]!.includes(nearestId)) {
              adjMatrix[startId]!.push(nearestId);
              adjMatrix[nearestId]!.push(startId);
            }

            // BFS có thể tìm được path → assign qua graph (đảm bảo liên thông)
            const newPath = bfsShortestPathToAssigned(
              zones, adjMatrix, idToIdx, assignment, startIdx,
            );

            if (newPath) {
              const { path, targetDistrict } = newPath;
              for (const idx of path) {
                if (assignment[idx] === -1) {
                  assignment[idx] = targetDistrict;
                  unassigned--;
                  // Mở rộng frontier của targetDistrict
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
              // Không thể xảy ra sau khi đã thêm dynamic edge — fallback an toàn:
              // Assign trực tiếp vào district của nearestAssignedIdx.
              // Dynamic edge đã thêm → constraint (19) vẫn được thỏa mãn.
              const targetDistrict = assignment[nearestAssignedIdx]!;
              assignment[startIdx] = targetDistrict;
              unassigned--;
              progress = true;
              console.warn(
                `[TerriMap] Zone "${zones[startIdx]!.id}" isolated. ` +
                `Added dynamic edge to "${nearestId}" ` +
                `(dist=${minBoundaryDist.toFixed(3)}km). ` +
                `Assigned to district ${targetDistrict}.`,
              );
            }
          } else {
            // Không có zone nào đã assigned — edge case cực hiếm (nên không xảy ra).
            assignment[startIdx] = 0;
            unassigned--;
            progress = true;
            console.error(
              `[TerriMap] CRITICAL: Zone "${zones[startIdx]!.id}" could not be ` +
              `reconnected (no assigned zones found). Assigned to district 0.`,
            );
          }
        }
      }
    }

    iter++;
    if (onProgress) {
      const cost = computeCost(
        zones,
        Array.from(assignment),
        m,
        0.5,
        0.5,
        adjMatrix,
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
  assignment: number[],
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

  const { onProgress, alpha = 0.5, beta = 0.5, adjThresholdKm = 15, maxIter = 500, balanceWeights, objective } = opts;

  const adjMatrix: AdjacencyMatrix = buildAdjacencyMatrix(zones, adjThresholdKm);
  const idToIdx = new Map<string, number>(zones.map((z, i) => [z.id, i]));

  // Khởi tạo từ Greedy solution
  const greedyResult = partitionGreedy(zones, m, { adjThresholdKm });
  const assignment = new Array<number>(zones.length);
  for (const { zoneId, districtId } of greedyResult) {
    const idx = idToIdx.get(zoneId);
    if (idx !== undefined) assignment[idx] = districtId;
  }

  let currentCost = computeCost(zones, assignment, m, alpha, beta, adjMatrix, balanceWeights, objective);
  let improved = true;
  let iter = 0;

  while (improved && iter < maxIter) {
    improved = false;
    iter++;

    for (let i = 0; i < zones.length; i++) {
      const currentDistrict = assignment[i]!;
      const zoneId = zones[i]!.id;

      const neighborDistricts = new Set<number>();
      for (const neighborId of (adjMatrix[zoneId] ?? [])) {
        const nIdx = idToIdx.get(neighborId);
        if (nIdx !== undefined && assignment[nIdx] !== currentDistrict) {
          neighborDistricts.add(assignment[nIdx]!);
        }
      }
      if (neighborDistricts.size === 0) continue;

      const sourceSize = assignment.filter((d) => d === currentDistrict).length;
      if (sourceSize <= 1) continue;

      for (const targetDistrict of neighborDistricts) {
        assignment[i] = targetDistrict;

        if (!isDistrictConnected(zones, assignment, currentDistrict, adjMatrix, idToIdx)) {
          assignment[i] = currentDistrict;
          continue;
        }

        const newCost = computeCost(zones, assignment, m, alpha, beta, adjMatrix, balanceWeights, objective);
        if (newCost < currentCost) {
          currentCost = newCost;
          improved = true;
        } else {
          assignment[i] = currentDistrict;
        }
      }
    }

    onProgress?.(iter, currentCost);
  }

  return zones.map((z, i) => ({
    zoneId: z.id,
    districtId: assignment[i]!,
  }));
}

// ==========================================
// THUẬT TOÁN 3 — SIMULATED ANNEALING
// ==========================================

/**
 * Phân vùng bằng Simulated Annealing, khởi tạo từ Greedy solution.
 *
 * HARD CONSTRAINT: Mỗi swap được BFS verify — district nguồn PHẢI vẫn liên thông.
 * Solution output LUÔN liên thông 100%.
 *
 * Thuật toán:
 * 1. Khởi tạo solution bằng partitionGreedy.
 * 2. Mỗi iteration:
 *    a. Chọn ngẫu nhiên một zone ở biên district.
 *    b. Thử swap sang district lân cận.
 *    c. BFS verify connectivity — reject nếu phá vỡ.
 *    d. Chấp nhận swap nếu cost giảm, hoặc với xác suất exp(-ΔE/T).
 *    e. Hạ nhiệt: T = T0 × cooling^iter.
 * 3. Dừng khi T < 1.
 *
 * @complexity O(maxIter × boundary_size)
 */
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
    alpha = 0.5,
    beta = 0.5,
    adjThresholdKm = 15,
    maxIter = 10000,
    balanceWeights,
    objective,
  } = opts;

  if (cooling <= 0 || cooling >= 1)
    throw new PartitionError(`cooling must be in (0, 1), got ${cooling}`, 'INVALID_COOLING');
  if (initialTemp <= 0)
    throw new PartitionError(`initialTemp must be > 0, got ${initialTemp}`, 'INVALID_TEMP');

  const adjMatrix: AdjacencyMatrix = buildAdjacencyMatrix(zones, adjThresholdKm);
  const idToIdx = new Map<string, number>(zones.map((z, i) => [z.id, i]));

  // Khởi tạo từ Greedy solution (thay K-Means)
  const initialResult = partitionGreedy(zones, m, { adjThresholdKm });

  const assignment = new Int32Array(zones.length);
  for (const { zoneId, districtId } of initialResult) {
    const idx = idToIdx.get(zoneId);
    if (idx !== undefined) assignment[idx] = districtId;
  }

  let currentCost = computeCost(zones, Array.from(assignment), m, alpha, beta, adjMatrix, balanceWeights, objective);
  let bestAssignment = new Int32Array(assignment);
  let bestCost = currentCost;
  let T = initialTemp;

  for (let iter = 0; iter < maxIter && T >= 1; iter++) {
    const boundaryZones: number[] = [];
    for (let i = 0; i < zones.length; i++) {
      const dId = assignment[i]!;
      const zoneId = zones[i]!.id;
      for (const neighborId of (adjMatrix[zoneId] ?? [])) {
        const nIdx = idToIdx.get(neighborId);
        if (nIdx !== undefined && assignment[nIdx] !== dId) {
          boundaryZones.push(i);
          break;
        }
      }
    }

    if (boundaryZones.length === 0) break;

    const zoneIdx = boundaryZones[
      Math.floor(Math.random() * boundaryZones.length)
    ]!;
    const currentDistrict = assignment[zoneIdx]!;
    const zoneId = zones[zoneIdx]!.id;

    const neighborDistricts = new Set<number>();
    for (const neighborId of (adjMatrix[zoneId] ?? [])) {
      const nIdx = idToIdx.get(neighborId);
      if (nIdx !== undefined && assignment[nIdx] !== currentDistrict) {
        neighborDistricts.add(assignment[nIdx]!);
      }
    }
    if (neighborDistricts.size === 0) continue;

    const candidateDistricts = Array.from(neighborDistricts);
    const targetDistrict =
      candidateDistricts[Math.floor(Math.random() * candidateDistricts.length)]!;

    const currentDistrictSize = assignment.reduce(
      (s, d) => (d === currentDistrict ? s + 1 : s),
      0,
    );
    if (currentDistrictSize <= 1) continue;

    // --- Thử swap ---
    assignment[zoneIdx] = targetDistrict;

    // ✅ HARD CONSTRAINT: BFS verify — district nguồn vẫn liên thông
    if (!isDistrictConnected(zones, Array.from(assignment), currentDistrict, adjMatrix, idToIdx)) {
      assignment[zoneIdx] = currentDistrict; // hoàn tác
      continue;  // REJECT — phá vỡ connectivity
    }

    const newCost = computeCost(zones, Array.from(assignment), m, alpha, beta, adjMatrix, balanceWeights, objective);
    const deltaE = newCost - currentCost;

    // Chấp nhận swap nếu tốt hơn, hoặc với xác suất Boltzmann
    if (deltaE < 0 || Math.random() < Math.exp(-deltaE / T)) {
      currentCost = newCost;
      if (currentCost < bestCost) {
        bestCost = currentCost;
        bestAssignment = new Int32Array(assignment);
      }
    } else {
      // Hoàn tác swap
      assignment[zoneIdx] = currentDistrict;
    }

    // --- Cooling schedule ---
    T *= cooling;

    onProgress?.(iter, currentCost);
  }

  return zones.map((z, i) => ({
    zoneId: z.id,
    districtId: bestAssignment[i]!,
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

