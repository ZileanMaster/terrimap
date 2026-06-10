import type { SalesAgent } from '../../facades/viewmodels.js'

const hnMOCK_AGENTS: SalesAgent[] = [
  { id: 'sales.test@terrimap.vn', name: 'Nhân Viên Test (Admin/Sales)', activeRegion: 'Hà Nội', capacity: 450 }
]


for (let i = 1; i <= 19; i++) {
  hnMOCK_AGENTS.push({
    id: `sales_hn_${i}@terrimap.vn`,
    name: `Nhân Viên HN-${i}`,
    activeRegion: 'Hà Nội',
    capacity: 350 + (i * 15) % 300
  })
}

const hcmMOCK_AGENTS: SalesAgent[] = [
  { id: 'sales_hcm_1@terrimap.vn', name: 'Vũ Thị F',       activeRegion: 'Hồ Chí Minh', capacity: 550 },
  { id: 'sales_hcm_2@terrimap.vn', name: 'Đặng Minh G',    activeRegion: 'Hồ Chí Minh', capacity: 480 },
]

export const MOCK_AGENTS: SalesAgent[] = [...hnMOCK_AGENTS, ...hcmMOCK_AGENTS]

export const CURRENT_SALES_ID = 'sales.test@terrimap.vn'
