# TerriMap - Cheat sheet file/module để học nhanh

Tài liệu này là bản **cầm tay chỉ việc**: file nào làm gì, nên nhìn ở đâu trước, và nếu bị hỏi thì trả lời ra sao.

---

## 1) Cách dùng cheat sheet

Học theo 3 vòng:

1. **Biết file nào làm gì**
2. **Biết file đó liên kết với file nào**
3. **Biết câu trả lời ngắn khi bị hỏi**

---

## 2) Danh sách file quan trọng nhất

### `src/App.tsx`
**Vai trò:** Bộ điều phối trung tâm.

**Làm gì:**
- kiểm tra auth
- chọn project
- chọn role
- chọn tab
- render đúng page/view

**Bị hỏi thì nói:**
> “Đây là file orchestration của app. Nó quyết định ai vào đâu, project nào đang mở, và màn nào sẽ được render.”

---

### `src/main.tsx`
**Vai trò:** Điểm khởi động.

**Làm gì:**
- apply theme sớm
- init telemetry
- mount React root

**Bị hỏi thì nói:**
> “Mình apply theme trước render để tránh flash sáng/tối sai, rồi init telemetry để bắt lỗi toàn cục.”

---

### `src/store/authStore.ts`
**Vai trò:** Auth + project + membership + member management.

**Làm gì:**
- đăng nhập / đăng xuất
- load session
- load projects
- chọn project
- tạo/xóa/sửa project
- load members
- mời member
- update profile

**Bị hỏi thì nói:**
> “Đây là store quản lý ngữ cảnh người dùng và dự án. Project được xem như phần của auth context vì toàn bộ dữ liệu phụ thuộc project hiện tại.”

---

### `src/store/dataStore.ts`
**Vai trò:** State dữ liệu bản đồ.

**Làm gì:**
- load zones
- load assignments
- load agents
- load regions
- giữ currentRegionId
- save/delete region

**Bị hỏi thì nói:**
> “Đây là kho dữ liệu nghiệp vụ của bản đồ. Nó là source of truth cho zones, assignments, agents và regions.”

---

### `src/store/uiStore.ts`
**Vai trò:** State UI.

**Làm gì:**
- theme
- role view-as
- highlight
- map toggles
- UI flags

**Bị hỏi thì nói:**
> “UI state phải tách riêng để không làm bẩn auth/data và để admin có thể view-as các vai trò khác.”

---

### `src/context/FacadeContext.tsx`
**Vai trò:** Cấp facade theo role.

**Làm gì:**
- tạo service singleton
- chọn facade theo role hiện tại
- cung cấp hook dùng trong UI

**Bị hỏi thì nói:**
> “Facade là lớp trung gian giữa UI và nghiệp vụ. Nhờ nó UI không cần biết chi tiết service thấp hơn.”

---

### `facades/AdminFacade.ts`
**Vai trò:** Nghiệp vụ admin.

**Làm gì:**
- chạy phân chia
- tính ma trận
- phát hiện island zones
- import activity CSV
- wrap kết quả thuật toán

**Bị hỏi thì nói:**
> “AdminFacade gom các thao tác toàn quyền của admin, đặc biệt là chạy thuật toán và quản lý phân tích dữ liệu.”

---

### `facades/CoordinatorFacade.ts`
**Vai trò:** Nghiệp vụ điều phối.

**Làm gì:**
- xem team overview
- gán zone
- chạy phân chia
- xem lịch sử

**Bị hỏi thì nói:**
> “Điều phối có quyền vận hành nhưng không có toàn quyền quản trị như admin.”

---

### `facades/SalesFacade.ts`
**Vai trò:** Sales read-only.

**Làm gì:**
- chỉ đọc vùng của mình
- xem dữ liệu liên quan

**Bị hỏi thì nói:**
> “SalesFacade cố tình không có method nguy hiểm để đảm bảo sales không thực hiện nhầm thao tác quản trị.”

---

### `facades/viewmodels.ts`
**Vai trò:** Kiểu dữ liệu thân thiện UI.

**Làm gì:**
- chuyển type nội bộ thành type UI dùng được
- giữ `AlgorithmResultVM`, `DistrictReport`, `ReportData`, v.v.

**Bị hỏi thì nói:**
> “ViewModel giúp UI dùng format ổn định và không phụ thuộc sâu vào type nội bộ của service.”

---

### `src/services/db.ts`
**Vai trò:** CRUD chính với Supabase + local fallback.

**Làm gì:**
- load/save zones, assignments, agents, regions
- snapshot
- project scoped localStorage
- online/offline fallback

**Bị hỏi thì nói:**
> “Đây là lớp dữ liệu quan trọng nhất. Nó vừa đọc/ghi backend, vừa có fallback local để app hoạt động cả khi offline.”

---

### `src/services/districtReportsDb.ts`
**Vai trò:** Lưu báo cáo cụm.

**Làm gì:**
- lưu báo cáo theo project/region/district/user/period
- load báo cáo để tổng hợp trong dashboard

**Bị hỏi thì nói:**
> “Đây là nơi lưu dữ liệu báo cáo do sales nhập, để admin và điều phối xem lại được theo tháng.”

