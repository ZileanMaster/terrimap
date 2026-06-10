/**
 * scripts/seed-hcm.ts
 *
 * Generate SQL INSERT for 12 zones in TP. Hồ Chí Minh
 * Grid 4×3, polygon grid-aligned (share edges)
 *
 * Layout:
 *   ┌┬┬┐  Row 3: lat 10.84 -> 10.88
 *   │ hcm01│ hcm02│ hcm03│
 *   ├┼┼┤  Row 2: lat 10.80 -> 10.84
 *   │ hcm04│ hcm05│ hcm06│
 *   ├┼┼┤  Row 1: lat 10.76 -> 10.80
 *   │ hcm07│ hcm08│ hcm09│
 *   ├┼┼┤  Row 0: lat 10.72 -> 10.76
 *   │ hcm10│ hcm11│ hcm12│
 *   └┴┴┘
 *   Col 0        Col 1        Col 2
 *   106.62->106.68 106.68->106.74 106.74->106.80
 */

//  Grid boundaries 
const C0 = 106.62, C1 = 106.68, C2 = 106.74, C3 = 106.80
const R0 = 10.72,  R1 = 10.76,  R2 = 10.80,  R3 = 10.84, R4 = 10.88

// Midpoints for irregular shapes
const MC01 = (C0 + C1) / 2  // 106.65
const MC12 = (C1 + C2) / 2  // 106.71
const MC23 = (C2 + C3) / 2  // 106.77
const MR01 = (R0 + R1) / 2  // 10.74
const MR12 = (R1 + R2) / 2  // 10.78
const MR23 = (R2 + R3) / 2  // 10.82
const MR34 = (R3 + R4) / 2  // 10.86

function centroidOf(ring: number[][]): { lat: number; lng: number } {
  const pts = ring.slice(0, -1)
  const lat = pts.reduce((s, p) => s + p[1]!, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p[0]!, 0) / pts.length
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 }
}

//  Polygon rings [lng, lat] - GeoJSON spec 

// Row 3 (top)
const hcm01Ring = [[C0,R3],[MC01,R3],[C1,R3],[C1,MR34],[C1,R4],[MC01,R4+0.005],[C0,R4],[C0,MR34],[C0,R3]]
const hcm02Ring = [[C1,R3],[MC12,R3],[C2,R3],[C2,R4],[MC12,R4],[C1,R4],[C1,MR34],[C1,R3]]
const hcm03Ring = [[C2,R3],[MC23,R3],[C3,R3+0.005],[C3,MR34],[C3,R4],[MC23,R4-0.005],[C2,R4],[C2,R3]]

// Row 2
const hcm04Ring = [[C0,R2],[MC01,R2+0.005],[C1,R2],[C1,R3],[MC01,R3],[C0,R3],[C0,R2]]
const hcm05Ring = [[C1,R2],[MC12,R2],[C2,R2],[C2,MR23],[C2,R3],[MC12,R3],[C1,R3],[C1,R2]]
const hcm06Ring = [[C2,R2],[MC23,R2-0.005],[C3,R2],[C3,R3+0.005],[MC23,R3],[C2,R3],[C2,MR23],[C2,R2]]

// Row 1
const hcm07Ring = [[C0,R1],[MC01,R1],[C1,R1+0.005],[C1,R2],[MC01,R2+0.005],[C0,R2],[C0,R1]]
const hcm08Ring = [[C1,R1+0.005],[MC12,R1],[C2,R1],[C2,MR12],[C2,R2],[MC12,R2],[C1,R2],[C1,R1+0.005]]
const hcm09Ring = [[C2,R1],[MC23,R1+0.005],[C3,R1],[C3,R2],[MC23,R2-0.005],[C2,R2],[C2,MR12],[C2,R1]]

