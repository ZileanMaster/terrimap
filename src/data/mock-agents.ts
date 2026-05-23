/**
 * Mock SalesAgents — 6 agents cho 2 thành phố
 *
 * CRITICAL (OPEN-4): Thứ tự canonical KHÔNG ĐƯỢC THAY ĐỔI.
 * sa0-sa3 → Hà Nội, sa4-sa5 → HCM
 */

import type { SalesAgent } from '../../facades/viewmodels.js'

export const MOCK_AGENTS: SalesAgent[] = [
  {
    id: 'sa0',
    name: 'Nguyễn Văn A',
    activeRegion: 'Hà Nội',
    capacity: 400,
  },
  {
    id: 'sa1',
    name: 'Trần Thị B',
    activeRegion: 'Hà Nội',
    capacity: 500,
  },
  {
    id: 'sa2',
    name: 'Lê Văn C',
    activeRegion: 'Hà Nội',
    capacity: 600,
  },
  {
    id: 'sa3',
    name: 'Phạm Thị D',
    activeRegion: 'Hồ Chí Minh',
    capacity: 350,
  },
  {
    id: 'sa4',
    name: 'Hoàng Văn E',
    activeRegion: 'Hồ Chí Minh',
    capacity: 450,
  },
  {
    id: 'sa5',
    name: 'Vũ Thị F',
    activeRegion: 'Hồ Chí Minh',
    capacity: 550,
  },
]

// Current logged-in sales agent (cho SalesPage demo)
export const CURRENT_SALES_ID = 'sa0'
