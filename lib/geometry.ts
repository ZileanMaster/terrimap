/**
 * L1 — Geometry Engine
 *
 * Pure functions cho hệ thống Commercial Territory Design.
 * Import ONLY từ types/domain.ts (L0). Không import UI hay framework nào.
 *
 * Defensive Contracts:
 *  - Mọi hàm trả về `number` → luôn finite (không NaN, không ±Infinity).
 *  - Edge-cases (empty array, degenerate polygon, coincident coords) được xử lý tường minh.
 *  - Không có side effects — mọi hàm là pure function.
 *
 * @module geometry
 */

import type {
  Coordinate,
  Zone,
  AdjacencyMatrix,
  DistanceMatrix,
} from '../types/domain.js';

// ==========================================
// RE-EXPORT: Type alias "LatLng" = Coordinate
// (Cho phép caller dùng cả hai tên)
// ==========================================

/** @internal Alias của `Coordinate` để tương thích với convention LatLng. */
export type LatLng = Coordinate;

// Alias types cho matrix (tên ngắn hơn cho caller bên ngoài)
export type AdjMatrix = AdjacencyMatrix;
export type DistMatrix = DistanceMatrix;

// ==========================================
// ERROR TYPE
// ==========================================

/**
 * Lỗi do vi phạm contract của Geometry Engine.
 * Chỉ throw khi có lỗi lập trình (programming error), không throw với input hợp lệ edge-case.
 */
export class GeometryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeometryError';
  }
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

/** @internal Convert degrees to radians. O(1). */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ==========================================
// 1. HAVERSINE DISTANCE
// ==========================================

/**
 * Tính khoảng cách giữa 2 điểm trên mặt cầu theo công thức Haversine.
 *
 * @complexity O(1) — hằng số 7 phép tính lượng giác.
 *
 * Contracts:
 *  - a === b (cùng tọa độ) → 0 (không phải -0).
 *  - Cực Nam ↔ Cực Bắc → ~20 015 km (nửa chu vi Trái Đất).
 *  - Kết quả luôn finite và thuộc [0, ~20 015].
 *
 * @param a - Tọa độ điểm A (đã validate ở L0).
 * @param b - Tọa độ điểm B (đã validate ở L0).
 * @returns Khoảng cách tính bằng km, finite, >= 0.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6_371; // Bán kính Trái Đất (km), WGS-84 mean radius

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng;

  // Clamp [0, 1]: phòng floating-point noise khiến sqrt(-ε) = NaN
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));

  const dist = R * c;

  // Normalize -0 → 0 (Object.is(-0, 0) === false)
  return dist === 0 ? 0 : dist;
}

/**
 * Alias backward-compatible của `haversineDistance`.
 * Dùng trong các module cũ đã import `haversineKm`.
 *
 * @deprecated Dùng `haversineDistance` cho code mới.
 * @complexity O(1)
 */
export const haversineKm = haversineDistance;

// ==========================================
// 2. POLYGON CENTROID
// ==========================================

/**
 * Tính tâm hình học (centroid) của một polygon phẳng bằng Shoelace Formula.
 *
 * @complexity O(n) — n = số đỉnh của polygon.
 *
 * Contracts:
 *  - `coords.length === 0` → throw GeometryError.
 *  - `coords.length === 1` → trả về điểm duy nhất đó.
 *  - `coords.length === 2` → trả về trung điểm của đoạn thẳng.
 *  - Polygon degenerate (area = 0, tất cả điểm thẳng hàng) → fallback arithmetic mean.
 *  - Kết quả lat/lng luôn finite.
 *
 * Ghi chú: Shoelace Formula giả định tọa độ phẳng (lng, lat). Với các khu vực
 * nhỏ (territory cấp tỉnh/huyện), sai số so với spherical centroid < 0.1%.
 *
 * @param coords - Danh sách đỉnh của polygon theo thứ tự (có thể khép kín hoặc không).
 * @returns Tọa độ tâm hình học, finite, trong bounds lat[-90,90] lng[-180,180].
 * @throws {GeometryError} Nếu `coords` rỗng.
 */
