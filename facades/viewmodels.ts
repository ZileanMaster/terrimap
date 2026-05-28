/**
 * facades/viewmodels.ts
 *
 * ViewModels cho L3 Role Façades.
 * Không bao giờ expose raw domain objects (Zone, SalesAgent...) trực tiếp.
 * L4 UI Shell consume các types này — không import từ types/domain.ts.
 *
 * LAYER RULE: L4 (src/) PHẢI import tất cả types từ file này, không từ lib/ hay services/.
 */

import type { SalesAgent, Zone, GeoJSONPolygon } from '../types/domain.js';
import type { Snapshot } from '../services/VersionService.js';
import type { PartitionResult } from '../services/TerritoryService.js';
import type { DistrictSummary } from '../services/ActivityService.js';
import type { Assignment } from '../lib/partition.js';

// ─── Re-exports: L4 import từ đây, không từ lib/ hay services/ ───────────────

/**
 * Re-export Assignment — L4 files dùng type này qua viewmodels,
 * không import trực tiếp từ lib/partition.ts.
 * Đảm bảo OPEN-4: salesAgents[] order không bị sort.
 */
export type { Assignment };

/**
 * Re-export PartitionResult — vẫn cần cho L3 internal và tests.
 * L4 nên dùng AlgorithmResultVM thay vì PartitionResult trực tiếp.
 */
export type { Snapshot, PartitionResult, DistrictSummary };

/**
 * Re-export Zone, GeoJSONPolygon, SalesAgent cho L4 (DrawingToolbar, MatrixViewer, mock-agents).
 * L4 KHÔNG import trực tiếp từ types/domain.ts.
 */
export type { Zone, GeoJSONPolygon, SalesAgent };

// ─── Matrix types ─────────────────────────────────────────────────────────────

/** Adjacency matrix: zoneId → list of neighbor zoneIds */
export type AdjMatrix = Record<string, string[]>;
/** Distance matrix: zoneId → { zoneId: km } */
export type DistMatrix = Record<string, Record<string, number>>;

// ─── Algorithm ViewModels (L4b-3) ────────────────────────────────────────────

/**
 * Violation ViewModel — flatten union type thành format UI-friendly.
 * L4 không cần biết chi tiết BalanceViolation / ContiguityViolation / DiameterViolation.
 */
export interface ViolationVM {
  /** Loại vi phạm. */
  type:        'BALANCE' | 'CONTIGUITY' | 'DIAMETER';
  /** ID district vi phạm (-1 nếu không xác định). */
  districtId:  number;
  /** Mô tả human-readable, i18n-ready. */
  message:     string;
  /** CONTIGUITY → 'error' (nghiêm trọng), còn lại → 'warning'. */
  severity:    'warning' | 'error';
}

/**
 * AlgorithmResultVM — ViewModel bọc PartitionResult cho L4.
 *
 * Map renderer cần assignments[] (zoneId + districtId + salesAgentId) vì:
 * - Tô màu polygon: zoneId → districtId
 * - L4b-1: click sales card → filter assignments by salesAgentId → highlight zones
 * KHÔNG dùng Record<string,number> vì mất salesAgentId.
 *
 * ResultMetrics chỉ cần: balanceScore, violationCount, maxDiameter, algo, durationMs, suggestSA.
 * Flatten ra top-level thay vì giữ trong PartitionMetrics để tránh L1 type leak.
 */
export interface AlgorithmResultVM {
  /** Zone → district → salesAgent mappings. Dùng để tô màu map + filter theo SA. */
  assignments:    Assignment[];

  // ── Metrics (flat — không expose PartitionMetrics) ──────────────────────────
  /** Điểm cân bằng workload giữa các districts. 0-100, cao hơn = tốt hơn. */
  balanceScore:   number;
  /** Số vi phạm constraint. */
  violationCount: number;
  /** Đường kính tối đa (km) trong tất cả districts. */
  maxDiameter:    number;

