/**
 * Mock SalesAgents — 6 agents dạng email thực tế thay thế cho sa0..sa7
 */

import type { SalesAgent } from '../../facades/viewmodels.js'

export const MOCK_AGENTS: SalesAgent[] = [
  { id: 'sales.test@terrimap.vn',  name: 'Nhân Viên Test', activeRegion: 'Hà Nội', capacity: 450 },
  { id: 'sales_hn_1@terrimap.vn',  name: 'Nguyễn Văn A',   activeRegion: 'Hà Nội', capacity: 400 },
  { id: 'sales_hn_2@terrimap.vn',  name: 'Trần Thị B',     activeRegion: 'Hà Nội', capacity: 500 },
  { id: 'sales_hn_3@terrimap.vn',  name: 'Lê Văn C',       activeRegion: 'Hà Nội', capacity: 600 },
  { id: 'sales_hcm_1@terrimap.vn', name: 'Vũ Thị F',       activeRegion: 'Hồ Chí Minh', capacity: 550 },
  { id: 'sales_hcm_2@terrimap.vn', name: 'Đặng Minh G',    activeRegion: 'Hồ Chí Minh', capacity: 480 },
]

export const CURRENT_SALES_ID = 'sales.test@terrimap.vn'
