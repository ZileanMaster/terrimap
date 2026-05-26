# BÁO CÁO KỸ THUẬT — TerriMap
## Hệ thống Thiết kế Vùng Thương mại (Commercial Territory Design System)

> **Phiên bản**: 3.0 — Finalization Build  
> **Ngày**: 22/04/2026  
> **Tác giả**: thiendominh0-star  
> **Stack**: React 18 · TypeScript · Vite · Zustand · Supabase · Leaflet

---

## 1. TỔNG QUAN HỆ THỐNG

TerriMap là ứng dụng web thiết kế và quản lý vùng thương mại (Territory Management System) hỗ trợ phân chia địa bàn cho đội ngũ kinh doanh. Hệ thống cho phép:

- **Admin** quản lý các khu vực địa lý (Region) và gán Coordinator
- **Coordinator** chạy thuật toán phân vùng, điều chỉnh thủ công, nhập chỉ số tháng
- **Sales** xem địa bàn được phân công và gửi phản hồi chất lượng

---

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 Phân cấp 5 tầng (5-Layer Architecture)

```
L0: types/domain.ts          — Domain primitives (Zone, District, SalesAgent, Assignment)
L1: lib/partition.ts          — Thuật toán phân vùng + geometry
L1: lib/geometry.ts           — Adjacency matrix, haversine distance
L2: services/TerritoryService — Business logic (compute cost, validate)
L3: facades/                  — ViewModels (AdminFacade, CoordFacade, SalesFacade)
L4: src/                      — React UI (pages, components, store)
```

**Nguyên tắc**: Chỉ sửa L4 (`src/`) trong Sprint. L0–L3 là stable API.

### 2.2 Phân cấp Role

```
Admin
 └─ Quản lý Region (Hà Nội, TP.HCM, Huế)
 └─ Gán Coordinator cho từng Region
 └─ Xem tổng quan hệ thống (12 zones, 4 districts, 4 sales)
 └─ CRUD nhân viên Sales (AgentManager)

Coordinator (gắn với 1 Region)
 └─ Chọn Region + Period (tháng)
 └─ Nhập chỉ số (customers, orders, revenue)
 └─ Chạy thuật toán phân vùng
 └─ Điều chỉnh thủ công (manual swap với BFS validation)
 └─ Lưu/tải Snapshot + So sánh lịch sử

Sales (gắn với 1 District)
 └─ Xem địa bàn được phân công
 └─ Xem chỉ số: vùng, KH, đơn hàng
 └─ Gửi đánh giá phân vùng (👍/👎 + comment)
```

### 2.3 Global State (Zustand)

```typescript
interface DataStore {
  zones:          Zone[]
  assignments:    Assignment[]
  agents:         SalesAgent[]
  regions:        Region[]
  currentRegionId: string | null
  
  // Actions
  init()           // Load từ Supabase → fallback mock data
  setZones()
  setAssignments()
  addAgent() / updateAgent() / removeAgent()
  setCurrentRegion()
}
```

---

## 3. THUẬT TOÁN PHÂN VÙNG

### 3.1 Danh sách thuật toán

| Tên | ID | Mô tả | Độ phức tạp |
|-----|----|-------|-------------|
| Tham lam | `greedy` | Gán zone gần nhất theo khoảng cách | O(n·k) |
| **Tìm kiếm cục bộ** | `local-search` | 2-opt swap + BFS validation | O(n²·iter) |
| Simulated Annealing | `sa` | Chấp nhận nghiệm xấu theo nhiệt độ | O(n·iter·T) |

> **Lưu ý quan trọng**: Hệ thống chỉ hỗ trợ `greedy`, `local-search` và `sa`; các thuật toán phân cụm thuần khoảng cách không còn là API hợp lệ.

### 3.2 Hàm mục tiêu (Objective Function)

#### p-Center (mặc định): Minimize max diameter
$$\text{cost}_{\text{p-center}} = \alpha \cdot \text{dispersion} + \beta \cdot \text{imbalance}$$

#### p-Median: Minimize tổng khoảng cách đến center
$$\text{cost}_{\text{p-median}} = \sum_{d} \sum_{z \in D_d} \text{haversine}(\text{centroid}_z, \text{center}_d)$$

