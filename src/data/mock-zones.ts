/**
 * Mock Zones — 20 zones Hà Nội + 12 zones TP.HCM = 32 total
 *
 * THIẾT KẾ: Grid tiling — mỗi zone là hình chữ nhật, biên chia sẻ
 * chính xác (shared edges) → ZERO overlap, ZERO gap.
 *
 * Hà Nội: 20 zones (5×4 grid) — khu vực nội thành
 * HCM: 12 zones (4×3 grid) — khu vực Q1/Q3/Phú Nhuận
 */

import type { Zone, Assignment } from '../../facades/viewmodels.js'

// ── Helper ──────────────────────────────────────────────────────────────────────
function centroidOf(ring: number[][]): { lat: number; lng: number } {
  const pts = ring.slice(0, -1)
  const lat = pts.reduce((s, p) => s + p[1]!, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p[0]!, 0) / pts.length
  return { lat: Math.round(lat * 100000) / 100000, lng: Math.round(lng * 100000) / 100000 }
}

/** Tạo rectangle polygon [lng,lat] — closed ring, counter-clockwise */
function rect(left: number, bottom: number, right: number, top: number): number[][] {
  return [
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
    [left, bottom], // close
  ]
}

function makeZone(
  id: string, name: string, regionId: string,
  ring: number[][], customers: number, orders: number,
): Zone {
  return {
    id, name, status: 'unassigned', regionId,
    polygon: { type: 'Polygon', coordinates: [ring] },
    centroid: centroidOf(ring),
    activities: [
      { id: `${id}-c`, type: 'CUSTOMER', value: customers },
      { id: `${id}-o`, type: 'ORDER',    value: orders },
    ],
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HÀ NỘI — 20 zones (5 cols × 4 rows)
// Khu vực thực tế: Ba Đình → Hoàn Kiếm → Đống Đa → Hai Bà Trưng
// Grid: lat 21.000 → 21.048, lng 105.810 → 105.860
// Cell: ~0.012 lat × 0.010 lng ≈ 1.3km × 1.0km
//
//   ┌────────┬────────┬────────┬────────┬────────┐  Row 3: 21.036→21.048
//   │ hn01   │ hn02   │ hn03   │ hn04   │ hn05   │
//   ├────────┼────────┼────────┼────────┼────────┤  Row 2: 21.024→21.036
//   │ hn06   │ hn07   │ hn08   │ hn09   │ hn10   │
//   ├────────┼────────┼────────┼────────┼────────┤  Row 1: 21.012→21.024
//   │ hn11   │ hn12   │ hn13   │ hn14   │ hn15   │
//   ├────────┼────────┼────────┼────────┼────────┤  Row 0: 21.000→21.012
//   │ hn16   │ hn17   │ hn18   │ hn19   │ hn20   │
//   └────────┴────────┴────────┴────────┴────────┘
//   Col 0      Col 1     Col 2     Col 3     Col 4
//  105.810   105.820   105.830   105.840   105.850   105.860
// ══════════════════════════════════════════════════════════════════════════════

const HC = [105.810, 105.820, 105.830, 105.840, 105.850, 105.860] // 6 col edges
const HR = [21.000, 21.012, 21.024, 21.036, 21.048]               // 5 row edges

function hnRect(col: number, row: number): number[][] {
  return rect(HC[col]!, HR[row]!, HC[col + 1]!, HR[row + 1]!)
}

const hnZones: Zone[] = [
  // Row 3 (top) — Tây Hồ / Ba Đình
  makeZone('hn01', 'Phúc Xá',        'region-hn', hnRect(0, 3), 85,  55),
  makeZone('hn02', 'Trúc Bạch',      'region-hn', hnRect(1, 3), 120, 80),
  makeZone('hn03', 'Quán Thánh',     'region-hn', hnRect(2, 3), 95,  65),
  makeZone('hn04', 'Phú Thượng',     'region-hn', hnRect(3, 3), 110, 75),
  makeZone('hn05', 'Nhật Tân',       'region-hn', hnRect(4, 3), 70,  45),
  // Row 2 — Ba Đình / Hoàn Kiếm
  makeZone('hn06', 'Cống Vị',        'region-hn', hnRect(0, 2), 140, 95),
  makeZone('hn07', 'Ngọc Hà',        'region-hn', hnRect(1, 2), 180, 125),
  makeZone('hn08', 'Hàng Bông',      'region-hn', hnRect(2, 2), 310, 220),
  makeZone('hn09', 'Hàng Bạc',       'region-hn', hnRect(3, 2), 290, 200),
  makeZone('hn10', 'Đồng Xuân',      'region-hn', hnRect(4, 2), 250, 170),
  // Row 1 — Đống Đa / Hai Bà Trưng
  makeZone('hn11', 'Láng Thượng',    'region-hn', hnRect(0, 1), 160, 110),
  makeZone('hn12', 'Ô Chợ Dừa',     'region-hn', hnRect(1, 1), 200, 140),
  makeZone('hn13', 'Quang Trung',    'region-hn', hnRect(2, 1), 175, 120),
  makeZone('hn14', 'Phạm Đình Hổ',  'region-hn', hnRect(3, 1), 220, 155),
  makeZone('hn15', 'Bạch Mai',       'region-hn', hnRect(4, 1), 260, 180),
  // Row 0 (bottom) — Thanh Xuân / Hoàng Mai
  makeZone('hn16', 'Thanh Xuân Bắc', 'region-hn', hnRect(0, 0), 130, 90),
  makeZone('hn17', 'Khương Đình',    'region-hn', hnRect(1, 0), 150, 100),
  makeZone('hn18', 'Khương Thượng',  'region-hn', hnRect(2, 0), 115, 75),
  makeZone('hn19', 'Phương Liệt',   'region-hn', hnRect(3, 0), 190, 130),
  makeZone('hn20', 'Tương Mai',      'region-hn', hnRect(4, 0), 210, 145),
]

// ══════════════════════════════════════════════════════════════════════════════
// TP.HCM — 12 zones (4 cols × 3 rows)
// Khu vực: Q1 / Q3 / Phú Nhuận / Bình Thạnh
// Grid: lat 10.775 → 10.811, lng 106.675 → 106.715
//
//   ┌────────┬────────┬────────┬────────┐  Row 2: 10.799→10.811
//   │ sg01   │ sg02   │ sg03   │ sg04   │
//   ├────────┼────────┼────────┼────────┤  Row 1: 10.787→10.799
//   │ sg05   │ sg06   │ sg07   │ sg08   │
//   ├────────┼────────┼────────┼────────┤  Row 0: 10.775→10.787
//   │ sg09   │ sg10   │ sg11   │ sg12   │
//   └────────┴────────┴────────┴────────┘
//  106.675  106.685  106.695  106.705  106.715
// ══════════════════════════════════════════════════════════════════════════════

const SC = [106.675, 106.685, 106.695, 106.705, 106.715] // 5 col edges
const SR = [10.775, 10.787, 10.799, 10.811]               // 4 row edges

function sgRect(col: number, row: number): number[][] {
  return rect(SC[col]!, SR[row]!, SC[col + 1]!, SR[row + 1]!)
}

const hcmZones: Zone[] = [
  // Row 2 (top) — Phú Nhuận
  makeZone('sg01', 'Phú Nhuận P1',   'region-hcm', sgRect(0, 2), 145, 100),
  makeZone('sg02', 'Phú Nhuận P2',   'region-hcm', sgRect(1, 2), 170, 115),
  makeZone('sg03', 'Phú Nhuận P3',   'region-hcm', sgRect(2, 2), 130, 85),
  makeZone('sg04', 'Bình Thạnh P1',  'region-hcm', sgRect(3, 2), 195, 135),
  // Row 1 — Quận 3
  makeZone('sg05', 'Quận 3 P6',      'region-hcm', sgRect(0, 1), 220, 155),
  makeZone('sg06', 'Quận 3 P9',      'region-hcm', sgRect(1, 1), 280, 195),
  makeZone('sg07', 'Quận 3 P12',     'region-hcm', sgRect(2, 1), 240, 165),
  makeZone('sg08', 'Bình Thạnh P2',  'region-hcm', sgRect(3, 1), 160, 110),
  // Row 0 (bottom) — Quận 1
  makeZone('sg09', 'Bến Nghé',       'region-hcm', sgRect(0, 0), 350, 250),
  makeZone('sg10', 'Bến Thành',      'region-hcm', sgRect(1, 0), 400, 280),
  makeZone('sg11', 'Đa Kao',         'region-hcm', sgRect(2, 0), 310, 215),
  makeZone('sg12', 'Tân Định',       'region-hcm', sgRect(3, 0), 270, 185),
]

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

export const MOCK_ZONES: Zone[] = [...hnZones, ...hcmZones]

export const MOCK_ASSIGNMENTS: Assignment[] = [
  // HN — 5 districts, 1 agent each (sa0-sa4)
  { zoneId: 'hn01', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'hn02', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'hn06', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'hn07', districtId: 0, salesAgentId: 'sa0' },

  { zoneId: 'hn03', districtId: 1, salesAgentId: 'sa1' },
  { zoneId: 'hn04', districtId: 1, salesAgentId: 'sa1' },
  { zoneId: 'hn08', districtId: 1, salesAgentId: 'sa1' },
  { zoneId: 'hn09', districtId: 1, salesAgentId: 'sa1' },

  { zoneId: 'hn05', districtId: 2, salesAgentId: 'sa2' },
  { zoneId: 'hn10', districtId: 2, salesAgentId: 'sa2' },
  { zoneId: 'hn15', districtId: 2, salesAgentId: 'sa2' },
  { zoneId: 'hn20', districtId: 2, salesAgentId: 'sa2' },

  { zoneId: 'hn11', districtId: 3, salesAgentId: 'sa3' },
  { zoneId: 'hn12', districtId: 3, salesAgentId: 'sa3' },
  { zoneId: 'hn16', districtId: 3, salesAgentId: 'sa3' },
  { zoneId: 'hn17', districtId: 3, salesAgentId: 'sa3' },

  { zoneId: 'hn13', districtId: 4, salesAgentId: 'sa4' },
  { zoneId: 'hn14', districtId: 4, salesAgentId: 'sa4' },
  { zoneId: 'hn18', districtId: 4, salesAgentId: 'sa4' },
  { zoneId: 'hn19', districtId: 4, salesAgentId: 'sa4' },

  // HCM — 3 districts, 1 agent each (sa5-sa7)
  { zoneId: 'sg01', districtId: 5, salesAgentId: 'sa5' },
  { zoneId: 'sg02', districtId: 5, salesAgentId: 'sa5' },
  { zoneId: 'sg05', districtId: 5, salesAgentId: 'sa5' },
  { zoneId: 'sg06', districtId: 5, salesAgentId: 'sa5' },

  { zoneId: 'sg03', districtId: 6, salesAgentId: 'sa6' },
  { zoneId: 'sg04', districtId: 6, salesAgentId: 'sa6' },
  { zoneId: 'sg07', districtId: 6, salesAgentId: 'sa6' },
  { zoneId: 'sg08', districtId: 6, salesAgentId: 'sa6' },

  { zoneId: 'sg09', districtId: 7, salesAgentId: 'sa7' },
  { zoneId: 'sg10', districtId: 7, salesAgentId: 'sa7' },
  { zoneId: 'sg11', districtId: 7, salesAgentId: 'sa7' },
  { zoneId: 'sg12', districtId: 7, salesAgentId: 'sa7' },
]
