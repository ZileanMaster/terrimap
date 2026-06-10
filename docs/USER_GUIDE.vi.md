# Hướng Dẫn Sử Dụng TerriMap

TerriMap là hệ thống web hỗ trợ **thiết kế, vận hành và theo dõi lãnh thổ kinh doanh** theo khu vực. Ứng dụng hiện tại dùng **tiếng Việt cố định**, không còn nút đổi ngôn ngữ, và được tối ưu theo luồng làm việc thực tế của quản lý cấp cao, admin, điều phối viên và nhân sự.

---

## 1) Thuật ngữ chính

### Dự án
- Mỗi dự án là một không gian làm việc riêng.
- Dữ liệu khu vực, vùng, nhân sự, báo cáo và kết quả phân chia không trộn với dự án khác.
- Khi mở lại dự án cũ, hệ thống nên đưa bạn về đúng ngữ cảnh của dự án đó.

### Khu vực
- Khu vực là phạm vi vận hành lớn, ví dụ: Hà Nội, TP. Hồ Chí Minh, Huế.
- Mỗi khu vực có bản đồ, vùng, nhân sự và báo cáo riêng.
- Khi dự án chưa có dữ liệu, màn `Khu vực & bản đồ` sẽ là nơi bắt đầu tốt nhất.

### Vùng
- `Vùng` là phần hiển thị thân thiện của polygon trên bản đồ.
- Mỗi vùng có thể gắn với khách hàng, đơn hàng, cụm và người phụ trách.
- Trong tài liệu kỹ thuật bên trong, một số tên vẫn có thể dùng từ `polygon` để giữ ổn định mã nguồn, nhưng giao diện người dùng dùng từ **vùng**.

### Cụm
- Cụm là nhóm các vùng được phân cho cùng một lãnh thổ bán hàng.
- Hệ thống luôn kiểm tra **liên thông** của cụm để tránh chia sai địa lý.

---

## 2) Cách mở và bắt đầu làm việc

### Bước 1: Đăng nhập
- Đăng nhập bằng tài khoản được cấp.
- Nếu đúng, hệ thống chuyển sang màn chọn dự án.

### Bước 2: Chọn dự án làm việc
- Chọn dự án đang cần thao tác.
- Có thể tạo dự án mới ngay trên màn này.
- Nút đổi sáng/tối nằm trên chính màn chọn dự án.

### Bước 3: Vào hệ thống
- Sau khi chọn dự án, hệ thống vào app chính.
- Thanh điều hướng bên trái sẽ hiển thị các màn phù hợp với vai trò của bạn.

---

## 3) Bố cục giao diện hiện tại

Thanh điều hướng chính gồm:

| Mục | Mục đích |
| --- | --- |
| Tổng quan | Xem KPI và báo cáo theo khu vực |
| Khu vực & bản đồ | Chọn khu vực, tạo khu vực, xem và chỉnh vùng trên bản đồ |
| Nhân sự | Quản lý thành viên dự án |
| Phân chia lãnh thổ | Chỉnh tay vùng/cụm theo nghiệp vụ |
| Vận hành | Theo dõi báo cáo theo tháng và theo khu vực |
| Thuật toán phân chia | Chạy các thuật toán phân chia và so sánh kết quả |
| Cài đặt | Hồ sơ cá nhân và cấu hình hệ thống |

Vai trò được hiển thị theo ba nhóm chính:
- **Quản trị viên**
- **Điều phối viên**
- **Nhân sự**

---

## 4) Quy trình sử dụng khuyến nghị

Thứ tự nên đi:

1. Chọn dự án.
2. Vào **Tổng quan** để xem bức tranh chung.
3. Vào **Khu vực & bản đồ** để tạo hoặc chọn khu vực.
4. Vào **Nhân sự** để kiểm tra thành viên và vai trò.
5. Vào **Phân chia lãnh thổ** để chỉnh tay vùng/cụm nếu cần.
6. Vào **Vận hành** để theo dõi báo cáo theo tháng.
7. Vào **Thuật toán phân chia** để chạy thuật toán khi muốn tối ưu.
8. Lưu map hoặc snapshot nếu cần quay lại trạng thái trước đó.

> Lưu ý: phần thuật toán hiện **chỉ chạy khi bấm nút Chạy phân chia**, không tự chạy khi đổi cấu hình.

---

## 5) Mô tả từng màn hình

### 5.1 Tổng quan
Màn này dành cho người quản lý cấp cao.

Bạn có thể:
- xem số khu vực địa lý
- xem số nhân sự
- xem tổng khách hàng báo cáo
- xem tổng đơn hàng báo cáo
- xem khách hàng trung bình mỗi báo cáo
- lọc theo toàn bộ khu vực hoặc từng khu vực
- xem bảng hiệu quả kinh doanh theo khu vực

Màn này không còn tập trung vào thông số kỹ thuật của polygon, mà nhấn mạnh **doanh số, khách hàng và trạng thái báo cáo**.

### 5.2 Khu vực & bản đồ
Đây là màn làm việc chính với bản đồ.

Bạn có thể:
- chọn khu vực đang làm việc
- tạo khu vực mới
- xem vùng trên bản đồ
- mở/ẩn phần vùng
- lưu map
- chuyển sang khu vực khác

Nếu dự án mới chưa có khu vực, đây là nơi bắt đầu dữ liệu đầu tiên.

