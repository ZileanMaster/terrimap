/**
 * Mock Zones — 12 zones phân bố quanh Hà Nội
 * THIẾT KẾ MỚI: Polygons nhiều đỉnh (6-10), KHÔNG chồng lấn.
 *
 * Layout grid 4×3 — các vùng chia sát nhau, SHARE biên (adjacent),
 * nhưng KHÔNG overlap diện tích:
 *
 *   ┌──────┬──────┬──────┐  Row 0: lat 21.08 → 21.15
 *   │ z01  │ z06  │ z04  │
 *   ├──────┼──────┼──────┤  Row 1: lat 21.01 → 21.08
 *   │ z02  │ z05  │ z07  │
 *   ├──────┼──────┼──────┤  Row 2: lat 20.94 → 21.01
 *   │ z03  │ z09  │ z08  │
 *   ├──────┼──────┼──────┤  Row 3: lat 20.87 → 20.94
 *   │ z12  │ z10  │ z11  │
 *   └──────┴──────┴──────┘
 *   Col 0        Col 1        Col 2
 *   105.72→105.80 105.80→105.88 105.88→105.96
 *
 * 4 districts (0-3) × 3 zones mỗi district
 * salesAgentId: 'sa0'-'sa3' tương ứng findIndex trong MOCK_AGENTS
 *
 * CRITICAL (OPEN-4): Thứ tự MOCK_AGENTS không được thay đổi.
 * sa0 → district 0, sa1 → district 1, sa2 → district 2, sa3 → district 3
 */

import type { Zone, Assignment } from '../../facades/viewmodels.js'

// ── Helper: compute centroid from polygon ring ──────────────────────────────────
function centroidOf(ring: number[][]): { lat: number; lng: number } {
  // Skip last point (closing duplicate)
  const pts = ring.slice(0, -1)
  const lat = pts.reduce((s, p) => s + p[1]!, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p[0]!, 0) / pts.length
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 }
}

/*
 * Grid boundaries (shared edges = adjacent, zero overlap):
 *
 * latRows = [20.87, 20.94, 21.01, 21.08, 21.15]
 * lngCols = [105.72, 105.80, 105.88, 105.96]
 *
 * Each polygon has 6-10 vertices to make shapes more natural
 * (notches, indentations, irregular edges) while still tiling perfectly.
 * Key rule: shared edges have IDENTICAL vertex sequences → zero gaps/overlaps.
 */

// ── Column boundaries ───────────────────────────────────────────────────────────
const C0 = 105.72
const C1 = 105.80
const C2 = 105.88
const C3 = 105.96

// ── Row boundaries ──────────────────────────────────────────────────────────────
const R0 = 20.87
const R1 = 20.94
const R2 = 21.01
const R3 = 21.08
const R4 = 21.15

// ── Midpoints for irregular shapes ──────────────────────────────────────────────
const MC01 = (C0 + C1) / 2   // 105.76 — mid col 0-1
const MC12 = (C1 + C2) / 2   // 105.84 — mid col 1-2
const MC23 = (C2 + C3) / 2   // 105.92 — mid col 2-3
const MR01 = (R0 + R1) / 2   // 20.905 — mid row 0-1
const MR12 = (R1 + R2) / 2   // 20.975 — mid row 1-2
const MR23 = (R2 + R3) / 2   // 21.045 — mid row 2-3
const MR34 = (R3 + R4) / 2   // 21.115 — mid row 3-4

// ── Polygon rings [lng, lat] — GeoJSON spec ─────────────────────────────────────
// Each ring is closed (first === last point).
// Vertices are ordered counter-clockwise for GeoJSON exterior rings.

// --- Row 3 (top): lat R3→R4 -------------------------------------------------

// z01: Top-Left — 8-point irregular polygon (District 0)
const z01Ring: number[][] = [
  [C0,  R3],
  [MC01, R3],
  [MC01, MR34 - 0.005],
  [C1,  MR34],
  [C1,  R4],
  [MC01, R4 + 0.005],
  [C0,  R4],
  [C0,  MR34],
  [C0,  R3],  // close
]

// z06: Top-Center — 7-point (District 1)
const z06Ring: number[][] = [
  [C1,  MR34],
  [MC01, MR34 - 0.005],
  [MC01, R3],
  [C1,  R3],
  [C2,  R3],
  [C2,  R4],
  [C1,  R4],
  [C1,  MR34], // close
]

