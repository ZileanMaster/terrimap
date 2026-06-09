/**
 * src/data/regions.ts — Region data model
 *
 * Region = khu vực địa lý cấp cao (Hà Nội, HCM, Huế).
 * Admin quản lý regions và gán Coordinator phụ trách.
 * Coordinator chỉ thấy zones thuộc region mình chọn.
 */

export interface Region {
  id:            string
  name:          string
  coordinatorId?: string | undefined   // agent phụ trách
  center:        { lat: number; lng: number }
  zoom:          number
}

export const DEFAULT_REGIONS: Region[] = [
  {
    id:     'region-hn',
    name:   'Hà Nội',
    center: { lat: 21.03, lng: 105.83 },
    zoom:   12,
  },
  {
    id:     'region-hcm',
    name:   'TP. Hồ Chí Minh',
    center: { lat: 10.82, lng: 106.63 },
    zoom:   12,
  },
  {
    id:     'region-hue',
    name:   'Huế',
    center: { lat: 16.46, lng: 107.59 },
    zoom:   13,
  },
]