// Row 0 (bottom)
const hcm10Ring = [[C0,R0],[MC01,R0+0.005],[C1,R0],[C1,R1+0.005],[MC01,R1],[C0,R1],[C0,R0]]
const hcm11Ring = [[C1,R0],[MC12,R0],[C2,R0+0.005],[C2,R1],[MC12,R1],[C1,R1+0.005],[C1,R0]]
const hcm12Ring = [[C2,R0+0.005],[MC23,R0],[C3,R0],[C3,MR01],[C3,R1],[MC23,R1+0.005],[C2,R1],[C2,R0+0.005]]

export const HCM_ZONES = [
  { id: 'hcm01', name: 'Tân Bình',    ring: hcm01Ring, activities: [['ahcm01a','CUSTOMER',180],['ahcm01b','ORDER',120]] },
  { id: 'hcm02', name: 'Tân Phú',     ring: hcm02Ring, activities: [['ahcm02a','CUSTOMER',150],['ahcm02b','ORDER',95]]  },
  { id: 'hcm03', name: 'Quận 12',     ring: hcm03Ring, activities: [['ahcm03a','CUSTOMER',130],['ahcm03b','ORDER',80]]  },
  { id: 'hcm04', name: 'Gò Vấp',      ring: hcm04Ring, activities: [['ahcm04a','CUSTOMER',260],['ahcm04b','ORDER',175]] },
  { id: 'hcm05', name: 'Phú Nhuận',   ring: hcm05Ring, activities: [['ahcm05a','CUSTOMER',200],['ahcm05b','ORDER',140]] },
  { id: 'hcm06', name: 'Bình Thạnh',  ring: hcm06Ring, activities: [['ahcm06a','CUSTOMER',280],['ahcm06b','ORDER',190]] },
  { id: 'hcm07', name: 'Bình Tân',    ring: hcm07Ring, activities: [['ahcm07a','CUSTOMER',170],['ahcm07b','ORDER',110]] },
  { id: 'hcm08', name: 'Quận 1',      ring: hcm08Ring, activities: [['ahcm08a','CUSTOMER',350],['ahcm08b','ORDER',250],['ahcm08c','REVENUE',12000]] },
  { id: 'hcm09', name: 'Quận 3',      ring: hcm09Ring, activities: [['ahcm09a','CUSTOMER',220],['ahcm09b','ORDER',155]] },
  { id: 'hcm10', name: 'Quận 7',      ring: hcm10Ring, activities: [['ahcm10a','CUSTOMER',300],['ahcm10b','ORDER',210]] },
  { id: 'hcm11', name: 'Thủ Đức',     ring: hcm11Ring, activities: [['ahcm11a','CUSTOMER',240],['ahcm11b','ORDER',165]] },
  { id: 'hcm12', name: 'Quận 2',      ring: hcm12Ring, activities: [['ahcm12a','CUSTOMER',190],['ahcm12b','ORDER',130]] },
] as const

export const HCM_AGENTS = [
  { id: 'sa-hcm0', name: 'Võ Minh Tâm',    region: 'Bắc TP.HCM', capacity: 500 },
  { id: 'sa-hcm1', name: 'Ngô Thanh Hương', region: 'Trung TP.HCM', capacity: 600 },
  { id: 'sa-hcm2', name: 'Đỗ Anh Khoa',    region: 'Nam TP.HCM', capacity: 450 },
] as const

export const HCM_ASSIGNMENTS = [
  ['hcm01',0,'sa-hcm0'],['hcm02',0,'sa-hcm0'],['hcm03',0,'sa-hcm0'],['hcm04',0,'sa-hcm0'],
  ['hcm05',1,'sa-hcm1'],['hcm06',1,'sa-hcm1'],['hcm07',1,'sa-hcm1'],['hcm08',1,'sa-hcm1'],
  ['hcm09',2,'sa-hcm2'],['hcm10',2,'sa-hcm2'],['hcm11',2,'sa-hcm2'],['hcm12',2,'sa-hcm2'],
] as const

export { centroidOf }
