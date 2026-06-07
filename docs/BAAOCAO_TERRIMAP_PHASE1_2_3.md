# BÁO CÁO ĐỒ ÁN — TerriMap
## Hệ thống thiết kế và vận hành lãnh thổ kinh doanh theo khu vực

> **Phiên bản tài liệu**: cập nhật theo trạng thái hiện tại của dự án  
> **Ngày cập nhật**: 07/06/2026  
> **Stack chính**: React 18 · TypeScript · Vite · Zustand · Supabase · Leaflet

---

## 1. Tổng quan

TerriMap là ứng dụng web hỗ trợ doanh nghiệp **quản lý lãnh thổ kinh doanh theo khu vực**, theo dõi báo cáo theo tháng và chạy các thuật toán phân chia vùng/cụm để tối ưu chất lượng vận hành.

Ứng dụng hiện tại được thiết kế cho 3 nhóm người dùng chính:

- **Quản trị viên**: thiết lập dự án, khu vực, nhân sự và chạy các tác vụ phân chia.
- **Điều phối viên**: kiểm tra dữ liệu khu vực, chỉnh tay vùng/cụm và theo dõi vận hành.
- **Nhân sự**: xem dữ liệu được giao, báo cáo theo dự án và làm việc theo quyền hạn.

Giao diện người dùng hiện **chỉ dùng tiếng Việt**.

---

## 2. Mục tiêu sản phẩm

TerriMap được xây dựng để giải quyết các nhu cầu sau:

1. Tách dữ liệu theo từng **dự án** làm việc riêng.
2. Quản lý **khu vực** vận hành trên bản đồ.
3. Quản lý **vùng** và **cụm** phục vụ chia lãnh thổ.
4. Theo dõi **nhân sự**, khách hàng và đơn hàng theo từng khu vực.
5. Chạy thuật toán phân chia theo hướng **ưu tiên chất lượng**.
6. Giảm thao tác thủ công lặp lại và giảm cảm giác chờ trong UI.

---

## 3. Kiến trúc và công nghệ

### 3.1 Stack

- **React 18**: giao diện người dùng.
- **TypeScript**: kiểu dữ liệu và kiểm soát logic.
- **Vite**: bundler và dev server.
- **Zustand**: quản lý trạng thái UI và dữ liệu.
- **Supabase**: backend, auth và lưu trữ dữ liệu.
- **Leaflet**: hiển thị bản đồ và thao tác vùng.

### 3.2 Nguyên tắc triển khai hiện tại

- UI ưu tiên **local-first** cho các thao tác có thể phản hồi nhanh.
- Các tác vụ nặng như Simulated Annealing được đưa sang **Web Worker** ở màn so sánh thuật toán.
- Chỉ chạy thuật toán khi người dùng **bấm nút Chạy phân chia**.
- Kết quả thuật toán ưu tiên **cân bằng**, **liên thông** và **độ ổn định** thay vì chỉ tối ưu thời gian.

---

## 4. Luồng nghiệp vụ hiện tại

Luồng sử dụng chính của hệ thống:

1. Đăng nhập.
2. Chọn dự án làm việc.
3. Xem `Tổng quan` để kiểm tra tình trạng chung.
4. Vào `Khu vực & bản đồ` để tạo/chọn khu vực và làm việc với bản đồ.
5. Vào `Nhân sự` để quản lý thành viên dự án.
6. Vào `Phân chia lãnh thổ` để chỉnh tay vùng/cụm khi cần.
7. Vào `Vận hành` để theo dõi báo cáo theo tháng và theo khu vực.
8. Vào `Phân chia thuật toán` để chạy thuật toán phân chia và so sánh kết quả.
9. Vào `Cài đặt` để cập nhật thông tin cá nhân và cấu hình hệ thống.

---

## 5. Các màn hình chính

### 5.1 Màn chọn dự án

Người dùng có thể:
- chọn dự án đang làm việc,
- tạo dự án mới,
- đổi theme sáng/tối,
- đăng xuất.

Điểm mới hiện tại:
- tạo dự án được tối ưu theo hướng **optimistic**, phản hồi gần như ngay lập tức,
- hệ thống vẫn đồng bộ nền với Supabase sau đó.

### 5.2 Tổng quan

Màn `Tổng quan` phục vụ người quản lý cấp cao.

Nội dung chính:
- số khu vực địa lý,
- số nhân sự,
- số khách hàng báo cáo,
- số đơn hàng báo cáo,
- bảng hiệu quả kinh doanh theo khu vực,
- bộ lọc theo khu vực.

Màn này tập trung vào **doanh số, khách hàng và mức độ phủ báo cáo**, không phải thông số kỹ thuật của polygon.

### 5.3 Khu vực & bản đồ

Màn này là nơi:
- chọn khu vực,
- tạo khu vực mới,
- xem vùng trên bản đồ,
- lưu map,
- mở/ẩn vùng,
- chuyển sang khu vực khác.

Nếu dự án mới chưa có dữ liệu, đây là màn khởi đầu quan trọng nhất.

### 5.4 Nhân sự

Màn này dùng để:
- xem danh sách thành viên dự án,
- xem email, họ tên, ngày sinh, số điện thoại,
- xem vai trò và khu vực phụ trách,
- quản lý thành viên theo quyền.

Luồng tải thành viên đã được bảo vệ để tránh trạng thái treo vô hạn khi Supabase phản hồi chậm.