export function polygonCentroid(coords: LatLng[]): LatLng {
  if (coords.length === 0) {
    throw new GeometryError('polygonCentroid requires at least 1 coordinate.');
  }

  // Edge-case: 1 điểm → trả về chính nó
  if (coords.length === 1) {
    return { lat: coords[0]!.lat, lng: coords[0]!.lng };
  }

  // Edge-case: 2 điểm → trung điểm
  if (coords.length === 2) {
    return {
      lat: (coords[0]!.lat + coords[1]!.lat) / 2,
      lng: (coords[0]!.lng + coords[1]!.lng) / 2,
    };
  }

  // Đảm bảo polygon khép kín (thêm điểm đầu vào cuối nếu cần)
  const pts: LatLng[] = [...coords];
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (first.lat !== last.lat || first.lng !== last.lng) {
    pts.push({ lat: first.lat, lng: first.lng });
  }

  // === Shoelace Formula ===
  // Tọa độ: x = lng, y = lat (convention GeoJSON)
  // Area = (1/2) * |Σ (x_i * y_{i+1} - x_{i+1} * y_i)|
  // Cx   = (1/6A) * Σ (x_i + x_{i+1}) * (x_i * y_{i+1} - x_{i+1} * y_i)
  // Cy   = (1/6A) * Σ (y_i + y_{i+1}) * (x_i * y_{i+1} - x_{i+1} * y_i)

  let area = 0;
  let cLng = 0;
  let cLat = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const xi = pts[i]!.lng;
    const yi = pts[i]!.lat;
    const xj = pts[i + 1]!.lng;
    const yj = pts[i + 1]!.lat;

    const cross = xi * yj - xj * yi;
    area += cross;
    cLng += (xi + xj) * cross;
    cLat += (yi + yj) * cross;
  }

  area /= 2;

  // Polygon degenerate (area ≈ 0): fallback về arithmetic mean để tránh /0
  if (Math.abs(area) < 1e-12) {
    let sumLat = 0;
    let sumLng = 0;
    // Dùng coords gốc (không bao gồm điểm khép kín thêm vào)
    for (const c of coords) {
      sumLat += c.lat;
      sumLng += c.lng;
    }
    return {
      lat: sumLat / coords.length,
      lng: sumLng / coords.length,
    };
  }

  const factor = 1 / (6 * area);
  const resultLng = factor * cLng;
  const resultLat = factor * cLat;

  // Sanity check: kết quả phải finite (không xảy ra với input hợp lệ)
  if (!Number.isFinite(resultLat) || !Number.isFinite(resultLng)) {
    throw new GeometryError(
      `polygonCentroid produced non-finite result (lat=${resultLat}, lng=${resultLng}). ` +
        'Check polygon for degenerate geometry.'
    );
  }

  return { lat: resultLat, lng: resultLng };
}

// ==========================================
// 3. ZONE DIAMETER
// ==========================================

/**
 * Tính đường kính của tập hợp Zones:
 * = khoảng cách lớn nhất giữa centroid của bất kỳ 2 Zone nào trong tập.
 * Đây là metric chính để tối ưu hóa phân vùng (nhỏ hơn = tốt hơn).
 *
 * @complexity O(n²) — n = số zones. Dùng triangular loop (n*(n-1)/2 iterations).
 *
 * Contracts:
 *  - `zones.length === 0` → 0 (không throw).
 *  - `zones.length === 1` → 0 (không throw).
 *  - 2 zones trùng centroid → 0 (không phải -0).
 *  - Kết quả cuối PHẢI finite — throw GeometryError nếu không (fail-fast sentinel).
 *
 * @param zones - Mảng các Zone (đã validate ở L0).
 * @returns Đường kính tính bằng km, finite, >= 0.
 * @throws {GeometryError} Nếu kết quả nội bộ non-finite (programming error).
 */