---

### `src/services/metricsDb.ts`
**Vai trò:** Lưu chỉ số tháng.

**Làm gì:**
- lưu chỉ số theo zone và period
- load chỉ số cho coordinator/admin

**Bị hỏi thì nói:**
> “Đây là lớp riêng cho số liệu vận hành theo kỳ, tách biệt với báo cáo cụm nhập thủ công.”

---

### `src/components/layout/DashboardLayout.tsx`
**Vai trò:** Khung chính của dashboard.

**Làm gì:**
- sidebar
- topbar
- breadcrumb
- đổi dự án
- đổi theme
- render tab con

**Bị hỏi thì nói:**
> “Layout là nơi điều phối navigation và shell của app, không chỉ là vỏ giao diện.”

---

### `src/components/layout/Sidebar.tsx`
**Vai trò:** Thanh điều hướng.

**Làm gì:**
- menu theo role
- highlight theo tab
- zone/sales list cho admin

**Bị hỏi thì nói:**
> “Sidebar được role-adaptive, nghĩa là mỗi vai trò thấy menu phù hợp.”

---

### `src/components/layout/TopBar.tsx`
**Vai trò:** Thanh điều khiển trên cùng.

**Làm gì:**
- theme toggle
- đổi dự án
- badge vai trò
- logout

**Bị hỏi thì nói:**
> “TopBar đặt các hành động global và thao tác đổi ngữ cảnh ở vị trí dễ thấy nhất.”

---

### `src/components/map/TerritoryMap.tsx`
**Vai trò:** Bản đồ chính.

**Làm gì:**
- render polygon
- tô màu zone/district
- highlight sales
- zoom/fly-to
- phản ứng với chọn vùng/cluster

**Bị hỏi thì nói:**
> “Đây là component map trung tâm, kết nối dữ liệu địa lý với dữ liệu phân chia và dữ liệu nhân sự.”

---

### `src/components/map/DrawingToolbar.tsx`
**Vai trò:** Toolbar vẽ vùng.

**Làm gì:**
- Leaflet.Draw
- create/edit vùng
- validate overlap

**Bị hỏi thì nói:**
> “Mình dùng Leaflet.Draw trực tiếp để ổn định hơn trong build ESM và tránh wrapper gây lỗi.”

---

### `src/components/map/MatrixViewer.tsx`
**Vai trò:** Xem ma trận kề/khoảng cách.

**Làm gì:**
- hiển thị adjacency matrix
- hiển thị distance matrix
- hỗ trợ admin kiểm tra cấu trúc mạng lưới

**Bị hỏi thì nói:**
> “Đây là công cụ hỗ trợ kiểm tra liên thông và khoảng cách giữa các zone.”

---

### `src/components/algorithm/AlgorithmComparator.tsx`
**Vai trò:** So sánh thuật toán phân chia.

**Làm gì:**
- chọn thuật toán
- chọn số cụm
- chạy phân chia
- hiện metrics
- hiển thị overlay khi thuật toán đang chạy

**Bị hỏi thì nói:**
> “Đây là màn để so sánh chất lượng greedy/local search/SA thay vì chỉ nhìn kết quả cuối.”

---

### `src/components/algorithm/ResultMetrics.tsx`
**Vai trò:** Hiển thị metric kết quả.

**Làm gì:**
- cân bằng
- vi phạm
- độ rộng cụm tối đa
- khách hàng trung bình
- thời gian chạy

**Bị hỏi thì nói:**
> “Một phương án tốt phải nhìn đa tiêu chí chứ không chỉ một con số.”

---

### `src/hooks/useSAWorker.ts`
**Vai trò:** Hook chạy SA trong worker.

**Làm gì:**
- tạo worker
- gửi dữ liệu sang worker
- nhận kết quả
- fallback nếu worker không khả dụng

**Bị hỏi thì nói:**
> “Mình tách SA sang worker để tránh khóa main thread, nhưng logic thuật toán không đổi.”

---

### `src/workers/sa-worker.ts`
**Vai trò:** Nơi chạy SA nặng.

**Làm gì:**
- chạy thuật toán trong thread riêng
- trả kết quả về UI

**Bị hỏi thì nói:**
> “Worker chỉ thay đổi nơi thực thi, không thay đổi bản chất thuật toán.”

---

### `src/pages/DashboardViews.tsx`
**Vai trò:** Bộ màn dashboard phụ.

**Làm gì:**
- tổng quan
- nhân sự
- vận hành
- báo cáo cụm

**Bị hỏi thì nói:**
> “Đây là nơi gom các view dashboard liên quan, vì chúng chia sẻ khá nhiều logic và store.”

---

### `src/pages/AdminPage.tsx`
**Vai trò:** Màn admin.

**Làm gì:**
- bản đồ admin
- gán vùng
- phân chia
- draw tools
- snapshot/history

**Bị hỏi thì nói:**
> “AdminPage là nơi admin thao tác đầy đủ với bản đồ và kết quả phân chia.”

---

