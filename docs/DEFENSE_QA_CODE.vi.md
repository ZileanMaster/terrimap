# TerriMap - Bộ câu hỏi & trả lời để giải trình code

Tài liệu này tập trung vào cách giải trình dự án **từ code**, theo đúng kiểu hội đồng thường hỏi: kiến trúc, luồng dữ liệu, thuật toán phân chia, UI/UX, Supabase, và cách hệ thống tránh làm đơ giao diện.

---

## 1) Cách dùng tài liệu này

Khi bị hỏi, bạn nên trả lời theo khung 3 bước:

1. **Mục tiêu**: phần này làm gì?
2. **Cách làm**: code đang làm thế nào?
3. **Lý do chọn**: vì sao chọn cách đó?

Ví dụ:

> “Mục tiêu của phần này là không làm UI bị đơ. Trong code mình tách thuật toán nặng sang Web Worker. Mình chọn cách này vì không đổi logic lõi nhưng cải thiện trải nghiệm người dùng rõ rệt.”

---

## 2) Kiến trúc tổng thể

### Câu hỏi 1: Dự án được tách thành những lớp nào?

**Trả lời ngắn**
> “TerriMap được tách theo lớp rõ ràng: `pages/components` lo UI, `store` lo state, `services` và `facades` lo nghiệp vụ, `workers` lo xử lý nặng, còn `styles` và `i18n` lo giao diện và ngôn ngữ.”

**Giải thích sâu**
- `pages/` là các màn lớn theo luồng người dùng.
- `components/` là UI tái sử dụng.
- `store/` giữ state theo domain.
- `services/` là lớp đọc/ghi dữ liệu.
- `facades/` là lớp quyền và API nghiệp vụ theo vai trò.
- `workers/` tách phần toán nặng khỏi main thread.

### Câu hỏi 2: Vì sao không gom hết logic vào một file?

**Trả lời**
> “Vì ứng dụng có nhiều vai trò, nhiều màn hình, nhiều loại state và cả thuật toán nặng. Nếu gom hết vào một file thì khó bảo trì, khó test, và rất dễ làm UI bị rối.”

### Câu hỏi 3: Luồng dữ liệu của app đi như thế nào?

**Trả lời**
> “App khởi động từ `App.tsx`, kiểm tra auth và project, rồi render dashboard theo tab. UI đọc state từ các store; thao tác ghi dữ liệu đi qua `services` hoặc `facades`, sau đó đồng bộ Supabase ở nền.”

---

## 3) Entry point: `src/App.tsx`

### Câu hỏi 4: `App.tsx` đóng vai trò gì?

**Trả lời**
> “`App.tsx` là bộ điều phối trung tâm. Nó không vẽ chi tiết từng nút, nhưng quyết định ai đang đăng nhập, đang mở project nào, role nào được dùng, và tab nào sẽ được render.”

### Câu hỏi 5: Vì sao `App.tsx` phải kiểm tra online/offline?

**Trả lời**
> “Vì dự án hỗ trợ cả chế độ online và offline/mock. Khi không có Supabase, app vẫn cần chạy được để dev/demo/test.”

### Câu hỏi 6: Vì sao có `lazyRetry`?

**Trả lời**
> “`lazyRetry` là để tự cứu khi chunk tải động bị lỗi sau deploy. Nếu browser đang giữ file JS cũ mà Vercel đã ra bản mới, app có thể tự reload 1 lần để lấy bundle đúng.”

### Câu hỏi 7: Vì sao dùng `Suspense` và `PageLoader`?

**Trả lời**
> “Vì các page lớn được lazy-load. `Suspense` cho phép hiện loading hợp lý thay vì màn trắng, giúp người dùng biết app vẫn đang tải.”

---

## 4) Auth, project, role

### Câu hỏi 8: Sau khi mở app, flow đi như thế nào?

**Trả lời**
> “App kiểm tra session trước, nếu chưa đăng nhập thì vào `LoginPage`. Nếu đã login nhưng chưa chọn project thì vào `ProjectSelectPage`. Nếu đã có project thì mới vào dashboard.”

### Câu hỏi 9: Vì sao phải chọn project trước khi vào dashboard?

**Trả lời**
> “Vì dữ liệu của TerriMap là theo project. Zones, assignments, regions, members, reports đều phải scope theo project hiện tại, nếu không sẽ dễ lẫn dữ liệu.”

### Câu hỏi 10: Role được xác định ở đâu?

**Trả lời**
> “Role thật đến từ membership của project. Trong code còn có cơ chế `view-as` cho admin để demo các vai trò khác. Nên `effectiveRole` không đơn giản là `membership.role`.”

### Câu hỏi 11: Tại sao admin có `view-as` mà sales thì không?

**Trả lời**
> “Vì admin là người cần xem hệ thống từ nhiều góc độ để kiểm tra luồng. Sales chỉ cần đúng chức năng của mình, không cần chế độ mô phỏng vai trò.”

---

## 5) State management

