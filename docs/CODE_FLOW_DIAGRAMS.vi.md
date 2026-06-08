# TerriMap — Sơ đồ luồng code và kiến trúc

Tài liệu này mô tả **TerriMap chạy như thế nào trong code**, từ lúc app mở lên cho đến khi người dùng thao tác với bản đồ, nhân sự, báo cáo và thuật toán phân chia.

---

## 1) Mục tiêu của tài liệu

Sau khi đọc tài liệu này, bạn nên trả lời được:

- app bắt đầu từ file nào
- state đi qua đâu
- role được xác định thế nào
- tab nào render component nào
- thuật toán chạy ở đâu
- dữ liệu lưu ở đâu

---

## 2) Sơ đồ tổng quan cấp cao

```mermaid
flowchart TD
  A["main.tsx"] --> B["App.tsx"]
  B --> C{"Online hay offline?"}
  C -->|Offline| D["OfflineApp()"]
  C -->|Online| E["Auth flow"]
  E --> F{"Đã login?"}
  F -->|No| G["LoginPage"]
  F -->|Yes| H{"Đã chọn project?"}
  H -->|No| I["ProjectSelectPage"]
  H -->|Yes| J["DashboardLayout"]
  J --> K{"Tab hiện tại"}
  K --> L["OverviewView"]
  K --> M["RegionSelector / AdminPage / CoordinatorPage / SalesPage"]
  K --> N["UsersView"]
  K --> O["OperationsView"]
  K --> P["AlgorithmComparator"]
  K --> Q["SettingsView"]
```

### Giải thích
- `main.tsx` là nơi áp theme, init telemetry và mount React root.
- `App.tsx` là bộ điều phối trung tâm.
- `DashboardLayout` quyết định tab đang active.
- Mỗi tab render ra một view hoặc page tương ứng.

---

## 3) Luồng khởi động app

```mermaid
sequenceDiagram
  participant Browser
  participant Main as main.tsx
  participant App as App.tsx
  participant Auth as authStore
  participant Data as dataStore
  participant UI as uiStore

  Browser->>Main: Mở trang
  Main->>Main: Apply theme sớm
  Main->>App: Render root
  App->>Auth: initialize()
  Auth-->>App: session/user/project
  App->>Data: init(currentProjectId)
  App->>UI: sync role/view-as
```

### Ý nghĩa
1. Theme được áp trước để tránh flash sáng/tối sai.
2. `initialize()` kiểm tra session.
3. Nếu có project thì dữ liệu project mới được load.
4. Role hiển thị được đồng bộ vào `uiStore`.

---

## 4) Flow đăng nhập và chọn dự án

```mermaid
flowchart TD
  A["App.tsx"] --> B{"authLoading?"}
  B -->|Yes| C["Splash screen"]
  B -->|No| D{"authUser/authSession có không?"}
  D -->|No| E["LoginPage"]
  D -->|Yes| F{"currentProjectId có không?"}
  F -->|No| G["ProjectSelectPage"]
  F -->|Yes| H["DashboardLayout"]
```

### Điểm cần nhớ
- Người dùng **không vào dashboard trực tiếp** nếu chưa có project.
- Project là ngữ cảnh làm việc quan trọng, nên luôn là bước trung gian.

---

## 5) Luồng dashboard

```mermaid
flowchart TD
  A["DashboardLayout"] --> B{"activeTab"}
  B --> C["overview"]
  B --> D["regions"]
  B --> E["users"]
  B --> F["ops"]
  B --> G["assignments"]
  B --> H["algorithms"]
  B --> I["settings"]
```

### Ghi nhớ nhanh
- `overview` → bức tranh tổng quan
- `regions` → quản lý vùng/bản đồ
- `users` → nhân sự
- `ops` → vận hành
- `assignments` → phân chia lãnh thổ
- `algorithms` → so sánh thuật toán
- `settings` → cài đặt

---

## 6) Luồng role và tab

### 6.1 Role đến từ đâu?

Trong `App.tsx`, role cuối cùng được tính từ:
- `membership` của project hiện tại
- `view-as` nếu user là admin
- owner project nếu chưa có membership rõ ràng