// z04: Top-Right — 8-point with notch (District 1)
const z04Ring: number[][] = [
  [C2,  R3],
  [MC23, R3],
  [C3,  R3 + 0.01],
  [C3,  MR34],
  [C3,  R4],
  [MC23, R4 - 0.005],
  [C2,  R4],
  [C2,  R3], // close
]

// --- Row 2: lat R2→R3 --------------------------------------------------------

// z02: Mid-Left — 7-point (District 0)
const z02Ring: number[][] = [
  [C0,  R2],
  [MC01, R2 + 0.005],
  [C1,  R2],
  [C1,  R3],
  [MC01, R3],
  [C0,  R3],
  [C0,  R2], // close
]

// z05: Mid-Center — 8-point (District 1)
const z05Ring: number[][] = [
  [C1,  R2],
  [MC12, R2],
  [C2,  R2],
  [C2,  MR23],
  [C2,  R3],
  [C1,  R3],
  [C1,  MR23 + 0.005],
  [C1,  R2], // close
]

// z07: Mid-Right — 8-point (District 2)
const z07Ring: number[][] = [
  [C2,  R2],
  [MC23, R2 - 0.005],
  [C3,  R2],
  [C3,  R3 + 0.01],
  [MC23, R3],
  [C2,  R3],
  [C2,  MR23],
  [C2,  R2], // close
]

// --- Row 1: lat R1→R2 --------------------------------------------------------

// z03: Lower-Left — 7-point (District 0)
const z03Ring: number[][] = [
  [C0,  R1],
  [MC01, R1],
  [C1,  R1 + 0.005],
  [C1,  R2],
  [MC01, R2 + 0.005],
  [C0,  R2],
  [C0,  R1], // close
]

// z09: Lower-Center — 8-point (District 2)
const z09Ring: number[][] = [
  [C1,  R1 + 0.005],
  [MC12, R1],
  [C2,  R1],
  [C2,  MR12],
  [C2,  R2],
  [MC12, R2],
  [C1,  R2],
  [C1,  R1 + 0.005], // close
]

// z08: Lower-Right — 8-point (District 2)
const z08Ring: number[][] = [
  [C2,  R1],
  [MC23, R1 + 0.005],
  [C3,  R1],
  [C3,  R2],
  [MC23, R2 - 0.005],
  [C2,  R2],
  [C2,  MR12],
  [C2,  R1], // close
]

// --- Row 0 (bottom): lat R0→R1 -----------------------------------------------

// z12: Bottom-Left — 7-point (District 3)
const z12Ring: number[][] = [
  [C0,  R0],
  [MC01, R0 + 0.005],
  [C1,  R0],
  [C1,  R1 + 0.005],
  [MC01, R1],
  [C0,  R1],
  [C0,  R0], // close
]

// z10: Bottom-Center — 7-point (District 3)
const z10Ring: number[][] = [
  [C1,  R0],
  [MC12, R0],
  [C2,  R0 + 0.005],
  [C2,  R1],
  [MC12, R1],
  [C1,  R1 + 0.005],
  [C1,  R0], // close
]

// z11: Bottom-Right — 8-point (District 3)
const z11Ring: number[][] = [
  [C2,  R0 + 0.005],
  [MC23, R0],
  [C3,  R0],
  [C3,  MR01],
  [C3,  R1],
  [MC23, R1 + 0.005],
  [C2,  R1],
  [C2,  R0 + 0.005], // close
]

// ── MOCK_ZONES ─────────────────────────────────────────────────────────────────