### Câu hỏi 12: Vì sao dùng Zustand?

**Trả lời**
> “Vì app chia state khá rõ theo domain: auth/project, dữ liệu bản đồ, và UI. Zustand nhẹ, ít boilerplate và phù hợp cho app có nhiều state không đồng nhất.”

### Câu hỏi 13: Vì sao có nhiều store thay vì một store lớn?

**Trả lời**
> “Vì mỗi nhóm state có vòng đời khác nhau. `authStore` liên quan đăng nhập và project, `dataStore` liên quan zones/assignments/regions, `uiStore` chỉ lo theme và trạng thái hiển thị. Tách ra giúp code dễ đọc và dễ sửa.”

### Câu hỏi 14: `currentProjectId` và `currentRegionId` khác nhau thế nào?

**Trả lời**
> “`currentProjectId` là ngữ cảnh dự án. `currentRegionId` là ngữ cảnh khu vực bên trong dự án. Một cái là cấp project, một cái là cấp region.”

### Câu hỏi 15: Vì sao `currentRegionId` lại ở `dataStore`?

**Trả lời**
> “Vì nó là ngữ cảnh dữ liệu bản đồ, không phải thông tin xác thực. Nó ảnh hưởng đến zones/assignments đang xem nên hợp lý hơn khi nằm trong data store.”

---

## 6) Facade layer

### Câu hỏi 16: Facade là gì trong dự án này?

**Trả lời**
> “Facade là lớp trung gian giữa UI và logic nghiệp vụ. Nó giúp UI gọi đúng API theo vai trò mà không phải biết chi tiết service bên dưới.”

### Câu hỏi 17: Vì sao không để UI gọi thẳng service?

**Trả lời**
> “Vì nếu UI gọi thẳng service thì khó kiểm soát quyền, khó giữ ranh giới kiến trúc, và dễ làm lộ type hoặc logic nội bộ.”

### Câu hỏi 18: `AdminFacade`, `CoordinatorFacade`, `SalesFacade` khác nhau ở đâu?

**Trả lời**
> “AdminFacade có toàn quyền. CoordinatorFacade có quyền vận hành và phân chia nhưng bị chặn một số thao tác quản trị cao hơn. SalesFacade là read-only, chỉ có những method cần cho nhân sự.”

### Câu hỏi 19: Vì sao `SalesFacade` không ném lỗi mà “không có method”?

**Trả lời**
> “Vì test của dự án kiểm tra đúng là method không tồn tại. Làm vậy để tránh việc sales vô tình gọi nhầm chức năng admin.”

---

## 7) Bản đồ và khu vực

### Câu hỏi 20: `TerritoryMap` làm gì?

**Trả lời**
> “Đây là component bản đồ trung tâm. Nó render polygon vùng, tô màu theo cụm, highlight sales, xử lý click, hover, và zoom/fly-to.”

### Câu hỏi 21: Vì sao bản đồ phức tạp?

**Trả lời**
> “Vì bản đồ không chỉ hiển thị hình học. Nó phải phản ứng với dữ liệu vùng, phân chia, nhân sự, trạng thái chọn, và các trạng thái lọc/highlight.”

### Câu hỏi 22: `RegionManager` làm gì?

**Trả lời**
> “Nó là màn quản lý vùng: tìm tỉnh, tạo vùng mới, chọn vùng, xóa vùng, và fly-to bản đồ.”

### Câu hỏi 23: `DrawingToolbar` có gì đặc biệt?

**Trả lời**
> “Nó dùng Leaflet.Draw trực tiếp để tránh lỗi tương thích ESM. Đây là nơi admin tạo hoặc sửa polygon vùng.”

### Câu hỏi 24: Vì sao phải giữ layer edit đồng bộ?

**Trả lời**
> “Để người dùng sửa zone trên map mà không phải tạo lại toàn bộ draw control mỗi lần. Làm vậy nhẹ hơn và mượt hơn.”

---

## 8) Nhân sự và phân quyền

### Câu hỏi 25: `MemberManager` làm gì?

**Trả lời**
> “Đây là component quản lý thành viên dự án: load member, mời thành viên, đổi role, xóa member, và bảo vệ admin cuối cùng.”

### Câu hỏi 26: Vì sao phải repair owner membership?

**Trả lời**
> “Để tránh trường hợp project có owner thật nhưng thiếu row trong `project_members`. Khi đó màn nhân sự có thể bị trống sai lệch, nên code tự sửa lại.”

### Câu hỏi 27: `AgentManager` khác `MemberManager` thế nào?

**Trả lời**
> “Member là người dùng trong project. Agent là thực thể nghiệp vụ phục vụ phân vùng và phân công sales.”

---

## 9) Báo cáo và vận hành

### Câu hỏi 28: `MyClusterReports` là gì?

**Trả lời**
> “Đó là form sales nhập báo cáo cụm: khách hàng, đơn hàng, doanh thu, ghi chú theo tháng.”