### `src/pages/CoordinatorPage.tsx`
**Vai trò:** Màn điều phối.

**Làm gì:**
- xem tổng quan team
- nhập metrics
- gán zone
- chạy phân chia theo quyền

**Bị hỏi thì nói:**
> “CoordinatorPage phục vụ vận hành và gán lãnh thổ, nhưng vẫn có giới hạn quyền so với admin.”

---

### `src/pages/SalesPage.tsx`
**Vai trò:** Màn sales.

**Làm gì:**
- xem cụm của mình
- nhập báo cáo doanh số
- không xem dashboard tổng quan của admin

**Bị hỏi thì nói:**
> “SalesPage được tối giản đúng vai trò để người dùng chỉ thao tác những gì họ cần.”

---

### `src/components/reports/MyClusterReports.tsx`
**Vai trò:** Form nhập báo cáo cụm.

**Làm gì:**
- customers
- orders
- revenue
- note
- theo tháng

**Bị hỏi thì nói:**
> “Đây là phần sales nhập dữ liệu thực tế của mình, để admin/coordinator tổng hợp lại.”

---

### `src/components/admin/MemberManager.tsx`
**Vai trò:** Quản lý thành viên dự án.

**Làm gì:**
- load members
- invite
- đổi role
- xóa member

**Bị hỏi thì nói:**
> “Đây là công cụ quản trị nhân sự trong dự án, có guard để tránh xóa admin cuối cùng.”

---

### `src/components/admin/RegionManager.tsx`
**Vai trò:** Quản lý vùng.

**Làm gì:**
- tìm tỉnh
- tạo vùng
- xóa vùng
- fly-to

**Bị hỏi thì nói:**
> “Đây là công cụ để admin tạo và quản lý vùng làm việc trên bản đồ.”

---

### `src/components/agent/AgentManager.tsx`
**Vai trò:** Quản lý agent.

**Làm gì:**
- thêm/sửa agent
- gán vùng hoạt động
- capacity

**Bị hỏi thì nói:**
> “Agent là thực thể nghiệp vụ cho phân công sales, không phải chỉ là user đăng nhập.”

---

### `src/components/snapshot/SnapshotManager.tsx`
**Vai trò:** Lưu/tải snapshot bản đồ.

**Làm gì:**
- save map
- load snapshot
- compare snapshots
- realtime sync

**Bị hỏi thì nói:**
> “Snapshot cho phép lưu trạng thái bản đồ để quay lại hoặc so sánh các phương án sau này.”

---

### `src/components/snapshot/SnapshotCompare.tsx`
**Vai trò:** So sánh hai snapshot.

**Làm gì:**
- diff zone/district
- summary thay đổi

**Bị hỏi thì nói:**
> “Màn này giúp nhìn rõ phương án nào thay đổi gì, thay vì chỉ nhìn bản đồ cuối.”

---

### `src/test-setup.tsx`
**Vai trò:** Setup test môi trường browser.

**Làm gì:**
- mock leaflet
- mock matchMedia
- mock ResizeObserver

**Bị hỏi thì nói:**
> “Vì jsdom không hỗ trợ đủ browser API, mình mock để test UI map chạy được ổn định.”

---

### `src/test-utils.tsx`
**Vai trò:** Helper cho test.

**Làm gì:**
- mock i18n
- mock store
- render wrapper

**Bị hỏi thì nói:**
> “Đây là bộ tiện ích để test file UI mà không cần lặp lại boilerplate.”

---

## 3) File nào nên đọc trước?

Theo thứ tự học nhanh:

1. `src/App.tsx`
2. `src/store/authStore.ts`
3. `src/store/dataStore.ts`
4. `src/components/layout/DashboardLayout.tsx`
5. `src/pages/DashboardViews.tsx`
6. `src/components/map/TerritoryMap.tsx`
7. `src/components/algorithm/AlgorithmComparator.tsx`
8. `src/components/reports/MyClusterReports.tsx`

---

## 4) Một số câu trả lời ngắn để thuộc lòng

### Vì sao tách nhiều store?
> “Vì mỗi nhóm state có vòng đời khác nhau và cần tách rõ để dễ bảo trì.”

### Vì sao có facade?
> “Để UI không đụng trực tiếp vào logic thấp và quyền được quản lý theo vai trò.”

### Vì sao SA chạy worker?
> “Để tránh khóa UI nhưng vẫn giữ nguyên thuật toán lõi.”

### Vì sao có project scope?
> “Để dữ liệu tách biệt theo dự án, không lẫn giữa các khách hàng/dự án khác nhau.”

### Vì sao sales không xem overview?
> “Vì overview là dashboard quản trị; sales chỉ cần màn nhập báo cáo và phần việc của mình.”

---

## 5) Ghi nhớ 5 file “đinh” nhất

- `src/App.tsx` -> điều phối toàn app
- `src/store/authStore.ts` -> auth/project/member
- `src/store/dataStore.ts` -> zones/assignments/regions
- `src/components/algorithm/AlgorithmComparator.tsx` -> chạy và so sánh thuật toán
- `src/components/map/TerritoryMap.tsx` -> bản đồ trung tâm