### 6.2 Vì sao có `effectiveRole`?

`effectiveRole` là role thực sự để render view.

Ví dụ:
- admin có thể xem như coordinator/sales nếu bật `view-as`
- sales không thể tự biến thành admin

### 6.3 Khi nào `currentRegionId` được set?

Nếu membership có `region_id` và role không phải admin:
- app tự chọn region đó
- giúp sales/coordinator vào đúng ngữ cảnh ngay

---

## 7) Luồng dữ liệu bản đồ

```mermaid
flowchart TD
  A["dataStore.init(projectId)"] --> B["loadZones"]
  A --> C["loadAssignments"]
  A --> D["loadAgents"]
  A --> E["loadRegions"]
  B --> F["zones trong store"]
  C --> G["assignments trong store"]
  D --> H["agents trong store"]
  E --> I["regions trong store"]
  F --> J["TerritoryMap"]
  G --> J
  H --> K["Sidebar / Sales view"]
  I --> L["RegionSelector / RegionManager"]
```

### Ý nghĩa
`dataStore` là nơi nạp dữ liệu đầu vào cho toàn bộ UI bản đồ.

---

## 8) Luồng quản lý vùng

```mermaid
flowchart TD
  A["RegionSelector / RegionManager"] --> B["Chọn vùng"]
  B --> C["setCurrentRegion(regionId)"]
  C --> D["AdminPage / CoordinatorPage / SalesPage"]
  D --> E["TerritoryMap hiển thị vùng đang chọn"]
```

### Điểm quan trọng
- `currentRegionId` là cờ điều hướng cho các màn liên quan bản đồ.
- Nếu `null`, app thường yêu cầu chọn vùng trước.

---

## 9) Luồng quản lý thành viên

```mermaid
flowchart TD
  A["MemberManager"] --> B["loadMembers()"]
  B --> C["project_members"]
  B --> D["profiles"]
  C --> E["Danh sách thành viên hiển thị"]
  D --> E
  E --> F["inviteMember / updateMemberRole / removeMember"]
```

### Ý nghĩa
Màn nhân sự không chỉ đọc một bảng duy nhất mà ghép dữ liệu từ:
- membership trong project
- hồ sơ cá nhân trong profiles

---

## 10) Luồng báo cáo doanh số / cụm

```mermaid
flowchart TD
  A["SalesReportView / MyClusterReports"] --> B["Nhập customers / orders / revenue / note"]
  B --> C["saveDistrictReport"]
  C --> D["district_reports"]
  C --> E["localStorage fallback / optimistic UI"]
  D --> F["DashboardViews / OperationsView"]
```

### Giải thích
- Sales nhập dữ liệu.
- Dữ liệu lưu theo project/region/district/user/period.
- Admin và điều phối đọc lại để tổng hợp trong tổng quan và vận hành.

---

## 11) Luồng thuật toán phân chia

```mermaid
flowchart TD
  A["AlgorithmComparator"] --> B["Chọn region"]
  B --> C["Chọn thuật toán"]
  C --> D["Chọn số cụm"]
  D --> E["Tạo input zones + constraints"]
  E --> F["Greedy / Local Search / SA"]
  F --> G["Tính cost + metrics"]
  G --> H["ResultMetrics"]
  G --> I["Overlay đang chạy"]
  G --> J["Áp dụng kết quả"]
```

### Điểm đáng nhớ
- Greedy: tạo lời giải ban đầu.
- Local Search: tinh chỉnh.
- SA: tối ưu sâu hơn, chấp nhận chạy lâu hơn để có chất lượng cao hơn.

---

## 12) Luồng SA worker

```mermaid
sequenceDiagram
  participant UI as AlgorithmComparator
  participant Hook as useSAWorker
  participant Worker as sa-worker.ts
  participant Facade as AdminFacade/CoordinatorFacade

  UI->>Hook: runSA(...)
  Hook->>Worker: postMessage(zones, m, opts)
  Worker-->>Hook: assignments[]
  Hook-->>UI: raw results
  UI->>Facade: wrapAssignmentsAsResult(...)
  Facade-->>UI: AlgorithmResultVM
```

