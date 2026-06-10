import type {
  Coordinate,
  Zone,
  AdjacencyMatrix,
  DistanceMatrix,
} from '../types/domain.js';

/** @internal Alias của `Coordinate` để tương thích với convention LatLng. */
export type LatLng = Coordinate;

// Alias types cho matrix (tên ngắn hơn cho caller bên ngoài)
export type AdjMatrix = AdjacencyMatrix;
export type DistMatrix = DistanceMatrix;

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


/** @internal Convert degrees to radians. O(1). */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Tính khoảng cách giữa 2 điểm trên mặt cầu theo công thức Haversine.
 * Contracts:
 *  - a === b (cùng tọa độ) -> 0
 *  - Cực Nam <-> Cực Bắc -> ~20 015 km (nửa chu vi Trái Đất).
 *  - Kết quả luôn finite và thuộc [0, ~20 015].
 *
 * @param a - Tọa độ điểm A 
 * @param b - Tọa độ điểm B 
 * @returns Khoảng cách tính bằng km, finite, >= 0.
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6_371; // Bán kính trái đất (km)

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

  // Normalize -0 -> 0 (Object.is(-0, 0) === false)
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
//Tính tâm hình học (centroid) của một polygon phẳng bằng Shoelace Formula.

export function polygonCentroid(coords: LatLng[]): LatLng {
  if (coords.length === 0) {
    throw new GeometryError('polygonCentroid requires at least 1 coordinate.');
  }

  // Edge-case: 1 điểm -> trả về chính nó
  if (coords.length === 1) {
    return { lat: coords[0]!.lat, lng: coords[0]!.lng };
  }

  // Edge-case: 2 điểm -> trung điểm
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

  // Shoelace Formula
  // Tọa độ: x = lng, y = lat
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

  // Sanity check: kết quả phải finite
  if (!Number.isFinite(resultLat) || !Number.isFinite(resultLng)) {
    throw new GeometryError(
      `polygonCentroid produced non-finite result (lat=${resultLat}, lng=${resultLng}). ` +
        'Check polygon for degenerate geometry.'
    );
  }

  return { lat: resultLat, lng: resultLng };
}

/**
 * Tính đường kính của tập hợp Zones:
 * = khoảng cách lớn nhất giữa centroid của bất kỳ 2 Zone nào trong tập.
 * Đây là metric chính để tối ưu hóa phân vùng (nhỏ hơn = tốt hơn).
 *
 * @complexity O(n²) - n = số zones. Dùng triangular loop (n*(n-1)/2 iterations).
 *
 * Contracts:
 *  - `zones.length === 0 -> 0 (không throw)
 *  - `zones.length === 1 -> 0 (không throw)
 *  - 2 zones trùng centroid -> 0 (không phải -0).
 *  - Kết quả cuối PHẢI finite - throw GeometryError nếu không (fail-fast sentinel)
 *
 * @param zones - Mảng các Zone 
 * @returns Đường kính tính bằng km, finite, >= 0
 * @throws {GeometryError} Nếu kết quả nội bộ non-finite (programming error)
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
        'This is a programming error - check haversineDistance inputs.'
    );
  }

  return result;
}

const COORD_EPS = 1e-5;

function extractEdges(polygon: Zone['polygon']): Array<[[number, number], [number, number]]> {
  const edges: Array<[[number, number], [number, number]]> = [];
  const rings = polygon.type === 'MultiPolygon'
    ? polygon.coordinates.flatMap((poly) => poly)
    : polygon.coordinates;

  for (const ring of rings) {
    for (let k = 0; k < ring.length - 1; k++) {
      const p1 = ring[k]! as [number, number];
      const p2 = ring[k + 1]! as [number, number];
      edges.push([p1, p2]);
    }
  }
  return edges;
}

function edgesShareSegment(
  e1: [[number, number], [number, number]],
  e2: [[number, number], [number, number]],
): boolean {
  const [a, b] = e1;
  const [c, d] = e2;

  // Cùng hướng: A≈C && B≈D
  const same =
    Math.abs(a[0]! - c[0]!) < COORD_EPS && Math.abs(a[1]! - c[1]!) < COORD_EPS &&
    Math.abs(b[0]! - d[0]!) < COORD_EPS && Math.abs(b[1]! - d[1]!) < COORD_EPS;

  // Ngược hướng: A≈D && B≈C
  const reversed =
    Math.abs(a[0]! - d[0]!) < COORD_EPS && Math.abs(a[1]! - d[1]!) < COORD_EPS &&
    Math.abs(b[0]! - c[0]!) < COORD_EPS && Math.abs(b[1]! - c[1]!) < COORD_EPS;

  return same || reversed;
}

function edgesOverlapCollinear(
  e1: [[number, number], [number, number]],
  e2: [[number, number], [number, number]],
): boolean {
  const [a, b] = e1;
  const [c, d] = e2;

  const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return false;

  const len = Math.sqrt(len2);
  const crossC = (c[0]! - a[0]!) * dy - (c[1]! - a[1]!) * dx;
  const crossD = (d[0]! - a[0]!) * dy - (d[1]! - a[1]!) * dx;
  if (Math.abs(crossC) > COORD_EPS * len || Math.abs(crossD) > COORD_EPS * len) return false;

  const tc = ((c[0]! - a[0]!) * dx + (c[1]! - a[1]!) * dy) / len2;
  const td = ((d[0]! - a[0]!) * dx + (d[1]! - a[1]!) * dy) / len2;
  const tMin = Math.min(tc, td);
  const tMax = Math.max(tc, td);

  // e1 occupies t ∈ [0, 1]. Overlap is non-trivial if [0,1] ∩ [tMin,tMax] has length > eps.
  const overlapStart = Math.max(0, tMin);
  const overlapEnd   = Math.min(1, tMax);
  return overlapEnd - overlapStart > COORD_EPS;
}

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
 * Xây dựng ma trận kề (AdjacencyMatrix) cho tập zones
 * 2 zones kề nhau nếu polygon của chúng chia sẻ ít nhất một cạnh chung.
 * **Fallback**: Nếu polygon adjacency tạo ra đồ thị không liên thông thì sử dụng distance-based threshold làm bổ sung.
 *
 * @complexity O(n² × e²) - n = zones, e = edges per polygon (~8).
 *   Cho 12 zones: ~66 pairs × 64 edge comparisons ≈ 4000 ops.
 *
 * @param zones - Mảng các Zone
 * @param _thresholdKm
 * @returns AdjacencyMatrix symmetric, mọi zone có ít nhất một entry (có thể rỗng).
 */
