/**
 * Mock Zones — 500 zones Hà Nội (25x20 grid) + 12 zones TP.HCM = 512 total
 *
 * THIẾT KẾ: Grid tiling — mỗi zone là hình chữ nhật, biên chia sẻ
 * chính xác (shared edges) → ZERO overlap, ZERO gap.
 */

import type { Zone, Assignment } from '../../facades/viewmodels.js'

// ── Helper ──────────────────────────────────────────────────────────────────────
function centroidOf(ring: number[][]): { lat: number; lng: number } {
  const pts = ring.slice(0, -1)
  const lat = pts.reduce((s, p) => s + p[1]!, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p[0]!, 0) / pts.length
  return { lat: Math.round(lat * 100000) / 100000, lng: Math.round(lng * 100000) / 100000 }
}

/** Tạo rectangle vùng [lng,lat] — closed ring, counter-clockwise */
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
// HÀ NỘI — 500 zones (25 cols × 20 rows)
// Grid: lat 21.000 → 21.048, lng 105.810 → 105.860
// Cell: ~0.002 lat × 0.0024 lng ≈ 220m × 260m (diện tích nhỏ hơn nhiều so với cũ)
// ══════════════════════════════════════════════════════════════════════════════

const hnZones: Zone[] = []
const hnHN_ASSIGNMENTS: Assignment[] = []

const COLS = 25
const ROWS = 20

const lngMin = 105.810
const lngMax = 105.860
const latMin = 21.000
const latMax = 21.048

const colWidth = (lngMax - lngMin) / COLS // 0.002
const rowHeight = (latMax - latMin) / ROWS // 0.0024

for (let col = 0; col < COLS; col++) {
  for (let row = 0; row < ROWS; row++) {
    const id = `hn_${col.toString().padStart(2, '0')}_${row.toString().padStart(2, '0')}`
    const name = `Vùng HN-${col + 1}-${row + 1}`
    
    const left = lngMin + col * colWidth
    const right = left + colWidth
    const bottom = latMin + row * rowHeight
    const top = bottom + rowHeight
    const ring = rect(left, bottom, right, top)
    
    // Deterministic customers and orders using sine/cosine to distribute nicely
    const customers = Math.floor((Math.sin(col / 2.0) + Math.cos(row / 2.0) + 2) * 50) + 20
    const orders = Math.floor(customers * 0.7)
    
    hnZones.push(makeZone(id, name, 'region-hn', ring, customers, orders))
    
    // Assign to 20 districts
    const districtId = (col % 5) + (row % 4) * 5
    // Map to 20 Hanoi sales agents
    const salesAgentId = districtId === 0 ? 'sales.test@terrimap.vn' : `sales_hn_${districtId}@terrimap.vn`
    
    hnHN_ASSIGNMENTS.push({
      zoneId: id,
      districtId,
      salesAgentId
    })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TP.HCM — 12 zones (4 cols × 3 rows)
// Khu vực: Q1 / Q3 / Phú Nhuận / Bình Thạnh
// Grid: lat 10.775 → 10.811, lng 106.675 → 106.715
// Cell: ~0.012 lat × 0.010 lng ≈ 1.3km × 1.0km
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
  ...hnHN_ASSIGNMENTS,
  // HCM — 2 districts (district 5 and 6, matching 2 mock agents sales_hcm_1 and sales_hcm_2)
  { zoneId: 'sg01', districtId: 5, salesAgentId: 'sales_hcm_1@terrimap.vn' },
  { zoneId: 'sg02', districtId: 5, salesAgentId: 'sales_hcm_1@terrimap.vn' },
  { zoneId: 'sg05', districtId: 5, salesAgentId: 'sales_hcm_1@terrimap.vn' },
  { zoneId: 'sg06', districtId: 5, salesAgentId: 'sales_hcm_1@terrimap.vn' },

  { zoneId: 'sg03', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },
  { zoneId: 'sg04', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },
  { zoneId: 'sg07', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },
  { zoneId: 'sg08', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },

  { zoneId: 'sg09', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },
  { zoneId: 'sg10', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },
  { zoneId: 'sg11', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },
  { zoneId: 'sg12', districtId: 6, salesAgentId: 'sales_hcm_2@terrimap.vn' },
]