### 5.5 Phân chia lãnh thổ

Màn này dùng cho chỉnh tay vùng/cụm:
- xem khu vực đang chọn,
- chuyển vùng sang cụm khác,
- kiểm tra liên thông,
- xem kết quả trên bản đồ.

Mục tiêu là xử lý ngoại lệ sau khi chia tự động hoặc sau khi có dữ liệu mới.

### 5.6 Vận hành

Màn `Vận hành` dùng để:
- xem báo cáo theo tháng,
- lọc theo khu vực,
- tìm theo cụm/user/ghi chú,
- kiểm tra số khách hàng, số đơn hàng, số báo cáo,
- theo dõi độ phủ báo cáo.

Màn này dành cho người quản lý muốn biết **khu vực nào đã có dữ liệu, khu vực nào còn thiếu và chất lượng báo cáo ra sao**.

### 5.7 Phân chia thuật toán

Màn này là nơi chạy các thuật toán phân chia.

Đặc điểm hiện tại:
- chỉ chạy khi bấm nút,
- không tự chạy theo thay đổi cấu hình,
- có overlay trạng thái khi đang chạy,
- SA được chạy qua worker để tránh làm đơ UI,
- kết quả hiển thị bằng tiếng Việt.

Chỉ số kết quả đang nhấn mạnh:
- `Cân bằng`
- `Vi phạm`
- `Độ rộng cụm tối đa`

### 5.8 Cài đặt

Màn này dùng để:
- xem/chỉnh thông tin cá nhân,
- lưu hồ sơ,
- cấu hình hệ thống cần thiết.

Ứng dụng hiện không còn phần đổi ngôn ngữ vì đã cố định sang tiếng Việt.

---

## 6. Thuật toán phân chia

TerriMap hiện hỗ trợ 3 thuật toán:

| Thuật toán | Mục đích |
| --- | --- |
| Greedy Seed Expansion | Tạo nghiệm ban đầu nhanh |
| Local Search | Tối ưu cục bộ, cải thiện chất lượng |
| Simulated Annealing | Tối ưu sâu hơn, ưu tiên nghiệm tốt hơn |

Định hướng hiện tại:

- ưu tiên **chất lượng cân bằng**,
- giữ **liên thông địa lý**,
- hạn chế độ rộng cụm quá lớn,
- chấp nhận thời gian chạy lâu hơn nếu đổi lại phương án tốt hơn,
- nhưng vẫn bảo đảm UI có trạng thái đang chạy rõ ràng.

---

## 7. Dữ liệu và lưu trữ

### 7.1 Supabase

Supabase hiện được dùng cho:
- auth,
- dự án,
- khu vực,
- thành viên,
- báo cáo vận hành,
- snapshot,
- dữ liệu liên quan tới phân chia.

### 7.2 Local-first

Các luồng quan trọng đã được tối ưu theo hướng:

- cập nhật local state trước,
- lưu/đồng bộ Supabase ở nền sau,
- tránh khóa toàn màn hình nếu không cần thiết.

Các luồng đã được áp dụng:
- tạo dự án,
- đăng xuất,
- lưu map,
- lưu báo cáo,
- một số thao tác cập nhật danh sách.

---

## 8. Kiểm thử và chất lượng

### 8.1 Kiểm thử

Quy trình kiểm tra đang dùng:

- `npm run typecheck`
- `npm run test`
- `npm run build`

### 8.2 Vấn đề đã được xử lý gần đây

- sửa lỗi font tiếng Việt,
- sửa lỗi chunk lazy load khi deploy,
- tối ưu tạo dự án mới,
- tối ưu lưu map và lưu báo cáo,
- đưa SA sang worker ở màn so sánh,
- tối ưu lõi tính cost cho partition engine,
- đổi nhãn thuật toán và chỉ số sang tiếng Việt.

---

## 9. Kịch bản demo ngắn cho hội đồng

1. Đăng nhập.
2. Chọn dự án.
3. Vào `Tổng quan` để xem KPI theo khu vực.
4. Vào `Khu vực & bản đồ` để chọn vùng và lưu map.
5. Vào `Nhân sự` để minh hoạ quản lý thành viên.
6. Vào `Phân chia lãnh thổ` để cho thấy chỉnh tay cụm/vùng.
7. Vào `Vận hành` để trình bày báo cáo theo tháng.
8. Vào `Phân chia thuật toán` để chạy Greedy / Local Search / SA và so sánh chất lượng.

Thông điệp chính khi demo:

> TerriMap không chỉ là bản đồ chia vùng, mà là hệ thống giúp lãnh đạo nhìn nhanh tình trạng khu vực, nhân sự, báo cáo và chất lượng phân chia trên cùng một luồng làm việc.

---

## 10. Kết luận

Bản cập nhật hiện tại của TerriMap đã chuyển trọng tâm sang:

- tiếng Việt cố định,
- ngôn ngữ sản phẩm rõ ràng hơn,
- trải nghiệm local-first để giảm cảm giác chờ,
- phân chia thuật toán chú trọng **chất lượng**,
- luồng sử dụng rõ ràng hơn cho quản lý cấp cao.

Nếu cần tiếp tục phát triển, nên ưu tiên:

1. hoàn thiện dữ liệu demo cho hội đồng,
2. tăng độ mượt của các màn thao tác nhiều,
3. tinh chỉnh thêm tiêu chí chất lượng thuật toán theo bài toán thực tế.