/**
 * Trích xuất tất cả các đỉnh) từ polygon của 1 Zone.
 * @internal
 */
function extractVertices(polygon: Zone['polygon']): Coordinate[] {
  const vertices: Coordinate[] = [];
  const rings = polygon.type === 'MultiPolygon'
    ? polygon.coordinates.flatMap((poly) => poly)
    : polygon.coordinates;

  for (const ring of rings) {
    for (const pt of ring) {
      const [lng, lat] = pt;
      if (lng === undefined || lat === undefined) {
        throw new Error('Invalid polygon coordinate: expected [lng, lat]');
      }
      vertices.push({ lng, lat });
    }
  }
  return vertices;
}

// Tính khoảng cách nhỏ nhất từ điểm P đến đoạn thẳng AB.
const KM_PER_DEG_LAT = 111.0;
const KM_PER_DEG_LNG = 103.5; // cos(21°) × 111 - Vietnam average

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
 * Tính khoảng cách nhỏ nhất giữa hai đoạn thẳng.
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
 * Tính khoảng cách biên nhỏ nhất giữa hai Zones, dùng để phát hiện adjacency bổ sung cho các polygon có khe hở nhỏ.
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

  const NEAR_BOUNDARY_KM = Number.isFinite(_thresholdKm as number) && (_thresholdKm as number) > 0
    ? (_thresholdKm as number)
    : 0.12;
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

  return matrix;
}

// 5. Ma trận khoảng cách giữa các cặp zones


export function buildDistanceMatrix(zones: Zone[]): DistMatrix {
  // Khởi tạo: mọi zone có hàng riêng, diagonal = 0
  const matrix: DistMatrix = {};
  for (const zone of zones) {
    matrix[zone.id] = { [zone.id]: 0 };
  }

  // Triangular loop: tính mỗi cặp (i, j) một lần -> ghi symmetric
  for (let i = 0; i < zones.length - 1; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const zi = zones[i]!;
      const zj = zones[j]!;
      const d = haversineDistance(zi.centroid, zj.centroid);

      matrix[zi.id]![zj.id] = d;
      matrix[zj.id]![zi.id] = d;
    }
  }

  return matrix;
}

// BACKWARD-COMPATIBLE EXPORT