export function zoneDiameter(zones: Zone[]): number {
  if (zones.length === 0) return 0;
  if (zones.length === 1) return 0;

  let max = 0;

  for (let i = 0; i < zones.length - 1; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const d = haversineDistance(zones[i]!.centroid, zones[j]!.centroid);
      if (d > max) max = d;
    }
  }

  // Normalize -0 (defensive, haversineDistance đã handle nhưng giữ cho tường minh)
  const result = Object.is(max, -0) ? 0 : max;

  // Fail-fast sentinel: nếu có programming error ở tầng dưới sản sinh non-finite
  if (!Number.isFinite(result)) {
    throw new GeometryError(
      `zoneDiameter produced non-finite result (${result}) for ${zones.length} zones. ` +
        'This is a programming error — check haversineDistance inputs.'
    );
  }

  return result;
}

// ==========================================
// 4. BUILD ADJACENCY MATRIX
// ==========================================

/** Floating-point tolerance for coordinate comparison */
// Tolerance for floating-point coordinate comparison in edge matching.
// 1e-5 degrees ≈ 1.1 meters — handles Leaflet drawing imprecision
// (old value 1e-7 was too strict: failed for edges drawn by mouse ~1cm apart)
const COORD_EPS = 1e-5;

/**
 * Extract edges from a GeoJSON polygon as pairs of [lng, lat] points.
 * Handles both Polygon and MultiPolygon. Excludes the closing edge
 * (last→first) since GeoJSON ring is already closed (first === last).
 * @internal
 */
function extractEdges(polygon: Zone['polygon']): Array<[[number, number], [number, number]]> {
  const edges: Array<[[number, number], [number, number]]> = [];
  const rings = polygon.type === 'MultiPolygon'
    ? polygon.coordinates.flatMap((poly) => poly)
    : polygon.coordinates;

  for (const ring of rings) {
    // GeoJSON ring: first point === last point (closed), so iterate to length-1
    for (let k = 0; k < ring.length - 1; k++) {
      const p1 = ring[k]! as [number, number];
      const p2 = ring[k + 1]! as [number, number];
      edges.push([p1, p2]);
    }
  }
  return edges;
}

/**
 * Check if two edges share a common segment (same or reversed direction).
 * Uses epsilon tolerance for floating-point coordinate comparison.
 * @internal
 */
function edgesShareSegment(
  e1: [[number, number], [number, number]],
  e2: [[number, number], [number, number]],
): boolean {
  const [a, b] = e1;
  const [c, d] = e2;

  // Same direction: A≈C && B≈D
  const same =
    Math.abs(a[0]! - c[0]!) < COORD_EPS && Math.abs(a[1]! - c[1]!) < COORD_EPS &&
    Math.abs(b[0]! - d[0]!) < COORD_EPS && Math.abs(b[1]! - d[1]!) < COORD_EPS;

  // Reversed direction: A≈D && B≈C
  const reversed =
    Math.abs(a[0]! - d[0]!) < COORD_EPS && Math.abs(a[1]! - d[1]!) < COORD_EPS &&
    Math.abs(b[0]! - c[0]!) < COORD_EPS && Math.abs(b[1]! - c[1]!) < COORD_EPS;

  return same || reversed;
}

/**
 * Check if two edges overlap along a shared collinear segment (T-junctions).
 *
 * This detects cases where one edge is a SUB-SEGMENT of another, e.g.:
 *   e1: A=[105.800,21.065] → B=[105.830,21.065]  (long edge)
 *   e2: C=[105.820,21.065] → D=[105.843,21.065]  (partly overlapping edge)
 * These share a segment from 105.820 to 105.830 — but edgesShareSegment
 * returns false because endpoints differ. This function catches that case.
 *
 * Algorithm:
 *  1. Check that both endpoints of e2 lie on the line through e1 (collinear).
 *  2. Project e2 onto e1 and check the 1D overlap is > COORD_EPS.
 *
 * @internal
 */
