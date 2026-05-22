/**
 * L0 — Runtime Validation Schemas (Zod)
 *
 * Mỗi Schema là nguồn chân lý duy nhất cho runtime validation.
 * Types được infer từ Schema (z.infer) để đảm bảo DRY — không bao giờ khai báo
 * type và schema tách rời nhau.
 *
 * KHÔNG import gì từ UI layer hay L1+ layer.
 */

import { z } from 'zod';

// ==========================================
// 1. CHUẨN ĐỊA LÝ & DATA CƠ BẢN
// ==========================================

export const CoordinateSchema = z.object({
  /** INVARIANT: lng ∈ [-180, 180] */
  lng: z.number().min(-180).max(180),
  /** INVARIANT: lat ∈ [-90, 90] */
  lat: z.number().min(-90).max(90),
});
export type Coordinate = z.infer<typeof CoordinateSchema>;

/**
 * Validate một ring (vòng khép kín) của Polygon:
 * - Phải có ít nhất 4 điểm (3 unique + 1 điểm đóng trùng điểm đầu).
 * - Điểm đầu phải trùng điểm cuối (closed ring).
 */
const PolygonRingSchema = z
  .array(z.tuple([z.number(), z.number()]))
  .min(4, 'Polygon ring phải có ít nhất 4 điểm (3 unique + 1 điểm đóng)')
  .refine(
    (ring) => {
      // min(4) above already guarantees ring.length >= 4, so ring[0] and ring[ring.length-1] are always defined.
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      return first[0] === last[0] && first[1] === last[1];
    },
    { message: 'Điểm đầu và điểm cuối của Polygon ring phải trùng nhau (closed ring)' }
  );

export const GeoJSONPolygonSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('Polygon'),
    /** INVARIANT: coordinates là mảng của các rings. Ring ngoài cùng là exterior. */
    coordinates: z.array(PolygonRingSchema).min(1, 'Polygon phải có ít nhất 1 ring'),
  }),
  z.object({
    type: z.literal('MultiPolygon'),
    /** INVARIANT: Mảng của các polygons, mỗi polygon có ít nhất 1 ring. */
    coordinates: z.array(z.array(PolygonRingSchema).min(1)).min(1),
  }),
]);
export type GeoJSONPolygon = z.infer<typeof GeoJSONPolygonSchema>;

export const ActivityTypeSchema = z.enum(['CUSTOMER', 'ORDER', 'REVENUE']);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivitySchema = z.object({
  id: z.string().min(1, 'Activity ID không được rỗng'),
  type: ActivityTypeSchema,
  /** INVARIANT: value >= 0 (không thể có khách hàng âm) */
  value: z.number().min(0, 'Activity.value phải >= 0'),
  location: CoordinateSchema.optional(),
});
export type Activity = z.infer<typeof ActivitySchema>;

// ==========================================
// 2. ZONE (BASIC UNITS) — DISCRIMINATED UNIONS
// ==========================================

const BaseZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  polygon: GeoJSONPolygonSchema,
  centroid: CoordinateSchema,
  activities: z.array(ActivitySchema),
});

export const UnassignedZoneSchema = BaseZoneSchema.extend({
  status: z.literal('unassigned'),
});
export type UnassignedZone = z.infer<typeof UnassignedZoneSchema>;

export const AssignedZoneSchema = BaseZoneSchema.extend({
  status: z.literal('assigned'),
  /** INVARIANT: districtId phải là một ID hợp lệ của District trong cùng Version. */
  districtId: z.string().min(1, 'districtId không được rỗng khi Zone đã được gán'),
});
export type AssignedZone = z.infer<typeof AssignedZoneSchema>;

/** Discriminated Union: TypeScript + Zod sẽ narrow type theo field `status`. */
export const ZoneSchema = z.discriminatedUnion('status', [
  UnassignedZoneSchema,
  AssignedZoneSchema,
]);
export type Zone = z.infer<typeof ZoneSchema>;

// ==========================================
// 3. SALES & DISTRICTS
// ==========================================

export const SalesAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  activeRegion: z.string().min(1),
  /** INVARIANT: capacity >= 0 */
  capacity: z.number().min(0, 'SalesAgent.capacity phải >= 0'),
});
export type SalesAgent = z.infer<typeof SalesAgentSchema>;

