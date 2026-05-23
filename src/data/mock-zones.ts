/**
 * Mock Zones — 20 zones Hà Nội + 12 zones TP.HCM = 32 total
 *
 * THIẾT KẾ: Polygons nhỏ, sát nhau, phản ánh tọa độ thực tế của
 * các quận/phường ở 2 thành phố lớn nhất Việt Nam.
 *
 * Hà Nội: 20 zones (5×4 grid) — khu vực nội thành
 *   Tọa độ thực tế quanh Hoàn Kiếm/Ba Đình/Đống Đa/Hai Bà Trưng
 *
 * HCM: 12 zones (4×3 grid) — khu vực Q1/Q3/Bình Thạnh/Phú Nhuận
 *
 * Tất cả zones share biên (adjacent), KHÔNG overlap.
 */

import type { Zone, Assignment } from '../../facades/viewmodels.js'

// ── Helper: compute centroid from polygon ring ──────────────────────────────────
function centroidOf(ring: number[][]): { lat: number; lng: number } {
  const pts = ring.slice(0, -1)
  const lat = pts.reduce((s, p) => s + p[1]!, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p[0]!, 0) / pts.length
  return { lat: Math.round(lat * 100000) / 100000, lng: Math.round(lng * 100000) / 100000 }
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
// Khu vực: Ba Đình → Hoàn Kiếm → Hai Bà Trưng (trái → phải)
//          Tây Hồ → Đống Đa → Thanh Xuân (trên → dưới)
//
// Grid: lat 21.000 → 21.048, lng 105.810 → 105.860
// Cell size: ~0.012 lat × ~0.010 lng ≈ 1.3km × 1.0km
// ══════════════════════════════════════════════════════════════════════════════

// Column edges (lng)
const HL0 = 105.810
const HL1 = 105.820
const HL2 = 105.830
const HL3 = 105.840
const HL4 = 105.850
const HL5 = 105.860

// Row edges (lat)
const HR0 = 21.000
const HR1 = 21.012
const HR2 = 21.024
const HR3 = 21.036
const HR4 = 21.048

// Helper: rectangle polygon [lng,lat] closed
function rect(l: number, b: number, r: number, t: number): number[][] {
  return [[l,b],[r,b],[r,t],[l,t],[l,b]]
}

// Irregular shapes — add midpoint notches for realism
function hn(col: number, row: number, notch?: 'tl'|'tr'|'bl'|'br'): number[][] {
  const l = [HL0,HL1,HL2,HL3,HL4][col]!
  const r = [HL1,HL2,HL3,HL4,HL5][col]!
  const b = [HR0,HR1,HR2,HR3][row]!
  const t = [HR1,HR2,HR3,HR4][row]!
  const mx = (l+r)/2, my = (b+t)/2
  const d = 0.002 // notch depth

  if (notch === 'tr') return [[l,b],[r,b],[r,my],[r-d,my+d],[r,t],[l,t],[l,b]]
  if (notch === 'tl') return [[l,b],[r,b],[r,t],[l,t],[l+d,my+d],[l,my],[l,b]]
  if (notch === 'br') return [[l,b],[r,b],[r-d,my-d],[r,my],[r,t],[l,t],[l,b]]
  if (notch === 'bl') return [[l,b],[l+d,my-d],[l,my],[l,t],[r,t],[r,b],[l,b]]

  // Default: rectangle with slight mid-edge indent for visual interest
  return [[l,b],[mx,b+0.001],[r,b],[r,t],[mx,t-0.001],[l,t],[l,b]]
}

// ── Hà Nội zones ────────────────────────────────────────────────────────────────
const hnZones: Zone[] = [
  // Row 3 (top) — Tây Hồ / Ba Đình area
  makeZone('hn01', 'Phúc Xá',       'region-hn', hn(0,3,'tr'), 85,  55),
  makeZone('hn02', 'Trúc Bạch',     'region-hn', hn(1,3),      120, 80),
  makeZone('hn03', 'Quán Thánh',    'region-hn', hn(2,3,'tl'), 95,  65),
  makeZone('hn04', 'Phú Thượng',    'region-hn', hn(3,3),      110, 75),
  makeZone('hn05', 'Nhật Tân',      'region-hn', hn(4,3,'bl'), 70,  45),

  // Row 2 — Ba Đình / Hoàn Kiếm
  makeZone('hn06', 'Cống Vị',       'region-hn', hn(0,2),      140, 95),
  makeZone('hn07', 'Ngọc Hà',       'region-hn', hn(1,2,'br'), 180, 125),
  makeZone('hn08', 'Hàng Bông',     'region-hn', hn(2,2),      310, 220),
  makeZone('hn09', 'Hàng Bạc',      'region-hn', hn(3,2,'tl'), 290, 200),
  makeZone('hn10', 'Đồng Xuân',     'region-hn', hn(4,2),      250, 170),

  // Row 1 — Đống Đa / Hai Bà Trưng
  makeZone('hn11', 'Láng Thượng',   'region-hn', hn(0,1,'tr'), 160, 110),
  makeZone('hn12', 'Ô Chợ Dừa',    'region-hn', hn(1,1),      200, 140),
  makeZone('hn13', 'Quang Trung',   'region-hn', hn(2,1,'bl'), 175, 120),
  makeZone('hn14', 'Phạm Đình Hổ',  'region-hn', hn(3,1),      220, 155),
  makeZone('hn15', 'Bạch Mai',      'region-hn', hn(4,1,'tl'), 260, 180),

  // Row 0 (bottom) — Thanh Xuân / Hoàng Mai
  makeZone('hn16', 'Thanh Xuân Bắc','region-hn', hn(0,0),      130, 90),
  makeZone('hn17', 'Khương Đình',   'region-hn', hn(1,0,'tr'), 150, 100),
  makeZone('hn18', 'Khương Thượng', 'region-hn', hn(2,0),      115, 75),
  makeZone('hn19', 'Phương Liệt',  'region-hn', hn(3,0,'bl'), 190, 130),
  makeZone('hn20', 'Tương Mai',     'region-hn', hn(4,0),      210, 145),
]

// ══════════════════════════════════════════════════════════════════════════════
// TP.HCM — 12 zones (4 cols × 3 rows)
// Khu vực: Q1 / Q3 / Phú Nhuận / Bình Thạnh
//
// Grid: lat 10.775 → 10.811, lng 106.675 → 106.715
// Cell size: ~0.012 lat × ~0.010 lng ≈ 1.3km × 1.0km
// ══════════════════════════════════════════════════════════════════════════════

const SL0 = 106.675
const SL1 = 106.685
const SL2 = 106.695
const SL3 = 106.705
const SL4 = 106.715

const SR0 = 10.775
const SR1 = 10.787
const SR2 = 10.799
const SR3 = 10.811

function hcm(col: number, row: number, notch?: 'tl'|'tr'|'bl'|'br'): number[][] {
  const l = [SL0,SL1,SL2,SL3][col]!
  const r = [SL1,SL2,SL3,SL4][col]!
  const b = [SR0,SR1,SR2][row]!
  const t = [SR1,SR2,SR3][row]!
  const mx = (l+r)/2, my = (b+t)/2
  const d = 0.002

  if (notch === 'tr') return [[l,b],[r,b],[r,my],[r-d,my+d],[r,t],[l,t],[l,b]]
  if (notch === 'bl') return [[l,b],[l+d,my-d],[l,my],[l,t],[r,t],[r,b],[l,b]]
  return [[l,b],[mx,b+0.001],[r,b],[r,t],[mx,t-0.001],[l,t],[l,b]]
}

const hcmZones: Zone[] = [
  // Row 2 (top) — Phú Nhuận
  makeZone('sg01', 'Phú Nhuận P1',  'region-hcm', hcm(0,2),      145, 100),
  makeZone('sg02', 'Phú Nhuận P2',  'region-hcm', hcm(1,2,'tr'), 170, 115),
  makeZone('sg03', 'Phú Nhuận P3',  'region-hcm', hcm(2,2),      130, 85),
  makeZone('sg04', 'Bình Thạnh P1', 'region-hcm', hcm(3,2,'bl'), 195, 135),

  // Row 1 — Quận 3
  makeZone('sg05', 'Quận 3 P6',     'region-hcm', hcm(0,1,'tr'), 220, 155),
  makeZone('sg06', 'Quận 3 P9',     'region-hcm', hcm(1,1),      280, 195),
  makeZone('sg07', 'Quận 3 P12',    'region-hcm', hcm(2,1,'bl'), 240, 165),
  makeZone('sg08', 'Bình Thạnh P2', 'region-hcm', hcm(3,1),      160, 110),

  // Row 0 (bottom) — Quận 1
  makeZone('sg09', 'Bến Nghé',      'region-hcm', hcm(0,0),      350, 250),
  makeZone('sg10', 'Bến Thành',     'region-hcm', hcm(1,0,'tr'), 400, 280),
  makeZone('sg11', 'Đa Kao',        'region-hcm', hcm(2,0),      310, 215),
  makeZone('sg12', 'Tân Định',      'region-hcm', hcm(3,0,'bl'), 270, 185),
]

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

export const MOCK_ZONES: Zone[] = [...hnZones, ...hcmZones]

// Default assignments: 5 districts for HN (4 zones each), 3 districts for HCM (4 zones each)
export const MOCK_ASSIGNMENTS: Assignment[] = [
  // HN — 5 districts
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

  { zoneId: 'hn13', districtId: 4, salesAgentId: 'sa0' },
  { zoneId: 'hn14', districtId: 4, salesAgentId: 'sa0' },
  { zoneId: 'hn18', districtId: 4, salesAgentId: 'sa0' },
  { zoneId: 'hn19', districtId: 4, salesAgentId: 'sa0' },

  // HCM — 3 districts
  { zoneId: 'sg01', districtId: 5, salesAgentId: 'sa1' },
  { zoneId: 'sg02', districtId: 5, salesAgentId: 'sa1' },
  { zoneId: 'sg05', districtId: 5, salesAgentId: 'sa1' },
  { zoneId: 'sg06', districtId: 5, salesAgentId: 'sa1' },

  { zoneId: 'sg03', districtId: 6, salesAgentId: 'sa2' },
  { zoneId: 'sg04', districtId: 6, salesAgentId: 'sa2' },
  { zoneId: 'sg07', districtId: 6, salesAgentId: 'sa2' },
  { zoneId: 'sg08', districtId: 6, salesAgentId: 'sa2' },

  { zoneId: 'sg09', districtId: 7, salesAgentId: 'sa3' },
  { zoneId: 'sg10', districtId: 7, salesAgentId: 'sa3' },
  { zoneId: 'sg11', districtId: 7, salesAgentId: 'sa3' },
  { zoneId: 'sg12', districtId: 7, salesAgentId: 'sa3' },
]