function edgesOverlapCollinear(
  e1: [[number, number], [number, number]],
  e2: [[number, number], [number, number]],
): boolean {
  const [a, b] = e1;
  const [c, d] = e2;

  const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return false; // degenerate zero-length edge

  // Cross product: if |cross| / |e1| > COORD_EPS, the point is off-line
  const len = Math.sqrt(len2);
  const crossC = (c[0]! - a[0]!) * dy - (c[1]! - a[1]!) * dx;
  const crossD = (d[0]! - a[0]!) * dy - (d[1]! - a[1]!) * dx;
  if (Math.abs(crossC) > COORD_EPS * len || Math.abs(crossD) > COORD_EPS * len) return false;

  // Both c and d lie on the line through e1.
  // Project c and d onto e1 parametrically (t=0 at a, t=1 at b).
  const tc = ((c[0]! - a[0]!) * dx + (c[1]! - a[1]!) * dy) / len2;
  const td = ((d[0]! - a[0]!) * dx + (d[1]! - a[1]!) * dy) / len2;
  const tMin = Math.min(tc, td);
  const tMax = Math.max(tc, td);

  // e1 occupies t ∈ [0, 1]. Overlap is non-trivial if [0,1] ∩ [tMin,tMax] has length > eps.
  const overlapStart = Math.max(0, tMin);
  const overlapEnd   = Math.min(1, tMax);
  return overlapEnd - overlapStart > COORD_EPS;
}

/**
 * Check if two zones' polygons share at least one common edge segment.
 * Detects both:
 *   (a) Exact shared edges (same endpoints, same or reversed direction).
 *   (b) Partial shared edges / T-junctions (one edge overlaps a sub-segment
 *       of the other — common when user draws adjacent zones separately).
 *
 * Per paper G=(V,E): adjacency = sharing a boundary edge, NOT just a corner.
 * @internal
 */
function polygonsShareEdge(zoneA: Zone, zoneB: Zone): boolean {
  const edgesA = extractEdges(zoneA.polygon);
  const edgesB = extractEdges(zoneB.polygon);

  for (const eA of edgesA) {
    for (const eB of edgesB) {
      if (edgesShareSegment(eA, eB) || edgesOverlapCollinear(eA, eB)) return true;
    }
  }
  return false;
}

/**
 * Xây dựng ma trận kề (AdjacencyMatrix) cho tập zones.
 *
 * **Primary method**: Polygon edge-sharing — hai zones kề nhau nếu polygon
 * của chúng chia sẻ ít nhất một cạnh chung. Đúng theo paper Ríos-Mercado:
 *   G = (V, E) where E represents adjacency between blocks.
 *
 * **Fallback**: Nếu polygon adjacency tạo ra đồ thị không liên thông
 * (do polygon gaps), sử dụng distance-based threshold làm bổ sung.
 *
 * @complexity O(n² × e²) — n = zones, e = edges per polygon (~8).
 *   Cho 12 zones: ~66 pairs × 64 edge comparisons ≈ 4000 ops.
 *
 * Contracts:
 *  - Kết quả luôn symmetric: nếu A kề B thì B kề A.
 *  - Zone tự kề chính nó KHÔNG được thêm vào danh sách (no self-loops).
 *  - `zones.length === 0` → trả về `{}`.
 *  - Mọi zone đều có entry trong kết quả (dù array rỗng).
 *
 * @param zones - Mảng các Zone (đã validate ở L0).
 * @param _thresholdKm - Kept for backward compatibility. Ignored in primary mode.
 * @returns AdjacencyMatrix symmetric, mọi zone có ít nhất một entry (có thể rỗng).
 */
/**
 * Trích xuất tất cả các đỉnh (coordinates) từ polygon của một Zone.
 * @internal
 */
function extractVertices(polygon: Zone['polygon']): Coordinate[] {
  const vertices: Coordinate[] = [];
  const rings = polygon.type === 'MultiPolygon'
    ? polygon.coordinates.flatMap((poly) => poly)
    : polygon.coordinates;

  for (const ring of rings) {
    for (const pt of ring) {
      vertices.push({ lng: pt[0], lat: pt[1] });
    }
  }
  return vertices;
}

/**
 * Tính khoảng cách nhỏ nhất từ điểm P đến đoạn thẳng AB.
 * Tọa độ trong degree-space, kết quả xấp xỉ km dùng scale cố định cho VN.
 * @internal
 */
const KM_PER_DEG_LAT = 111.0;
const KM_PER_DEG_LNG = 103.5; // cos(21°) × 111 — Vietnam average

