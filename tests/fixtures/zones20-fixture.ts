/**
 * zones20 - Lưới 4×5 trong bounds Hà Nội (lat 20.8–21.2, lng 105.6–106.0).
 *
 * Customers seed cố định (pseudo-random bằng lcg):
 *   customers[i] = 50 + (lcg(i) % 151)  ->  range [50, 200]
 *
 * Fixture này dùng chung cho tất cả correctness, quality, determinism tests.
 */
import type { Zone } from '../../types/domain.js';

/** Grid cell size in degrees */
const CELL_LAT = 0.4 / 5;  // ~0.08°
const CELL_LNG = 0.4 / 4;  // ~0.10°
const GRID_LAT0 = 20.8;
const GRID_LNG0 = 105.6;

/** Simple LCG để sinh customers seed cố định - không dùng Math.random(). */
function lcg(seed: number): number {
  // LCG params từ Numerical Recipes
  return (1664525 * seed + 1013904223) >>> 0;
}

/**
 * Tạo 1 zone tại vị trí (row, col) trong lưới 5×4.
 * Each zone gets a unique polygon so that adjacent zones share edges.
 * lat: 20.8 + row*(0.4/5)
 * lng: 105.6 + col*(0.4/4)
 */
function makeGridZone(row: number, col: number, idx: number): Zone {
  const lat0 = GRID_LAT0 + row * CELL_LAT;
  const lng0 = GRID_LNG0 + col * CELL_LNG;
  const lat1 = lat0 + CELL_LAT;
  const lng1 = lng0 + CELL_LNG;
  const customers = 50 + (lcg(idx + 1) % 151); // [50, 200]

  return {
    id: `z${String(idx).padStart(2, '0')}`,
    name: `Zone ${idx} (r${row}c${col})`,
    polygon: {
      type: 'Polygon',
      coordinates: [[[lng0, lat0], [lng1, lat0], [lng1, lat1], [lng0, lat1], [lng0, lat0]]],
    },
    centroid: { lat: (lat0 + lat1) / 2, lng: (lng0 + lng1) / 2 },
    activities: [{ id: `act-z${idx}`, type: 'CUSTOMER', value: customers }],
    status: 'unassigned',
  } as unknown as Zone; // cast: bỏ qua exactOptionalPropertyTypes lint
}

/**
 * 20 zones phân bố đều trên lưới 4 hàng × 5 cột
 * trong bounds Hà Nội.
 *
 * Thứ tự: row 0..4 × col 0..3 (tổng 20 zones).
 */
export const zones20: Zone[] = (() => {
  const result: Zone[] = [];
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      result.push(makeGridZone(row, col, idx));
      idx++;
    }
  }
  return result;
})();