### Ý nghĩa
- Worker chỉ đổi nơi chạy, không đổi logic lõi.
- UI nhận `AlgorithmResultVM` đã chuẩn hóa để hiển thị.

---

## 13) Luồng lưu map / snapshot

```mermaid
flowchart TD
  A["SnapshotManager"] --> B["Người dùng bấm Lưu map"]
  B --> C["prompt tên snapshot"]
  C --> D["saveSnapshot(...)"]
  D --> E["localStorage scoped theo project"]
  D --> F["Supabase snapshots table"]
  D --> G["realtime/polling refresh danh sách"]
  G --> H["Dropdown snapshot cập nhật"]
```

### Điểm cần nhớ
- Snapshot lưu theo project.
- UI dùng optimistic state để không chờ lâu.
- Sau khi lưu, dropdown snapshot phải cập nhật ngay.

---

## 14) Luồng UI/UX tối ưu trải nghiệm

```mermaid
flowchart TD
  A["Người dùng thao tác"] --> B["UI cập nhật local trước"]
  B --> C["Sync backend nền sau"]
  C --> D{"Có lỗi mạng?"}
  D -->|Không| E["Đồng bộ hoàn tất"]
  D -->|Có| F["Cảnh báo / fallback / retry"]
```

### Tại sao làm vậy?
- Người dùng thấy phản hồi ngay.
- Tránh cảm giác “bấm mà không thấy gì”.
- Các tác vụ dài không khóa toàn màn hình.

---

## 15) Dòng chảy giữa các file quan trọng

### 15.1 `main.tsx`
- set theme
- init telemetry
- mount `App`

### 15.2 `App.tsx`
- auth/project/role/tab orchestration

### 15.3 `authStore.ts`
- user, session, project, membership

### 15.4 `dataStore.ts`
- zones, assignments, agents, regions

### 15.5 `facades/*`
- quyền theo vai trò

### 15.6 `services/db.ts`
- load/save/search/snapshot

### 15.7 `components/map/*`
- bản đồ, vùng, draw, matrix

### 15.8 `components/algorithm/*`
- so sánh thuật toán, metrics, SA worker

### 15.9 `components/layout/*`
- shell, nav, topbar

---

## 16) Các nhánh dữ liệu quan trọng

### A. Auth branch
- login
- session
- project selection
- membership

### B. Data branch
- zones
- assignments
- agents
- regions

### C. Algorithm branch
- input zones
- constraints
- result assignments
- metrics

### D. Reporting branch
- district reports
- monthly metrics
- snapshots

---

## 17) Câu hỏi hội đồng thường gắn với sơ đồ này

### “Tại sao phải có nhiều store?”
Vì state khác domain, vòng đời khác nhau.

### “Tại sao không gọi API trực tiếp từ component?”
Vì cần layer rõ ràng để quản trị quyền và tái sử dụng logic.

### “Tại sao SA cần worker?”
Vì nặng và dễ làm đơ UI.

### “Tại sao có project scope?”
Vì dữ liệu phải cách ly theo dự án.

### “Tại sao snapshot lại đọc realtime/polling?”
Vì nhiều admin/coordinator cùng làm việc cần đồng bộ ngay.

---

## 18) Sơ đồ tóm tắt một dòng

```mermaid
flowchart LR
  Auth["Auth"] --> Project["Project"]
  Project --> Role["Role"]
  Role --> Tab["Tab"]
  Tab --> UI["UI Component"]
  UI --> Store["Store"]
  Store --> Service["Service/Facade"]
  Service --> DB["Supabase / localStorage"]
  UI --> Worker["Web Worker"]
```

---

## 19) Câu chốt để ghi nhớ

> “TerriMap là một app điều phối theo luồng: auth → project → role → tab → store → service/facade → database/worker. Code được tách lớp để vừa dễ bảo trì, vừa đảm bảo UI không bị đơ khi xử lý dữ liệu và thuật toán nặng.”

