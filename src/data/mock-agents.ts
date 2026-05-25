/**
 * Mock SalesAgents — 20 agents Hà Nội + 2 agents TP.HCM = 22 total
 */

import type { SalesAgent } from '../../facades/viewmodels.js'

const hnMOCK_AGENTS: SalesAgent[] = [
  { id: 'sales.test@terrimap.vn', name: 'Nhân Viên Test (Admin/Sales)', activeRegion: 'Hà Nội', capacity: 450 }
]

// Generate 19 more Hanoi agents (HN-1 to HN-19)
for (let i = 1; i <= 19; i++) {
  hnMOCK_AGENTS.push({
    id: `sales_hn_${i}@terrimap.vn`,
    name: `Nhân Viên HN-${i}`,
    activeRegion: 'Hà Nội',
    capacity: 350 + (i * 15) % 300 // capacity between 350 and 650
  })
}

const hcmMOCK_AGENTS: SalesAgent[] = [
  { id: 'sales_hcm_1@terrimap.vn', name: 'Vũ Thị F',       activeRegion: 'Hồ Chí Minh', capacity: 550 },
  { id: 'sales_hcm_2@terrimap.vn', name: 'Đặng Minh G',    activeRegion: 'Hồ Chí Minh', capacity: 480 },
]

export const MOCK_AGENTS: SalesAgent[] = [...hnMOCK_AGENTS, ...hcmMOCK_AGENTS]

export const CURRENT_SALES_ID = 'sales.test@terrimap.vn'
