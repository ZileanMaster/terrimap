//  Lỗi 
export { PermissionError } from './errors.js';
export type { PermissionErrorCode, PermissionErrorDetails } from './errors.js';

//  ViewModels 
export type {
  // Cho Admin
  SalesManagement,
  DistrictMap,
  ConstraintConfig,
  ReportData,
  // Cho Điều phối
  TeamOverview,
  SalesWithZones,
  AssignResult,
  HistoryEntry,
  // Cho Nhân sự
  MyDistrict,
  Customer,
  OrderForecast,
  // Re-export từ L2
  Snapshot,
  PartitionResult,
  DistrictSummary,
} from './viewmodels.js';

//  Facades 
export { AdminFacade } from './AdminFacade.js';
export { CoordinatorFacade } from './CoordinatorFacade.js';
export { SalesFacade } from './SalesFacade.js';
