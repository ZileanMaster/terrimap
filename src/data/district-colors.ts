const DISTRICT_COLORS: Record<number, string> = {
  0: '#3b82f6', 
  1: '#10b981', 
  2: '#f59e0b', 
  3: '#8b5cf6', 
  4: '#ef4444', 
  5: '#06b6d4', 
  6: '#f97316', 
  7: '#ec4899',
  8: '#84cc16',
  9: '#6366f1',
}

const DISTRICT_COLORS_LIGHT: Record<number, string> = {
  ...DISTRICT_COLORS,
}

/** Trả về màu hex cho districtId. Fallback về blue nếu id > 9. */
export function getDistrictColor(districtId: number): string {
  return DISTRICT_COLORS[districtId % 10] ?? DISTRICT_COLORS[0]!
}

/** Trả về màu fill nhạt hơn cho vùng. */
export function getDistrictFillColor(districtId: number): string {
  return getDistrictColor(districtId)
}

/** Trả về fill opacity */
export const DISTRICT_FILL_OPACITY = 0.35
export const DISTRICT_FILL_OPACITY_SELECTED = 0.65
export const DISTRICT_WEIGHT = 2
export const DISTRICT_WEIGHT_SELECTED = 4
