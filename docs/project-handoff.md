# TerriMap Project Handoff

Tài liệu này tóm tắt trạng thái hiện tại của TerriMap để có thể tiếp tục làm việc ngay trên repo này.

## Repository

- Local path hiện tại: `C:\Users\Thien\Documents\Terrimap`
- GitHub remote: `https://github.com/ZileanMaster/terrimap.git`
- Branch chính: `main`
- Package manager: `npm`
- Lệnh chạy local: `npm run dev`
- Lệnh kiểm tra chính:
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`

---

## Mục tiêu sản phẩm hiện tại

TerriMap là web app hỗ trợ **quản lý lãnh thổ kinh doanh theo khu vực**. Luồng hiện tại tập trung vào:

1. Chọn dự án làm việc.
2. Xem tổng quan KPI và báo cáo theo khu vực.
3. Quản lý khu vực và bản đồ.
4. Quản lý nhân sự dự án.
5. Điều phối lãnh thổ thủ công.
6. Theo dõi báo cáo vận hành theo tháng.
7. Chạy thuật toán phân chia khi cần tối ưu.

Giao diện người dùng hiện **chỉ dùng tiếng Việt**.

---

## Thanh điều hướng hiện tại

Nav chính của app:

- `Tổng quan`
- `Khu vực & bản đồ`
- `Nhân sự`
- `Phân chia lãnh thổ`
- `Vận hành`
- `Thuật toán phân chia`
- `Cài đặt`

Nút:
- `Đổi dự án` nằm ở top bar để quay về màn chọn dự án.
- Theme toggle là icon-based và có trên màn chọn dự án cũng như app chính.

---

## Trạng thái sản phẩm quan trọng

### 1. Chọn dự án

- Màn chọn dự án có theme toggle.
- Tạo dự án mới được tối ưu theo hướng optimistic/local-first để người dùng thấy phản hồi nhanh.
- Tạo dự án xong sẽ chuyển vào dự án mới ngay, sau đó đồng bộ nền với Supabase.

### 2. Tổng quan

- Màn dành cho quản lý cấp cao.
- Hiển thị KPI kinh doanh theo khu vực.
- Có bộ lọc khu vực ở đầu màn.
- Phần báo cáo tập trung vào khách hàng, đơn hàng, số báo cáo, độ phủ và nhận xét.

### 3. Khu vực & bản đồ

- Có chọn khu vực hiện tại.
- Có tạo khu vực mới ngay trong màn.
- Có lưu map/snapshot.
- Trạng thái khu vực đang xem phải reset đúng khi đổi dự án.

### 4. Nhân sự

- Màn quản lý thành viên dự án.
- Load dữ liệu thành viên có timeout bảo vệ để không treo vô hạn.

### 5. Phân chia lãnh thổ

- Dùng cho chỉnh tay vùng/cụm.
- Có kiểm tra liên thông khi chuyển vùng.

### 6. Vận hành

- Theo dõi báo cáo theo tháng/khu vực.
- Hỗ trợ lọc theo cụm/user/ghi chú.
- Dữ liệu demo có thể được seed cho project test để demo.

### 7. Thuật toán phân chia

- Đã đổi theo hướng **manual execution**: chỉ chạy khi bấm nút.
- SA đang chạy trong web worker để tránh làm đơ UI.
- Có overlay trạng thái đang chạy.
- Kết quả thuật toán ưu tiên chất lượng cân bằng / liên thông / độ ổn định.

---

## Quy tắc kỹ thuật quan trọng

### Connectivity

- Cụm hợp lệ phải là tập liên thông theo adjacency.
- Khi chuyển vùng giữa cụm, nếu làm mất liên thông thì thao tác phải bị chặn.

### Topology

- Không chấp nhận polygon tự cắt, chồng lắp hoặc dữ liệu hình học lỗi.

### Thuật toán

Các thuật toán hiện có:

- Greedy Seed Expansion
- Local Search
- Simulated Annealing

Hiện tại chúng được dùng với ưu tiên chất lượng hơn là tốc độ.

### Local-first UX

Các thao tác quan trọng được thiết kế theo hướng:

- cập nhật local state trước
- đồng bộ Supabase ở nền sau
- không khóa toàn màn hình nếu không cần thiết

Điều này áp dụng rõ cho:
- logout
- tạo dự án
- lưu map/snapshot
- lưu báo cáo
- một số thao tác cập nhật danh sách

---

## Những file lõi nên đọc khi tiếp tục

- `src/App.tsx`
- `src/store/authStore.ts`
- `src/store/uiStore.ts`
- `src/pages/ProjectSelectPage.tsx`
- `src/pages/DashboardViews.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/CoordinatorPage.tsx`
- `src/components/layout/DashboardLayout.tsx`
- `src/components/layout/RegionSelector.tsx`
- `src/components/algorithm/AlgorithmComparator.tsx`
- `src/components/algorithm/ResultMetrics.tsx`
- `src/components/snapshot/SnapshotManager.tsx`
- `src/services/db.ts`
- `src/services/districtReportsDb.ts`
- `src/services/metricsDb.ts`
- `lib/partition.ts`
- `src/hooks/useSAWorker.ts`

---

## Ghi chú về dữ liệu và triển khai

- Một số project demo/test có thể được seed dữ liệu mẫu để trình diễn.
- Vercel đang gắn với GitHub `main`, nên push lên `main` sẽ tự deploy.
- Supabase có thể chạy trực tuyến hoặc local tuỳ môi trường, nhưng UI hiện đã được tối ưu để tránh phụ thuộc cảm giác chờ quá lâu.

---

## Lưu ý khi tiếp tục work

- Không còn menu đổi ngôn ngữ.
- `Nhân sự Sales` hiện đã là `Nhân sự`.
- `Phân chia tự động` trước đây đã đổi thành `Thuật toán phân chia`.
- Tránh làm lại luồng tự chạy thuật toán khi thay đổi cấu hình.
- Nếu sửa thuật toán, không đổi logic cốt lõi nếu chưa có lý do rõ ràng; ưu tiên tối ưu hiệu năng và trải nghiệm người dùng.

---

## Kế hoạch kiểm tra nhanh sau mỗi thay đổi

1. `npm run typecheck`
2. `npm run test`
3. `npm run build`
4. Mở app local bằng `npm run dev`
5. Kiểm tra các màn:
   - chọn dự án
   - tổng quan
   - khu vực & bản đồ
   - nhân sự
   - Thuật toán phân chia
   - vận hành