/**
 * Tính tọa độ trung bình (arithmetic mean) của một tập tọa độ.
 * `meanCoordinate` khác `polygonCentroid`: không dùng area-weighting.
 * Chỉ dùng nội bộ cho các phép tính trung bình tọa độ. Dùng `polygonCentroid` cho centroid polygon thực.
 *
 * @complexity O(n) - n = số coordinates.
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

// OVERLAP VALIDATION

export function pointInPolygon(
  point: [number, number],
  ring: number[][],
): boolean {
  if (pointOnRingBoundary(point, ring)) return false;

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

  // Identical/coincident polygons overlap by area even though they have no
  // proper edge crossing and every vertex lies on the boundary.
  if (a.length > 0 && b.length > 0
    && a.every((pt) => pointOnRingBoundary(pt, b))
    && b.every((pt) => pointOnRingBoundary(pt, a))) {
    return true;
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

function pointOnRingBoundary(point: number[], ring: number[][]): boolean {
  if (ring.length < 2) return false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (pointOnSegment(point, a, b)) return true;
  }
  return false;
}

function pointOnSegment(point: number[], a: number[], b: number[]): boolean {
  const cross = crossDirection(a, b, point);
  if (Math.abs(cross) > COORD_EPS) return false;

  const minX = Math.min(a[0]!, b[0]!) - COORD_EPS;
  const maxX = Math.max(a[0]!, b[0]!) + COORD_EPS;
  const minY = Math.min(a[1]!, b[1]!) - COORD_EPS;
  const maxY = Math.max(a[1]!, b[1]!) + COORD_EPS;

  return point[0]! >= minX && point[0]! <= maxX
    && point[1]! >= minY && point[1]! <= maxY;
}

export function polygonSelfIntersects(ring: number[][]): boolean {
  const points = ring.length > 1
    && ring[0]![0] === ring[ring.length - 1]![0]
    && ring[0]![1] === ring[ring.length - 1]![1]
    ? ring.slice(0, -1)
    : ring;

  if (points.length < 4) return false;

  for (let i = 0; i < points.length; i++) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % points.length]!;

    for (let j = i + 1; j < points.length; j++) {
      const isAdjacent = Math.abs(i - j) === 1 || (i === 0 && j === points.length - 1);
      if (isAdjacent) continue;

      const b1 = points[j]!;
      const b2 = points[(j + 1) % points.length]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }

  return false;
}

export type PolygonTopologyViolation =
  | { type: 'SELF_INTERSECTION'; zoneId: string; ringIndex: number }
  | { type: 'OVERLAP'; zoneAId: string; zoneBId: string };

function getPolygonRings(zone: Zone): number[][][] {
  if (zone.polygon.type === 'Polygon') {
    return zone.polygon.coordinates;
  }
  return zone.polygon.coordinates.flatMap((poly) => poly);
}

export function findPolygonTopologyViolations(zones: Zone[]): PolygonTopologyViolation[] {
  const violations: PolygonTopologyViolation[] = [];

  for (const zone of zones) {
    const rings = getPolygonRings(zone);
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
      const ring = rings[ringIndex]!;
      if (polygonSelfIntersects(ring)) {
        violations.push({ type: 'SELF_INTERSECTION', zoneId: zone.id, ringIndex });
      }
    }
  }

  for (let i = 0; i < zones.length - 1; i++) {
    const zoneA = zones[i]!;
    const ringsA = getPolygonRings(zoneA);
    for (let j = i + 1; j < zones.length; j++) {
      const zoneB = zones[j]!;
      const ringsB = getPolygonRings(zoneB);
      let found = false;
      for (const ringA of ringsA) {
        for (const ringB of ringsB) {
          if (polygonsOverlap(ringA, ringB)) {
            violations.push({ type: 'OVERLAP', zoneAId: zoneA.id, zoneBId: zoneB.id });
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  }

  return violations;
}

export function assertNoPolygonTopologyViolations(zones: Zone[]): void {
  const violations = findPolygonTopologyViolations(zones);
  if (violations.length === 0) return;

  const first = violations[0]!;
  const detail = first.type === 'SELF_INTERSECTION'
    ? `zone "${first.zoneId}" has a self-intersecting polygon ring`
    : `zones "${first.zoneAId}" and "${first.zoneBId}" have overlapping/crossing polygons`;

  throw new GeometryError(`Invalid polygon topology: ${detail}.`);
}

/** Cross product direction: (pk - pi) × (pj - pi) */
function crossDirection(pi: number[], pj: number[], pk: number[]): number {
  return (pk[0]! - pi[0]!) * (pj[1]! - pi[1]!) - (pj[0]! - pi[0]!) * (pk[1]! - pi[1]!);
}