### Câu hỏi 29: Vì sao sales có màn riêng?

**Trả lời**
> “Vì sales không cần xem dashboard quản trị. Họ chỉ cần nhập số liệu cụm của mình nhanh, rõ và ít thao tác.”

### Câu hỏi 30: `MetricsInput` dùng làm gì?

**Trả lời**
> “Đó là form để coordinator nhập chỉ số theo tháng cho một số zone hoặc cụm cụ thể.”

---

## 10) Thuật toán phân chia

### Câu hỏi 31: Bài toán phân chia của TerriMap là gì?

**Trả lời**
> “Bài toán là chia zone thành các cụm sao cho cân bằng tải, liên thông địa lý và cụm gọn.”

### Câu hỏi 32: Vì sao không chỉ chia đều số zone?

**Trả lời**
> “Vì chia đều số zone không đảm bảo cân bằng khách hàng, đơn hàng, doanh thu, hay liên thông địa lý.”

### Câu hỏi 33: `Cost` là gì?

**Trả lời**
> “Cost là điểm mục tiêu nội bộ của thuật toán. Cost càng thấp thì phương án càng tốt.”

### Câu hỏi 34: Cost gồm những gì?

**Trả lời**
> “Nó tổng hợp các yếu tố như mất cân bằng, độ rộng cụm, và phạt vi phạm liên thông.”

### Câu hỏi 35: Vì sao có Greedy, Local Search, SA?

**Trả lời**
> “Greedy tạo nghiệm ban đầu nhanh. Local Search tinh chỉnh nghiệm. SA giúp thoát khỏi nghiệm cục bộ để ưu tiên chất lượng cao hơn.”

### Câu hỏi 36: Vì sao ưu tiên chất lượng hơn tốc độ?

**Trả lời**
> “Vì mục tiêu nghiệp vụ là phương án chia tốt, không phải chỉ chạy nhanh. Người dùng chấp nhận chờ thêm vài giây để đổi lấy phương án cân bằng và ổn định hơn.”

### Câu hỏi 37: Vì sao SA bị chuyển sang worker?

**Trả lời**
> “Vì SA là phần nặng nhất, nếu chạy trên main thread sẽ làm UI đứng. Worker không đổi logic lõi mà chỉ đổi nơi thực thi.”

---

## 11) Loading, toast, local-first

### Câu hỏi 38: Vì sao có nhiều trạng thái loading?

**Trả lời**
> “Vì một giao diện tốt phải cho người dùng biết hệ thống đang làm gì. Không nên để họ nhìn thấy màn hình tĩnh rồi đoán là app bị treo.”

### Câu hỏi 39: Vì sao nhiều thao tác là local-first?

**Trả lời**
> “Để UI phản hồi ngay, không chờ backend. Sau đó app đồng bộ nền với Supabase.”

### Câu hỏi 40: Vì sao phải có toast thành công?

**Trả lời**
> “Vì người dùng cần phản hồi rõ ràng rằng dữ liệu đã được lưu thành công, đặc biệt với các form báo cáo.”

---

## 12) Offline mode

### Câu hỏi 41: Offline mode dùng để làm gì?

**Trả lời**
> “Để app vẫn chạy được khi Supabase chưa có cấu hình hoặc khi cần demo/dev local.”

### Câu hỏi 42: Offline mode có phải code phụ không?

**Trả lời**
> “Không. Nó là một phần có chủ đích để hỗ trợ workflow phát triển và trình diễn.”

---

## 13) Câu hỏi chốt thường gặp

### Câu hỏi 43: Điểm nổi bật nhất của code này là gì?

**Trả lời**
> “Điểm nổi bật là phân tầng rõ ràng, tách quyền theo vai trò, hỗ trợ online/offline, và thuật toán phân chia ưu tiên chất lượng thay vì chỉ tốc độ.”

### Câu hỏi 44: Vì sao dự án này có tính thực tiễn?

**Trả lời**
> “Vì nó bám vào quy trình vận hành thật: có bản đồ, có phân chia, có báo cáo doanh số, có nhân sự, và có dashboard cho quản lý.”

---

## 14) Mẹo trả lời khi bị hỏi khó

Nếu bạn chưa nhớ tên file, hãy trả lời theo lớp:
- “Phần này nằm ở lớp UI / store / service / facade / worker”
- “Mục tiêu là…”
- “Mình chọn cách này vì…”

Nếu họ hỏi rất kỹ:
- nhắc `App.tsx` điều phối flow
- nhắc `authStore` quản lý project và membership
- nhắc `dataStore` giữ zones/assignments/regions
- nhắc `facades` khóa quyền theo role
- nhắc `workers` cho thuật toán nặng

---

## 15) Câu chốt cực an toàn

> “Mình thiết kế TerriMap theo đúng nhu cầu vận hành lãnh thổ: code tách lớp rõ, UI theo vai trò, dữ liệu theo project, và thuật toán ưu tiên chất lượng phân chia để kết quả có giá trị thực tế.”

