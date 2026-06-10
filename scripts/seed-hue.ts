/**
 * scripts/seed-hue.ts
 *
 * Generate SQL INSERT for 8 zones in Huế
 * Grid 4×2, polygon grid-aligned (share edges)
 *
 * Layout:
 *   ┌┬┬┬┐  Row 1: lat 16.465 -> 16.50
 *   │ hue01│ hue02│ hue03│ hue04│
 *   ├┼┼┼┤  Row 0: lat 16.43 -> 16.465
 *   │ hue05│ hue06│ hue07│ hue08│
 *   └┴┴┴┘
 *   Col 0        Col 1        Col 2        Col 3
 *   107.54->107.57 107.57->107.60 107.60->107.63 107.63->107.66
 */

//  Grid boundaries 
const C0 = 107.54, C1 = 107.57, C2 = 107.60, C3 = 107.63, C4 = 107.66
const R0 = 16.43,  R1 = 16.465, R2 = 16.50

// Midpoints
const MC01 = (C0 + C1) / 2  // 107.555
const MC12 = (C1 + C2) / 2  // 107.585
const MC23 = (C2 + C3) / 2  // 107.615
const MC34 = (C3 + C4) / 2  // 107.645
const MR01 = (R0 + R1) / 2  // 16.4475
const MR12 = (R1 + R2) / 2  // 16.4825

function centroidOf(ring: number[][]): { lat: number; lng: number } {
  const pts = ring.slice(0, -1)
  const lat = pts.reduce((s, p) => s + p[1]!, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p[0]!, 0) / pts.length
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 }
}

//  Polygon rings [lng, lat] - GeoJSON spec 

// Row 1 (top)
const hue01Ring = [[C0,R1],[MC01,R1],[C1,R1],[C1,MR12],[C1,R2],[MC01,R2+0.002],[C0,R2],[C0,MR12],[C0,R1]]
const hue02Ring = [[C1,R1],[MC12,R1],[C2,R1],[C2,R2],[MC12,R2],[C1,R2],[C1,MR12],[C1,R1]]
const hue03Ring = [[C2,R1],[MC23,R1],[C3,R1],[C3,MR12],[C3,R2],[MC23,R2-0.002],[C2,R2],[C2,R1]]
const hue04Ring = [[C3,R1],[MC34,R1],[C4,R1+0.003],[C4,MR12],[C4,R2],[MC34,R2],[C3,R2],[C3,MR12],[C3,R1]]

// Row 0 (bottom)
const hue05Ring = [[C0,R0],[MC01,R0+0.002],[C1,R0],[C1,R1],[MC01,R1],[C0,R1],[C0,R0]]
const hue06Ring = [[C1,R0],[MC12,R0],[C2,R0+0.002],[C2,R1],[MC12,R1],[C1,R1],[C1,R0]]
const hue07Ring = [[C2,R0+0.002],[MC23,R0],[C3,R0],[C3,R1],[MC23,R1],[C2,R1],[C2,R0+0.002]]
const hue08Ring = [[C3,R0],[MC34,R0+0.002],[C4,R0],[C4,R1+0.003],[MC34,R1],[C3,R1],[C3,R0]]

export const HUE_ZONES = [
  { id: 'hue01', name: 'Kim Long',    ring: hue01Ring, activities: [['ahue01a','CUSTOMER',80],['ahue01b','ORDER',55]]  },
  { id: 'hue02', name: 'Phú Hội',     ring: hue02Ring, activities: [['ahue02a','CUSTOMER',120],['ahue02b','ORDER',85]] },
  { id: 'hue03', name: 'Vĩnh Ninh',   ring: hue03Ring, activities: [['ahue03a','CUSTOMER',95],['ahue03b','ORDER',65]]  },
  { id: 'hue04', name: 'Phú Thuận',   ring: hue04Ring, activities: [['ahue04a','CUSTOMER',70],['ahue04b','ORDER',45]]  },
  { id: 'hue05', name: 'Tây Lộc',     ring: hue05Ring, activities: [['ahue05a','CUSTOMER',110],['ahue05b','ORDER',75]] },
  { id: 'hue06', name: 'Thuận Hoà',   ring: hue06Ring, activities: [['ahue06a','CUSTOMER',140],['ahue06b','ORDER',100]] },
  { id: 'hue07', name: 'Phú Hoà',     ring: hue07Ring, activities: [['ahue07a','CUSTOMER',90],['ahue07b','ORDER',60]]  },
  { id: 'hue08', name: 'An Cựu',      ring: hue08Ring, activities: [['ahue08a','CUSTOMER',160],['ahue08b','ORDER',115]] },
] as const

export const HUE_AGENTS = [
  { id: 'sa-hue0', name: 'Hồ Xuân Phong', region: 'Bắc Huế', capacity: 300 },
  { id: 'sa-hue1', name: 'Lý Thị Ngọc',   region: 'Nam Huế', capacity: 350 },
] as const

export const HUE_ASSIGNMENTS = [
  ['hue01',0,'sa-hue0'],['hue02',0,'sa-hue0'],['hue03',0,'sa-hue0'],['hue04',0,'sa-hue0'],
  ['hue05',1,'sa-hue1'],['hue06',1,'sa-hue1'],['hue07',1,'sa-hue1'],['hue08',1,'sa-hue1'],
] as const

export { centroidOf as centroidOfHue }
