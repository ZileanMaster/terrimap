/**
 * L0 — Data Primitives cho hệ thống Commercial Territory Design.
 * Cung cấp Nguồn Sự Thật Duy Nhất (Single Source of Truth).
 * 
 * Nguyên tắc thiết kế áp dụng:
 * 1. Self-contained (Không import bất kỳ UI hay logic library nào).
 * 2. Discriminated Unions cho Zone states.
 * 3. Invariant comments để quy định các ràng buộc dữ liệu hợp lệ.
 */

// ==========================================
// 1. CHUẨN ĐỊA LÝ & DATA CƠ BẢN
// ==========================================

export interface Coordinate {
  /** INVARIANT: Phải nằm trong khoảng [-180, 180] */
  lng: number;
  /** INVARIANT: Phải nằm trong khoảng [-90, 90] */
  lat: number;
}

export interface GeoJSONSimplePolygon {
  type: 'Polygon';
  /** INVARIANT: Tọa độ điểm đầu và điểm cuối của một polygon khép kín phải trùng nhau. */
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  /** INVARIANT: Tọa độ điểm đầu và điểm cuối của mỗi polygon khép kín phải trùng nhau. */
  coordinates: number[][][][];
}

export type GeoJSONPolygon = GeoJSONSimplePolygon | GeoJSONMultiPolygon;


export type ActivityType = 'CUSTOMER' | 'ORDER' | 'REVENUE';

export interface Activity {
  id: string;
  type: ActivityType;
  /** INVARIANT: Giá trị phải luôn >= 0. */
  value: number;
  /** INVARIANT: Tọa độ (nếu có) phải nằm hoàn toàn trong đa giác (polygon) của Zone chứa nó. */
  location?: Coordinate;
}


// ==========================================
// 2. ZONE (BASIC UNITS) - DISCRIMINATED UNIONS
// ==========================================

export interface BaseZone {
  id: string;
  name: string;
  polygon: GeoJSONPolygon;
  /** INVARIANT: Phải là tâm hình học chính xác của polygon. */
  centroid: Coordinate;
  /** INVARIANT: Chứa mọi hoạt động (đơn hàng, KH) phát sinh trong ranh giới polygon. */
  activities: Activity[];
}

export interface UnassignedZone extends BaseZone {
  status: 'unassigned';
}

export interface AssignedZone extends BaseZone {
  status: 'assigned';
  /** INVARIANT: Phải là một ID hợp lệ chiếu tới một District tồn tại trong Version hiện tại. */
  districtId: string;
}

/** Discriminated Union cho Zone */
export type Zone = UnassignedZone | AssignedZone;


// ==========================================
// 3. SALES & DISTRICTS
// ==========================================

export interface SalesAgent {
  id: string;
  name: string;
  /** INVARIANT: Chuỗi quy định vùng hoạt động (VD: 'North', 'South') hoặc ID khu vực địa lý lớn. */
  activeRegion: string;
  /** INVARIANT: Số lượng đơn hàng / KH tối đa mà sale có thể handle (>= 0). */
  capacity: number;
}

export interface District {
  id: string;
  name: string;
  /** INVARIANT: Phải trỏ đến một SalesAgent hợp lệ. 1 District gán đúng 1 Sale. */
  salesAgentId: string;
  /** INVARIANT: Tất cả Zone ID trong mảng này bắt buộc phải có status là 'assigned' và districtId trỏ về District này. */
  zoneIds: string[];
  
  // -- Metrics (Thường được L1 Validator tính toán và cập nhật lại vào state) --
  /** INVARIANT: Chỉ số tổng tải trọng (số KH/đơn hàng), phải thống nhất với tổng activities của các zones. */
  totalWorkload: number;
  /** INVARIANT: Đường kính (khoảng cách lớn nhất giữa tâm của 2 polygon bất kỳ trong district). Phải >= 0. */
  diameterScore: number;
  /** INVARIANT: Điểm đánh giá mức độ cân bằng tải (balance score). */
  balanceScore: number;
}


// ==========================================
// 4. MATRICES (MA TRẬN KỀ & KHOẢNG CÁCH)
// ==========================================

/**
 * Ma trận kề: O(1) tra cứu danh sách các zone ID lân cận trực tiếp. 
 * INVARIANT: Nếu zone A kề zone B, A phải có mặt trong adjacencyMatrix[B] và ngược lại.
 */
export type AdjacencyMatrix = Record<string, string[]>;

/**
 * Ma trận khoảng cách: Lưu khoảng cách (km, m) giữa tâm của tất cả các zone.
 * INVARIANT: distance[A][B] === distance[B][A], và distance[A][A] === 0.
 */
export type DistanceMatrix = Record<string, Record<string, number>>;


// ==========================================
// 5. ROOT STATE / SNAPSHOT VERSION
// ==========================================

export type VersionPeriod = 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

/**
 * Snapshot/Version lưu lại toàn bộ trạng thái vào một thời điểm.
 * L4 UI Shell sẽ luôn render dựa vào state đọc từ đây.
 */
export interface TerritoryVersion {
  id: string;
  name: string;
  /** INVARIANT: ISO 8601 DateTime String. */
  timestamp: string;
  period: VersionPeriod;

  // Dictionary lookup (O(1)) thay vì array để thuật toán & UI truy xuất trạng thái nhanh nhất.
  zones: Record<string, Zone>;
  districts: Record<string, District>;
  salesAgents: Record<string, SalesAgent>;

  adjacencyMatrix: AdjacencyMatrix;
  distanceMatrix: DistanceMatrix;
}