  // ── Algorithm metadata ───────────────────────────────────────────────────────
  /** Thuật toán đã dùng. */
  algo:           'greedy' | 'local-search' | 'sa';
  /** Thời gian chạy (ms). */
  durationMs:     number;

  // ── UI hints ─────────────────────────────────────────────────────────────────
  /** true → balanceScore < 60 và algo !== 'sa' → hiển thị banner gợi ý SA. */
  suggestSA:      boolean;
  /** Chi tiết violations — dành cho tooltip hoặc expand panel. */
  violations:     ViolationVM[];
}

// ─── Admin ViewModels ─────────────────────────────────────────────────────────

/** Map từ districtId (numeric) → salesAgentId (string). */
export type DistrictMap = Record<number, string>;

export interface SalesManagement {
  sales: SalesAgent[];
  districtMap: DistrictMap;
}

export interface ConstraintConfig {
  /** Ngưỡng adjacency (km). Mặc định 50. */
  adjThresholdKm?: number;
  /** Threshold balance ratio. Mặc định 1.5. */
  balanceThreshold?: number;
  /** Ngưỡng diameter tối đa (km). Không bắt buộc. */
  maxDiameterKm?: number;
  /** Số districts. */
  m?: number;
  /** Thuật toán mặc định. */
  defaultAlgo?: 'greedy' | 'local-search' | 'sa';
}

export interface ReportData {
  generatedAt: string;          // ISO 8601
  /** Raw zones để export / downstream consumers. */
  zones: Zone[];
  /** Raw assignments tương ứng. */
  assignments: Assignment[];
  totalZones: number;
  totalDistricts: number;
  totalSales: number;
  totalCustomers: number;
  totalOrders: number;
  /** balanceScore trung bình tất cả districts. */
  avgBalanceScore: number;
  snapshotCount: number;
}

// ─── Coordinator ViewModels ───────────────────────────────────────────────────

/** SalesAgent kèm danh sách zones được gán. */
export interface SalesWithZones {
  salesId: string;
  salesName: string;
  activeRegion: string;
  capacity: number;
  assignedZones: Array<{
    zoneId: string;
    zoneName: string;
    customers: number;
    orders: number;
  }>;
}

export interface TeamOverview {
  sales: SalesWithZones[];
  totalKH: number;
  totalOrders: number;
}

export interface AssignResult {
  ok: boolean;
  zoneId: string;
  newSalesId: string;
  previousSalesId: string | null;
}

export interface HistoryEntry {
  label: string;
  version: string;
  timestamp: string;
  zoneCount: number;
}

// ─── Sales ViewModels ─────────────────────────────────────────────────────────

export interface MyDistrict {
  zones: Zone[];
  summary: DistrictSummary;
}

export interface Customer {
  zoneId: string;
  zoneName: string;
  count: number;
  location?: { lat: number; lng: number };
}

export interface OrderForecast {
  districtId: number;
  /** Tổng đơn thực tế hiện tại. */
  currentOrders: number;
  /** Dự báo đơn tháng tới (currentOrders * 1.05 làm placeholder). */
  forecastedOrders: number;
  /** Ngày tính forecast (ISO 8601). */
  forecastedAt: string;
}

// ─── Activity ViewModels ──────────────────────────────────────────────────────

/** Record parsed từ CSV — dùng cho activity batch import. */
export interface ActivityRecord {
  zoneId: string;
  customers: number;
  orders: number;
}

// ─── District reports (user-entered metrics per cluster) ─────────────────────

/**
 * DistrictReport — user-entered KPIs for a cluster (district) in a given period.
 * Stored in Supabase (district_reports) and mirrored in localStorage for offline fallback.
 */
export interface DistrictReport {
  id:         string;
  projectId?: string;
  regionId:   string;
  districtId: number;
  userId:     string;
  period:     string;     // 'YYYY-MM'
  customers:  number;
  orders:     number;
  note?:      string;
  updatedAt:  string;     // ISO
}
