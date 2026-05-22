/**
 * Mock SalesAgents — thứ tự canonical KHÔNG ĐƯỢC THAY ĐỔI (OPEN-4).
 * sa0 → index 0 → district 0
 * sa1 → index 1 → district 1
 * sa2 → index 2 → district 2
 * sa3 → index 3 → district 3
 *
 * Khi pass vào SalesFacade: luôn dùng MOCK_AGENTS trực tiếp, không sort.
 * Nếu cần sort để hiển thị UI: sort bản copy [...MOCK_AGENTS].sort(...)
 */

import type { SalesAgent } from '../../facades/viewmodels.js'

// CRITICAL: Thứ tự này là canonical — không sort trước khi inject SalesFacade
export const MOCK_AGENTS: SalesAgent[] = [
  {
    id: 'sa0',
    name: 'Nguyễn Văn Alpha',
    activeRegion: 'Tây-Bắc Hà Nội',
    capacity: 400,
  },
  {
    id: 'sa1',
    name: 'Trần Thị Beta',
    activeRegion: 'Đông-Bắc Hà Nội',
    capacity: 500,
  },
  {
    id: 'sa2',
    name: 'Lê Quốc Gamma',
    activeRegion: 'Đông-Nam Hà Nội',
    capacity: 600,
  },
  {
    id: 'sa3',
    name: 'Phạm Hữu Delta',
    activeRegion: 'Tây-Nam Hà Nội',
    capacity: 350,
  },
]

// Current logged-in sales agent (cho SalesPage demo)
export const CURRENT_SALES_ID = 'sa0'