#### Multi-metric Balance
$$\text{imbalance}_d = \left| \frac{\text{metric}_d - \overline{\text{metric}}}{\overline{\text{metric}}} \right|$$

Với `metric` có thể là `customers` hoặc `orders`, có trọng số độc lập:
```typescript
balanceWeights?: { customers: number; orders: number }
```

### 3.3 Ràng buộc Liên thông (Connectivity Constraint)

**Bắt buộc**: Mỗi district sau phân vùng phải là một tập liên thông địa lý.

Thuật toán kiểm tra: **BFS (Breadth-First Search)**

```
isDistrictConnected(zones, assignment, districtId, adjMatrix, idToIdx):
  1. Lấy tập S = {zone | assignment[zone] == districtId}
  2. BFS từ S[0] theo adjMatrix, chỉ duyệt zones trong S
  3. Nếu visited.size == S.size → liên thông ✅
  4. Ngược lại → phá liên thông ❌ → reject
```

**Áp dụng**:
- **Local Search**: sau mỗi swap thử — reject nếu BFS fail
- **Simulated Annealing**: sau mỗi swap thử — reject nếu BFS fail  
- **Manual swap (Coordinator)**: kiểm tra source district sau khi chuyển zone

### 3.4 Local Search — Chi tiết (Phase 1, Ríos-Mercado 2009)

```
Khởi tạo: assignment = partitionGreedy(zones, k)
Lặp (maxIter lần):
  Chọn ngẫu nhiên zone z nằm ở biên giữa 2 districts
  Thử swap z → district mới
  Kiểm tra BFS(source_district) → reject nếu mất liên thông
  Tính cost mới
  Nếu cost mới tốt hơn → chấp nhận
  Nếu không cải thiện qua tolerance → dừng sớm
Trả về assignment tốt nhất
```

**Tham chiếu**: Ríos-Mercado, R.Z., Fernández, E. (2009). *A reactive GRASP for a commercial territory design problem with multiple balancing requirements.* Computers & Operations Research, 36(3), 755-776.

---

## 4. TÍNH NĂNG CHI TIẾT

### 4.1 Quản lý Khu vực (RegionManager)

- Hiển thị 3 khu vực: Hà Nội (12 zones), TP.HCM (0), Huế (0)
- Mỗi region: dropdown gán Coordinator, số zones, nút "Xem khu vực"
- Click "Xem" → filter displayZones theo `regionId`

### 4.2 Nhập chỉ số tháng (MetricsInput)

- Bảng editable: zone × (customers, orders, revenue)
- Lưu vào `zone_monthly_metrics` (Supabase) hoặc localStorage (offline)
- Coordinator chọn period (YYYY-MM) → nhập → chạy phân vùng với dữ liệu thực tế

### 4.3 Snapshot & So sánh lịch sử

**Snapshot**: lưu toàn bộ trạng thái `{zones, assignments}` với `label` + `period` (tháng)

**Compare mode (Phase 3)**:
1. Click "📊 So sánh" trong dropdown
2. Checkbox xuất hiện trên mỗi snapshot
3. Chọn 2 → "So sánh A vs B"
4. Hiển thị `SnapshotCompare`: summary cards + diff table (zones thay đổi district)

### 4.4 Điều chỉnh thủ công + BFS Guard

Coordinator click zone → `ZoneInfoPanel`:
- Dropdown "Chuyển sang district: District X (N vùng)"
- Current district bị disabled ("← hiện tại")
- Sau xác nhận → `handleAssign()` kiểm tra BFS:
  - Nếu source district còn lại vẫn liên thông → swap thành công
  - Nếu phá liên thông → `alert()` + `return` (từ chối)

### 4.5 CRUD Nhân viên (AgentManager)

- Thêm/sửa/xóa `SalesAgent`
- Field "Khu vực phụ trách": `<select>` dropdown từ `store.regions`
- `regionId` được persist vào Supabase `sales_agents.region_id`

### 4.6 Phân công nhân viên (DistrictAgentAssigner)

- Mỗi district row: color dot + zone count + total customers
- Dropdown agents lọc theo `regionId` (agents không có region → hiển thị ở mọi nơi)
- Save → cập nhật `assignments` trong store

