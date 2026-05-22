/**
 * services/MapService.ts — L2 Domain Service
 *
 * Import/export GeoJSON, tính adjacency/distance matrices.
 * Import từ types/domain.ts, lib/geometry.ts.
 * Pure class — không import UI framework.
 */

import type { Zone, GeoJSONPolygon } from '../types/domain.js';
import {
  polygonCentroid,
  buildAdjacencyMatrix,
  buildDistanceMatrix,
  type AdjMatrix,
  type DistMatrix,
} from '../lib/geometry.js';
import type { Assignment } from '../lib/partition.js';
import { ServiceError } from './errors.js';

// ─── GeoJSON types (minimal, self-contained) ──────────────────────────────────

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties: Record<string, unknown> | null;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export type FeatureCollection = GeoJSONFeatureCollection;

// ─── MapService ───────────────────────────────────────────────────────────────

export class MapService {

  /**
   * Import GeoJSON FeatureCollection → Zone[].
   *
   * Rules:
   *  - Phải có type === 'FeatureCollection'.
   *  - Mỗi Feature: geometry.type === 'Polygon'.
   *  - Zone.id lấy từ properties.id hoặc properties.zone_id.
   *  - Centroid tính bằng polygonCentroid() từ lib/geometry.ts.
   *  - Thiếu id → throw ServiceError INVALID_INPUT.
   *
   * @throws {ServiceError} INVALID_INPUT
   */
  importGeoJSON(geojson: unknown): Zone[] {
    // Validate top-level structure
    if (
      typeof geojson !== 'object' ||
      geojson === null ||
      (geojson as Record<string, unknown>)['type'] !== 'FeatureCollection' ||
      !Array.isArray((geojson as Record<string, unknown>)['features'])
    ) {
      throw new ServiceError({
        code: 'INVALID_INPUT',
        message: 'GeoJSON must have type === "FeatureCollection" with a features array.',
      });
    }

    const collection = geojson as GeoJSONFeatureCollection;
    const zones: Zone[] = [];

    for (let i = 0; i < collection.features.length; i++) {
      const feature = collection.features[i]!;

      // Chỉ xử lý Polygon (bỏ qua MultiPolygon, Point, v.v.)
      if (feature.geometry?.type !== 'Polygon') continue;

      const props = feature.properties ?? {};

      // Lấy id từ properties.id hoặc properties.zone_id
      const rawId = props['id'] ?? props['zone_id'];
      if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
        throw new ServiceError({
          code: 'INVALID_INPUT',
          message: `Feature at index ${i} is missing properties.id or properties.zone_id.`,
        });
      }
      const id = String(rawId).trim();

      // Build polygon
      const coordinates = feature.geometry.coordinates as number[][][];
      const polygon: GeoJSONPolygon = { type: 'Polygon', coordinates };

      // Tính centroid từ vòng ngoài (ring đầu tiên)
      const ring = coordinates[0] ?? [];
      const coordPoints = ring.map(([lng, lat]) => ({
        lng: lng ?? 0,
        lat: lat ?? 0,
      }));

      const centroid = coordPoints.length > 0
        ? polygonCentroid(coordPoints)
        : { lat: 0, lng: 0 };

      const zone: Zone = {
        id,
        name: String(props['name'] ?? id),
        status: 'unassigned',
        centroid,
        polygon,
        activities: [],
      };

      zones.push(zone);
    }

    return zones;
  }

  /**
   * Export zones + assignments → GeoJSON FeatureCollection.
   *
   * Properties mỗi Feature: { id, districtId, customers, orders }.
   * Zone không có assignment → districtId = null.
   *
   * @complexity O(n) — n = zones.length.
   */
  exportGeoJSON(zones: Zone[], assignments: Assignment[]): FeatureCollection {
    const districtMap = new Map<string, number>(
      assignments.map((a) => [a.zoneId, a.districtId]),
    );

    const features: GeoJSONFeature[] = zones.map((zone) => {
      const customers = zone.activities
        .filter((a) => a.type === 'CUSTOMER')
        .reduce((s, a) => s + a.value, 0);
      const orders = zone.activities
        .filter((a) => a.type === 'ORDER')
        .reduce((s, a) => s + a.value, 0);

      return {
        type: 'Feature',
        geometry: {
          type: zone.polygon.type,
          coordinates: zone.polygon.coordinates as number[][][] | number[][][][],
        },
        properties: {
          id: zone.id,
          districtId: districtMap.get(zone.id) ?? null,
          customers,
          orders,
        },
      };
    });

    return { type: 'FeatureCollection', features };
  }

  /**
   * Tính adjacency + distance matrices cho zones.
   * adjThresholdKm = 50 (chuẩn Việt Nam).
   *
   * @complexity O(n²) — n = zones.length.
   */
  computeMatrices(zones: Zone[]): { adj: AdjMatrix; dist: DistMatrix } {
    return {
      adj: buildAdjacencyMatrix(zones, 50),
      dist: buildDistanceMatrix(zones),
    };
  }
}
