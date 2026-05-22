/**
 * facades/index.ts
 *
 * Re-export tất cả L3 Role Façades, ViewModels và PermissionError.
 */

// ─── Errors ───────────────────────────────────────────────────────────────────
export { PermissionError } from './errors.js';
export type { PermissionErrorCode, PermissionErrorDetails } from './errors.js';

// ─── ViewModels ───────────────────────────────────────────────────────────────
export type {
  // Admin
  SalesManagement,
  DistrictMap,
  ConstraintConfig,
  ReportData,
  // Coordinator
  TeamOverview,
  SalesWithZones,
  AssignResult,
  HistoryEntry,
  // Sales
  MyDistrict,
  Customer,
  OrderForecast,
  // Re-exports từ L2
  Snapshot,
  PartitionResult,
  DistrictSummary,
} from './viewmodels.js';

// ─── Façades ──────────────────────────────────────────────────────────────────
export { AdminFacade } from './AdminFacade.js';
export { CoordinatorFacade } from './CoordinatorFacade.js';
export { SalesFacade } from './SalesFacade.js';