export const MOCK_ZONES: Zone[] = [
  // ─── District 0 (North-West) — sa0 ───────────────────────────────────────────
  {
    id: 'z01', status: 'unassigned', name: 'Tây Hồ',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z01Ring] },
    centroid: centroidOf(z01Ring),
    activities: [
      { id: 'a01a', type: 'CUSTOMER', value: 120 },
      { id: 'a01b', type: 'ORDER',    value: 85 },
    ],
  },
  {
    id: 'z02', status: 'unassigned', name: 'Cầu Giấy',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z02Ring] },
    centroid: centroidOf(z02Ring),
    activities: [
      { id: 'a02a', type: 'CUSTOMER', value: 200 },
      { id: 'a02b', type: 'ORDER',    value: 140 },
      { id: 'a02c', type: 'REVENUE',  value: 5000 },
    ],
  },
  {
    id: 'z03', status: 'unassigned', name: 'Nam Từ Liêm',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z03Ring] },
    centroid: centroidOf(z03Ring),
    activities: [
      { id: 'a03a', type: 'CUSTOMER', value: 90 },
      { id: 'a03b', type: 'ORDER',    value: 60 },
    ],
  },

  // ─── District 1 (North-East) — sa1 ───────────────────────────────────────────
  {
    id: 'z04', status: 'unassigned', name: 'Long Biên',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z04Ring] },
    centroid: centroidOf(z04Ring),
    activities: [
      { id: 'a04a', type: 'CUSTOMER', value: 310 },
      { id: 'a04b', type: 'ORDER',    value: 210 },
    ],
  },
  {
    id: 'z05', status: 'unassigned', name: 'Ba Đình',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z05Ring] },
    centroid: centroidOf(z05Ring),
    activities: [
      { id: 'a05a', type: 'CUSTOMER', value: 180 },
      { id: 'a05b', type: 'ORDER',    value: 130 },
    ],
  },
  {
    id: 'z06', status: 'unassigned', name: 'Đống Đa',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z06Ring] },
    centroid: centroidOf(z06Ring),
    activities: [
      { id: 'a06a', type: 'CUSTOMER', value: 75 },
      { id: 'a06b', type: 'ORDER',    value: 45 },
    ],
  },

  // ─── District 2 (South-East) — sa2 ───────────────────────────────────────────
  {
    id: 'z07', status: 'unassigned', name: 'Hai Bà Trưng',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z07Ring] },
    centroid: centroidOf(z07Ring),
    activities: [
      { id: 'a07a', type: 'CUSTOMER', value: 250 },
      { id: 'a07b', type: 'ORDER',    value: 170 },
    ],
  },
  {
    id: 'z08', status: 'unassigned', name: 'Hoàng Mai',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z08Ring] },
    centroid: centroidOf(z08Ring),
    activities: [
      { id: 'a08a', type: 'CUSTOMER', value: 290 },
      { id: 'a08b', type: 'ORDER',    value: 200 },
      { id: 'a08c', type: 'REVENUE',  value: 7500 },
    ],
  },
  {
    id: 'z09', status: 'unassigned', name: 'Thanh Xuân',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z09Ring] },
    centroid: centroidOf(z09Ring),
    activities: [
      { id: 'a09a', type: 'CUSTOMER', value: 220 },
      { id: 'a09b', type: 'ORDER',    value: 150 },
    ],
  },

  // ─── District 3 (South-West) — sa3 ───────────────────────────────────────────
  {
    id: 'z10', status: 'unassigned', name: 'Hà Đông',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z10Ring] },
    centroid: centroidOf(z10Ring),
    activities: [
      { id: 'a10a', type: 'CUSTOMER', value: 160 },
      { id: 'a10b', type: 'ORDER',    value: 110 },
    ],
  },
  {
    id: 'z11', status: 'unassigned', name: 'Thanh Trì',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z11Ring] },
    centroid: centroidOf(z11Ring),
    activities: [
      { id: 'a11a', type: 'CUSTOMER', value: 130 },
      { id: 'a11b', type: 'ORDER',    value: 90 },
    ],
  },
  {
    id: 'z12', status: 'unassigned', name: 'Hoài Đức',
    regionId: 'region-hn',
    polygon: { type: 'Polygon', coordinates: [z12Ring] },
    centroid: centroidOf(z12Ring),
    activities: [
      { id: 'a12a', type: 'CUSTOMER', value: 95 },
      { id: 'a12b', type: 'ORDER',    value: 65 },
    ],
  },
]

// ── Default assignments theo 4 districts ──────────────────────────────────────

export const MOCK_ASSIGNMENTS: Assignment[] = [
  { zoneId: 'z01', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'z02', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'z03', districtId: 0, salesAgentId: 'sa0' },
  { zoneId: 'z04', districtId: 1, salesAgentId: 'sa1' },
  { zoneId: 'z05', districtId: 1, salesAgentId: 'sa1' },
  { zoneId: 'z06', districtId: 1, salesAgentId: 'sa1' },
  { zoneId: 'z07', districtId: 2, salesAgentId: 'sa2' },
  { zoneId: 'z08', districtId: 2, salesAgentId: 'sa2' },
  { zoneId: 'z09', districtId: 2, salesAgentId: 'sa2' },
  { zoneId: 'z10', districtId: 3, salesAgentId: 'sa3' },
  { zoneId: 'z11', districtId: 3, salesAgentId: 'sa3' },
  { zoneId: 'z12', districtId: 3, salesAgentId: 'sa3' },
]