export const DistrictSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  salesAgentId: z.string().min(1),
  /**
   * INVARIANT: District phải có ít nhất 1 Zone.
   * Một District rỗng (không có zone) là vô nghĩa trong bài toán phân chia khu vực.
   */
  zoneIds: z.array(z.string().min(1)).min(1, 'District phải có ít nhất 1 Zone'),
  /** INVARIANT: totalWorkload >= 0 */
  totalWorkload: z.number().min(0),
  /** INVARIANT: diameterScore >= 0 */
  diameterScore: z.number().min(0),
  /** INVARIANT: balanceScore phải finite (loại bỏ ±Infinity và NaN để JSON round-trip an toàn). */
  balanceScore: z.number().finite(),
});
export type District = z.infer<typeof DistrictSchema>;

// ==========================================
// 4. MATRICES — MA TRẬN KỀ & KHOẢNG CÁCH
// ==========================================

/**
 * Validate tính đối xứng của AdjacencyMatrix:
 * INVARIANT: Nếu A kề B thì B phải kề A.
 * Schema nhận thêm context `zoneIds` để validate cross-reference.
 */
export const AdjacencyMatrixSchema = z
  .record(z.string(), z.array(z.string()))
  .superRefine((matrix, ctx) => {
    for (const [zoneId, neighbors] of Object.entries(matrix)) {
      for (const neighborId of neighbors) {
        const neighborList = matrix[neighborId];
        if (!neighborList) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `AdjacencyMatrix không symmetric: "${neighborId}" kề của "${zoneId}" nhưng "${neighborId}" không tồn tại trong matrix.`,
            path: [zoneId],
          });
          continue;
        }
        if (!neighborList.includes(zoneId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `AdjacencyMatrix không symmetric: "${zoneId}" kề "${neighborId}" nhưng "${neighborId}" không kề lại "${zoneId}".`,
            path: [zoneId],
          });
        }
      }
    }
  });
export type AdjacencyMatrix = z.infer<typeof AdjacencyMatrixSchema>;

/**
 * Validate tính đối xứng và diagonal=0 của DistanceMatrix:
 * INVARIANT: distance[A][B] === distance[B][A]
 * INVARIANT: distance[A][A] === 0
 * INVARIANT: Mọi giá trị đều >= 0
 */
export const DistanceMatrixSchema = z
  .record(z.string(), z.record(z.string(), z.number().min(0)))
  .superRefine((matrix, ctx) => {
    for (const [rowId, rowData] of Object.entries(matrix)) {
      // Kiểm tra diagonal = 0
      const selfDist = rowData[rowId];
      if (selfDist !== undefined && selfDist !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `DistanceMatrix: distance["${rowId}"]["${rowId}"] phải = 0, nhưng là ${selfDist}.`,
          path: [rowId, rowId],
        });
      }

      // Kiểm tra tính đối xứng
      for (const [colId, dist] of Object.entries(rowData)) {
        const reverseRow = matrix[colId];
        if (!reverseRow) continue; // Nếu colId không có hàng riêng thì bỏ qua (sparse matrix)
        const reverseDist = reverseRow[rowId];
        if (reverseDist !== undefined && dist !== reverseDist) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `DistanceMatrix không symmetric: distance["${rowId}"]["${colId}"] = ${dist} ≠ distance["${colId}"]["${rowId}"] = ${reverseDist}.`,
            path: [rowId, colId],
          });
        }
      }
    }
  });
export type DistanceMatrix = z.infer<typeof DistanceMatrixSchema>;

// ==========================================
// 5. ROOT STATE — TERRITORY VERSION / SNAPSHOT
// ==========================================

export const VersionPeriodSchema = z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM']);
export type VersionPeriod = z.infer<typeof VersionPeriodSchema>;

export const TerritoryVersionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /**
   * INVARIANT: ISO 8601 DateTime String hợp lệ.
   * Dùng datetime() để ép buộc format đúng chuẩn.
   */
  timestamp: z.string().datetime({ message: 'timestamp phải là chuỗi ISO 8601 hợp lệ' }),
  /**
   * INVARIANT: version là số nguyên dương, tăng dần theo thời gian theo vòng đời dữ liệu.
   * Không thể tạo Snapshot với version thấp hơn version hiện tại.
   */
  version: z.number().int().min(1, 'version phải là số nguyên dương >= 1'),
  period: VersionPeriodSchema,

  // Dictionary lookup O(1)
  zones: z.record(z.string(), ZoneSchema),
  districts: z.record(z.string(), DistrictSchema),
  salesAgents: z.record(z.string(), SalesAgentSchema),

  adjacencyMatrix: AdjacencyMatrixSchema,
  distanceMatrix: DistanceMatrixSchema,
});
export type TerritoryVersion = z.infer<typeof TerritoryVersionSchema>;