function pointToSegDistKm(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const pxk = px * KM_PER_DEG_LNG, pyk = py * KM_PER_DEG_LAT;
  const axk = ax * KM_PER_DEG_LNG, ayk = ay * KM_PER_DEG_LAT;
  const bxk = bx * KM_PER_DEG_LNG, byk = by * KM_PER_DEG_LAT;
  const dx = bxk - axk, dy = byk - ayk;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return Math.hypot(pxk - axk, pyk - ayk);
  const t = Math.max(0, Math.min(1, ((pxk - axk) * dx + (pyk - ayk) * dy) / len2));
  return Math.hypot(pxk - axk - t * dx, pyk - ayk - t * dy);
}

/**
 * Tính khoảng cách nhỏ nhất giữa hai đoạn thẳng (segment-to-segment).
 * = min của 4 điểm endpoint projected onto opposite segment.
 * @internal
 */
function segPairMinDistKm(
  e1: [[number, number], [number, number]],
  e2: [[number, number], [number, number]],
): number {
  const [a, b] = e1, [c, d] = e2;
  return Math.min(
    pointToSegDistKm(a[0]!, a[1]!, c[0]!, c[1]!, d[0]!, d[1]!),
    pointToSegDistKm(b[0]!, b[1]!, c[0]!, c[1]!, d[0]!, d[1]!),
    pointToSegDistKm(c[0]!, c[1]!, a[0]!, a[1]!, b[0]!, b[1]!),
    pointToSegDistKm(d[0]!, d[1]!, a[0]!, a[1]!, b[0]!, b[1]!),
  );
}

/**
 * Tính khoảng cách biên nhỏ nhất giữa hai Zone (segment-to-segment toàn bộ polygon).
 *
 * Khác với getMinVertexDistance (chỉ so sánh đỉnh-đỉnh), hàm này tính khoảng cách
 * nhỏ nhất giữa bất kỳ điểm nào trên cạnh của zoneA đến bất kỳ điểm nào trên cạnh
 * của zoneB. Điều này quan trọng cho polygon không đều (irregular): hai zone có thể
 * kề nhau tại giữa cạnh mà không có đỉnh nào gần nhau.
 *
 * Ví dụ: zone tam giác kề zone chữ V — cạnh của chúng gần nhau ở giữa nhưng
 * các vertex ở xa → getMinVertexDistance sẽ trả về giá trị lớn, bỏ sót adjacency.
 *
 * @internal
 */
export function getMinBoundaryDistKm(zoneA: Zone, zoneB: Zone): number {
  const edgesA = extractEdges(zoneA.polygon);
  const edgesB = extractEdges(zoneB.polygon);
  let minDist = Infinity;

  for (const eA of edgesA) {
    for (const eB of edgesB) {
      const d = segPairMinDistKm(eA, eB);
      if (d < minDist) {
        minDist = d;
        if (minDist < 1e-6) return minDist; // early exit if effectively 0
      }
    }
  }
  return minDist;
}

/**
 * Tính khoảng cách nhỏ nhất giữa bất kỳ cặp đỉnh nào của hai Zone.
 * @deprecated Dùng getMinBoundaryDistKm thay thế cho độ chính xác tốt hơn.
 * @internal
 */
function getMinVertexDistance(zoneA: Zone, zoneB: Zone): number {
  const vertsA = extractVertices(zoneA.polygon);
  const vertsB = extractVertices(zoneB.polygon);
  let minDistance = Infinity;

  for (const vA of vertsA) {
    for (const vB of vertsB) {
      const d = haversineDistance(vA, vB);
      if (d < minDistance) {
        minDistance = d;
      }
    }
  }
  return minDistance;
}

/**
 * Đếm số lượng thành phần liên thông trong ma trận kề hiện tại.
 * @internal
 */
function countConnectedComponents(zones: Zone[], matrix: AdjacencyMatrix): number {
  const visited = new Set<string>();
  let count = 0;

  for (const zone of zones) {
    if (!visited.has(zone.id)) {
      count++;
      const queue = [zone.id];
      visited.add(zone.id);
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++]!;
        const neighbors = matrix[curr] || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }
  return count;
}

