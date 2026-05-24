/**
 * Mock SalesAgents — 8 agents cho 2 thành phố
 *
 * CRITICAL (OPEN-4): Thứ tự canonical KHÔNG ĐƯỢC THAY ĐỔI.
 * sa0-sa4 → Hà Nội (5 districts), sa5-sa7 → HCM (3 districts)
 * Mỗi agent quản lý đúng 1 district.
 */

import type { SalesAgent } from '../../facades/viewmodels.js'

export const MOCK_AGENTS: SalesAgent[] = [
  // Hà Nội — 5 agents cho 5 districts
  { id: 'sa0', name: 'Nguyễn Văn A',  activeRegion: 'Hà Nội', capacity: 400 },
  { id: 'sa1', name: 'Trần Thị B',    activeRegion: 'Hà Nội', capacity: 500 },
  { id: 'sa2', name: 'Lê Văn C',      activeRegion: 'Hà Nội', capacity: 600 },
  { id: 'sa3', name: 'Phạm Thị D',    activeRegion: 'Hà Nội', capacity: 350 },
  { id: 'sa4', name: 'Hoàng Văn E',   activeRegion: 'Hà Nội', capacity: 450 },
  // HCM — 3 agents cho 3 districts
  { id: 'sa5', name: 'Vũ Thị F',      activeRegion: 'Hồ Chí Minh', capacity: 550 },
  { id: 'sa6', name: 'Đặng Minh G',   activeRegion: 'Hồ Chí Minh', capacity: 480 },
  { id: 'sa7', name: 'Bùi Thanh H',   activeRegion: 'Hồ Chí Minh', capacity: 520 },
]

// Current logged-in sales agent (cho SalesPage demo)
export const CURRENT_SALES_ID = 'sa0'