### 5.3 Nhân sự
Màn này dùng để:
- xem danh sách thành viên dự án
- kiểm tra email, tên, ngày sinh, số điện thoại
- kiểm tra vai trò
- xem khu vực phụ trách nếu có
- thêm hoặc chỉnh thông tin thành viên theo quyền

Danh sách thành viên có thể tải dữ liệu từ Supabase hoặc dữ liệu dự phòng cục bộ tùy môi trường.

### 5.4 Phân chia lãnh thổ
Màn này dùng cho thao tác chỉnh tay vùng và cụm.

Bạn có thể:
- xem vùng đang chọn
- chuyển vùng sang cụm khác nếu hợp lệ
- xem cảnh báo khi làm mất liên thông
- đối chiếu theo bản đồ

Đây là màn giúp điều phối viên và admin xử lý ngoại lệ sau khi chia tự động hoặc sau khi có dữ liệu mới.

### 5.5 Vận hành
Màn này dùng để theo dõi báo cáo thực tế theo tháng và theo khu vực.

Bạn có thể:
- chọn tháng
- lọc theo khu vực
- tìm theo cụm, user hoặc ghi chú
- xem số khách hàng, số đơn hàng, số báo cáo và độ phủ báo cáo
- xuất CSV nếu cần

Mục tiêu của màn này là cho người quản lý thấy **khu vực nào đã có dữ liệu, khu vực nào còn thiếu, và mức độ phủ báo cáo ra sao**.

### 5.6 Thuật toán phân chia
Màn này dùng để chạy thuật toán phân chia lãnh thổ.

Hiện tại:
- chỉ chạy khi bấm nút **Chạy phân chia**
- ưu tiên **chất lượng phương án** thay vì chạy tự động liên tục
- có overlay báo trạng thái đang chạy
- có kết quả so sánh và chỉ số chất lượng

Các thuật toán đang dùng:
- Greedy Seed Expansion
- Local Search
- Simulated Annealing

### 5.7 Cài đặt
Màn này dùng để:
- xem/cập nhật thông tin cá nhân
- lưu thông tin tài khoản
- kiểm tra cấu hình giao diện và hệ thống

Ứng dụng hiện chỉ dùng tiếng Việt, nên không còn phần chỉnh ngôn ngữ.

---

## 6) Các thao tác chính

### Tạo dự án mới
1. Vào màn chọn dự án.
2. Bấm **Tạo dự án mới**.
3. Nhập tên và mô tả.
4. Lưu.

Hệ thống sẽ tạo dự án theo cách tối ưu để người dùng thấy phản hồi sớm, không phải chờ lâu mới chuyển màn.

### Tạo khu vực mới
1. Vào `Khu vực & bản đồ`.
2. Bấm **Tạo khu vực mới**.
3. Nhập tên khu vực.
4. Lưu.

### Lưu map
1. Chỉnh vùng trên bản đồ.
2. Bấm **Lưu map**.
3. Hệ thống ghi trạng thái mới và cập nhật ngay danh sách snapshot.

### Chạy thuật toán
1. Vào `Thuật toán phân chia`.
2. Chọn khu vực.
3. Chọn thuật toán.
4. Chọn số cụm.
5. Bấm **Chạy phân chia**.

Nếu thuật toán chạy lâu, giao diện sẽ hiển thị rõ trạng thái đang chạy để người dùng không tưởng là bị treo.

---

## 7) Cách đọc kết quả thuật toán

Kết quả hiện nay nhấn mạnh ba chỉ số:

- **Cân bằng**: phương án chia đều tới mức nào.
- **Khách hàng TB / cụm**: số khách hàng trung bình trên mỗi cụm sau khi phân chia.
- **Vi phạm**: số ràng buộc bị vi phạm; càng thấp càng tốt.
- **Độ rộng cụm tối đa**: cụm nào trải rộng nhất; càng nhỏ càng tốt.

Nguyên tắc đọc nhanh:
- `Cân bằng` càng cao càng tốt.
- `Khách hàng TB / cụm` nên hợp lý và không lệch quá mạnh giữa các phương án.
- `Vi phạm` nên bằng 0.
- `Độ rộng cụm tối đa` càng nhỏ càng tốt.

---

## 8) Lỗi thường gặp và cách xử lý nhanh

- **Nút bị đứng lâu**: chờ overlay trạng thái, nếu vẫn bất thường thì xem console trình duyệt.
- **Không thấy dữ liệu đúng dự án**: bấm `Đổi dự án` rồi chọn lại dự án.
- **Thiếu khu vực**: tạo khu vực mới trong `Khu vực & bản đồ`.
- **Thuật toán chạy lâu**: đó là do chất lượng phương án đang được ưu tiên, không còn tự chạy ngầm.
- **Chữ tiếng Việt lỗi font**: hard refresh một lần để bỏ bundle cũ.

---

## 9) Ghi chú cho người vận hành

- Dự án hiện chỉ dùng tiếng Việt.
- Không còn nút đổi ngôn ngữ.
- Các thao tác save quan trọng đã được tối ưu theo hướng **local-first** để giảm cảm giác chờ.
- Một số tên kỹ thuật bên trong mã nguồn vẫn có thể dùng từ cũ như `district`, `polygon` để giữ ổn định hệ thống, nhưng giao diện hiển thị đã chuẩn hoá theo tiếng Việt.