export function buildAdjacencyMatrix(
  zones: Zone[],
  _thresholdKm?: number
): AdjacencyMatrix {
  // Khởi tạo: mọi zone có entry rỗng (đảm bảo kết quả luôn có đủ keys)
  const matrix: AdjacencyMatrix = {};
  for (const zone of zones) {
    matrix[zone.id] = [];
  }

  if (zones.length < 2) return matrix;

  // Primary: Polygon edge-sharing adjacency
  for (let i = 0; i < zones.length - 1; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const zi = zones[i]!;
      const zj = zones[j]!;

      if (polygonsShareEdge(zi, zj)) {
        matrix[zi.id]!.push(zj.id);
        matrix[zj.id]!.push(zi.id);
      }
    }
  }

  // Secondary (always-on): near-BOUNDARY adjacency for zones with drawing gaps ≤1km
  // Uses segment-to-segment min distance (not vertex-to-vertex) so irregular polygons
  // (triangles, V-shapes) are correctly detected as adjacent even when edges are close
  // at non-vertex points.
  // - Lower bound dist > 1e-6: excludes corner-only diagonal touch.
  // - Upper bound 1km: covers realistic hand-drawn zone gaps including
  //   streets (~30m), small rivers (~200m), vacant lots (~500m).
  const NEAR_BOUNDARY_KM = 1.0;
  for (let i = 0; i < zones.length - 1; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const zi = zones[i]!;
      const zj = zones[j]!;
      if (matrix[zi.id]!.includes(zj.id)) continue; // already adjacent
      const dist = getMinBoundaryDistKm(zi, zj);
      if (dist > 1e-6 && dist <= NEAR_BOUNDARY_KM) {
        matrix[zi.id]!.push(zj.id);
        matrix[zj.id]!.push(zi.id);
      }
    }
  }

  // Tertiary: ONLY if graph is still disconnected after primary + secondary.
  // Adds edges ≤2km to bridge large gaps (e.g., zones across major rivers/bridges).
  // 2km is strict enough to prevent false adjacency between different neighborhoods.
  const TERTIARY_KM = 2.0;
  const components = countConnectedComponents(zones, matrix);
  if (components > 1) {
    for (let i = 0; i < zones.length - 1; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const zi = zones[i]!;
        const zj = zones[j]!;
        if (matrix[zi.id]!.includes(zj.id)) continue;
        const dist = getMinBoundaryDistKm(zi, zj);
        if (dist > 1e-5 && dist <= TERTIARY_KM) {
          matrix[zi.id]!.push(zj.id);
          matrix[zj.id]!.push(zi.id);
        }
      }
    }
  }

  return matrix;
}

// ==========================================
// 5. BUILD DISTANCE MATRIX
// ==========================================

/**
 * Xây dựng ma trận khoảng cách đầy đủ N×N giữa tâm của tất cả các zones.
 *
 * @complexity O(n²) — n = số zones. Triangular loop: (n*(n-1)/2) phép tính,
 *   mỗi kết quả được ghi 2 lần (symmetric). Diagonal được ghi thêm n lần.
 *   Tổng memory: O(n²).
 *
 * Contracts:
 *  - distance[A][B] === distance[B][A] (symmetric).
 *  - distance[A][A] === 0 (diagonal = 0).
 *  - Mọi giá trị finite và >= 0.
 *  - `zones.length === 0` → trả về `{}`.
 *  - `zones.length === 1` → trả về `{ [id]: { [id]: 0 } }`.
 *
 * @param zones - Mảng các Zone (đã validate ở L0).
 * @returns DistanceMatrix N×N, symmetric, diagonal = 0, mọi giá trị finite >= 0.
 */
export function buildDistanceMatrix(zones: Zone[]): DistMatrix {
  // Khởi tạo: mọi zone có hàng riêng, diagonal = 0
  const matrix: DistMatrix = {};
  for (const zone of zones) {
    matrix[zone.id] = { [zone.id]: 0 };
  }

  // Triangular loop: tính mỗi cặp (i, j) một lần → ghi symmetric
  for (let i = 0; i < zones.length - 1; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const zi = zones[i]!;
      const zj = zones[j]!;
      const d = haversineDistance(zi.centroid, zj.centroid);

      // Symmetric assignment: O(1) per pair
      matrix[zi.id]![zj.id] = d;
      matrix[zj.id]![zi.id] = d;
    }
  }

  return matrix;
}

