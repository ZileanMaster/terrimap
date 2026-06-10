import type { SalesAgent, Zone, GeoJSONPolygon } from '../types/domain.js';
import type { Snapshot } from '../services/VersionService.js';
import type { PartitionResult } from '../services/TerritoryService.js';
import type { DistrictSummary } from '../services/ActivityService.js';
import type { Assignment } from '../lib/partition.js';

//  ViewModels
export type { Assignment };
export type { Snapshot, PartitionResult, DistrictSummary };
export type { Zone, GeoJSONPolygon, SalesAgent };

//  Matrix types 

/** Ma trận kề: zoneId -> danh sách các zoneId lân cận */
export type AdjMatrix = Record<string, string[]>;
/** Ma trận khoảng cách: zoneId -> { zoneId: km } */
export type DistMatrix = Record<string, Record<string, number>>;

//  ViewModel thuật toán (L4b-3) 

/**
 * Violation ViewModel - làm phẳng union type thành định dạng thân thiện với UI.
 * L4 không cần biết chi tiết BalanceViolation / ContiguityViolation / DiameterViolation.
 */
export interface ViolationVM {
  /** Loại vi phạm. */
  type:        'BALANCE' | 'CONTIGUITY' | 'DIAMETER';
  /** ID district vi phạm (-1 nếu không xác định). */
  districtId:  number;
  /** Mô tả human-readable, i18n-ready. */
  message:     string;
  /** CONTIGUITY -> 'error' (nghiêm trọng), còn lại -> 'warning'. */
  severity:    'warning' | 'error';
}

// AlgorithmResultVM - ViewModel bọc PartitionResult với các trường đã được chọn lọc và làm phẳng để L4 dễ tiêu thụ mà không cần biết chi tiết type nội bộ của L1/L2.
export interface AlgorithmResultVM {
  /** Zone -> district -> salesAgent mappings. Dùng để tô màu map + filter theo SA. */
  assignments:    Assignment[];

//  Chỉ số (flat - không expose PartitionMetrics) 
/** Điểm cân bằng workload giữa các cụm. 0-100, càng cao càng tốt. */
  balanceScore:   number;
  /** Khách hàng trung bình trên mỗi cụm sau phân chia. */
  avgCustomersPerDistrict: number;
/** Số vi phạm ràng buộc. */
  violationCount: number;
/** Đường kính tối đa (km) trong tất cả cụm. */
  maxDiameter:    number;

//  Metadata thuật toán 
  /** Thuật toán đã dùng. */
  algo:           'greedy' | 'local-search' | 'sa';
  /** Thời gian chạy (ms). */
  durationMs:     number;

  //  UI hints 
  /** true -> balanceScore < 60 và algo !== 'sa' -> hiển thị banner gợi ý SA. */
  suggestSA:      boolean;
/** Chi tiết violations - dùng cho tooltip hoặc panel mở rộng. */
  violations:     ViolationVM[];
}

//  ViewModel cho Admin 

/** Map từ districtId (số) -> salesAgentId (chuỗi). */
export type DistrictMap = Record<number, string>;

export interface SalesManagement {
  sales: SalesAgent[];
  districtMap: DistrictMap;
}

export interface ConstraintConfig {
/** Ngưỡng adjacency (km). Mặc định là 50. */
  adjThresholdKm?: number;
/** Tỷ lệ cân bằng ngưỡng. Mặc định là 1.5. */
  balanceThreshold?: number;
  /** Ngưỡng diameter tối đa (km). Không bắt buộc. */
  maxDiameterKm?: number;
/** Số cụm. */
  m?: number;
  /** Thuật toán mặc định. */
  defaultAlgo?: 'greedy' | 'local-search' | 'sa';
}

export interface ReportData {
  generatedAt: string;          // Chuỗi ISO 8601
/** Dữ liệu zones thô để export / consumer phía sau. */
  zones: Zone[];
/** Dữ liệu assignments thô tương ứng. */
  assignments: Assignment[];
  totalZones: number;
  totalDistricts: number;
  totalSales: number;
  totalCustomers: number;
  totalOrders: number;
/** balanceScore trung bình của tất cả cụm. */
  avgBalanceScore: number;
  snapshotCount: number;
}

//  ViewModel cho Điều phối 

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

//  ViewModel cho Sales 

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
/** Dự báo đơn tháng tới (currentOrders * 1.05 chỉ là giá trị tạm). */
  forecastedOrders: number;
  /** Ngày tính forecast (ISO 8601). */
  forecastedAt: string;
}

//  ViewModel cho activity 

/** Bản ghi parse từ CSV - dùng cho import activity hàng loạt. */
export interface ActivityRecord {
  zoneId: string;
  customers: number;
  orders: number;
}

//  Báo cáo cụm (chỉ số người dùng nhập theo cụm) 

/**
 * DistrictReport - user-entered KPIs for a cluster (district) in a given period.
 * Stored in Supabase (district_reports) and mirrored in localStorage for offline fallback.
 */
export interface DistrictReport {
  id:         string;
  projectId?: string | undefined;
  regionId:   string;
  districtId: number;
  userId:     string;
  period:     string;     // Chu?i d?ng 'YYYY-MM'
  customers:  number;
  orders:     number;
  revenue?:   number;
  note?:      string | undefined;
  updatedAt:  string;     // Chu?i ISO
}