### 4.7 Đánh giá phân vùng (PartitionFeedback)

- Sales xem snapshot gần nhất → nút "Đánh giá phân vùng"
- Modal 👍/👎 + textarea comment
- Submit → lưu vào `partition_feedback` (Supabase)

---

## 5. DATABASE SCHEMA (Supabase)

```sql
-- Zones (existing)
zones: id, name, geometry(polygon), customers, orders, revenue, region_id(NEW)

-- Districts (existing)  
assignments: id, zone_id, district_id

-- Sales Agents (existing + extension)
sales_agents: id, name, capacity, region_id(NEW)

-- NEW: Regions
regions: id, name, coordinator_id, center(JSONB), zoom, created_at

-- NEW: Snapshots (extended)
snapshots: id, label, data(JSONB), period, created_at

-- NEW: Monthly Metrics
zone_monthly_metrics: id, zone_id, period, metric_type, value, updated_at

-- NEW: Partition Feedback
partition_feedback: id, snapshot_id, agent_id, rating(+1/-1), comment, created_at
```

**Row Level Security**: Tất cả tables đều enable RLS với policy `Allow all for anon`.

---

## 6. KỊCH BẢN DEMO

### Demo Flow (7 bước)

1. **Admin**: Mở tab Quản trị → RegionManager hiện Hà Nội (12 vùng), HCM, Huế
2. **Admin → AgentManager**: Thêm Sales mới, chọn region "Hà Nội" từ dropdown
3. **Coordinator**: Chuyển tab Điều phối → chọn region Hà Nội → chọn tháng 04/2026
4. **Coordinator → MetricsInput**: Nhập chỉ số thực tế → Chạy "Tìm kiếm cục bộ"
5. **Coordinator → Snapshot**: Lưu kết quả "Local Search T4/2026" → Chạy thêm SA → Lưu "SA T4/2026"
6. **Coordinator → So sánh**: Chọn 2 snapshots → Modal diff: zones thay đổi district có highlight
7. **Coordinator → Manual swap**: Click zone → Thử chuyển district → nếu phá connectivity → alert cảnh báo
8. **Sales**: Tab Bán hàng → xem 3 vùng + 410 KH → "Đánh giá" → 👍 "Phân vùng hợp lý"

---

## 7. KẾT QUẢ KIỂM TRA

### Unit & Integration Tests
- **359 tests pass** / 0 fail (14 test files)
- Coverage: L0 domain (65), L1 geometry (60), L1 partition (75), L4 UI (159)

### Build
- `vite build`: 231 modules, 282ms, Bundle 800KB (gzip: 224KB)

### Runtime (Offline mode)
- Tất cả features hoạt động với mock data + localStorage
- Console errors: chỉ `[DB] Failed to fetch` (expected — offline)
- Không có TypeError/ReferenceError

---

## 8. SQL MIGRATION (Chạy trên Supabase)

```sql
-- Xem file: docs/migration-full.sql
-- Chạy 1 lần trên Supabase SQL Editor
```

---

## 9. TRIỂN KHAI

| Môi trường | URL | Status |
|-----------|-----|--------|
| Development | http://localhost:5173 | ✅ |
| Production | https://[project].vercel.app | Pending SQL migration |

### Biến môi trường (Vercel)
```
VITE_SUPABASE_URL=https://bsodtlrpulpmlyrcfdap.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

---

## 10. TÀI LIỆU THAM KHẢO

1. Ríos-Mercado, R.Z., Fernández, E. (2009). *A reactive GRASP for a commercial territory design problem with multiple balancing requirements.* Computers & Operations Research, 36(3), 755-776. https://doi.org/10.1016/j.cor.2007.10.024

2. Kirkpatrick, S., Gelatt, C.D., Vecchi, M.P. (1983). *Optimization by Simulated Annealing.* Science, 220(4598), 671-680.

3. Hess, S.W., Samuels, S.A. (1971). *Experiences with a Sales Districting Model: Criteria and Implementation.* Management Science, 18(4), P41-P54.

4. React 18 Docs — https://react.dev
5. Supabase Docs — https://supabase.com/docs
6. Leaflet.js — https://leafletjs.com
7. Zustand State Management — https://zustand-demo.pmnd.rs