// ==========================================
// BACKWARD-COMPATIBLE EXPORT
// ==========================================

/**
 * Tính tọa độ trung bình (arithmetic mean) của một tập tọa độ.
 * `meanCoordinate` khác `polygonCentroid`: không dùng area-weighting.
 * Chỉ dùng nội bộ cho K-Means centroids. Dùng `polygonCentroid` cho centroid polygon thực.
 *
 * @complexity O(n) — n = số coordinates.
 * @throws {GeometryError} Nếu `coords` rỗng.
 */
export function meanCoordinate(coords: Coordinate[]): Coordinate {
  if (coords.length === 0) {
    throw new GeometryError('meanCoordinate requires at least 1 coordinate.');
  }

  let sumLat = 0;
  let sumLng = 0;

  for (const c of coords) {
    sumLat += c.lat;
    sumLng += c.lng;
  }

  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length,
  };
}

// ==========================================
// OVERLAP VALIDATION (L4b-4 Hotfix)
// ==========================================

/**
 * Check if a point [lng, lat] is inside a polygon ring [lng, lat][].
 * Uses ray-casting algorithm (Jordan curve theorem).
 *
 * @param point - [lng, lat] coordinate
 * @param ring  - Array of [lng, lat] coordinates forming a closed polygon
 * @returns true if point is strictly inside the polygon
 */
export function pointInPolygon(
  point: [number, number],
  ring: number[][],
): boolean {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;

    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if two polygon rings overlap.
 *
 * Returns true if:
 * 1. Any vertex of polygonA is inside polygonB, OR
 * 2. Any vertex of polygonB is inside polygonA, OR
 * 3. Any edges of the two polygons properly cross each other.
 *
 * Shared edges (touching endpoints) are NOT considered overlap —
 * segmentsIntersect only detects proper crossing.
 *
 * @param ringA - Outer ring of polygon A ([lng, lat][])
 * @param ringB - Outer ring of polygon B ([lng, lat][])
 */
export function polygonsOverlap(
  ringA: number[][],
  ringB: number[][],
): boolean {
  // Remove closing point if ring is closed (first === last)
  const stripClose = (ring: number[][]): number[][] => {
    if (ring.length > 1
      && ring[0]![0] === ring[ring.length - 1]![0]
      && ring[0]![1] === ring[ring.length - 1]![1]) {
      return ring.slice(0, -1);
    }
    return ring;
  };

  const a = stripClose(ringA);
  const b = stripClose(ringB);

  // Check vertices of A inside B
  for (const pt of a) {
    if (pointInPolygon(pt as [number, number], ringB)) return true;
  }

  // Check vertices of B inside A
  for (const pt of b) {
    if (pointInPolygon(pt as [number, number], ringA)) return true;
  }

  // Check edge proper intersections
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]!;
    const a2 = a[(i + 1) % a.length]!;
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j]!;
      const b2 = b[(j + 1) % b.length]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }

  return false;
}

/**
 * Check if two line segments properly intersect (crossing, not just touching).
 * Uses the cross-product orientation test.
 */
function segmentsIntersect(
  p1: number[], p2: number[],
  p3: number[], p4: number[],
): boolean {
  const d1 = crossDirection(p3, p4, p1);
  const d2 = crossDirection(p3, p4, p2);
  const d3 = crossDirection(p1, p2, p3);
  const d4 = crossDirection(p1, p2, p4);

  // Proper crossing: orientations differ on both sides
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

/** Cross product direction: (pk - pi) × (pj - pi) */
function crossDirection(pi: number[], pj: number[], pk: number[]): number {
  return (pk[0]! - pi[0]!) * (pj[1]! - pi[1]!) - (pj[0]! - pi[0]!) * (pk[1]! - pi[1]!);
}

