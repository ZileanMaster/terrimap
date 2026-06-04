# Kịch Bản Test Luồng Sử Dụng TerriMap

Tài liệu này dùng để kiểm tra **toàn bộ luồng sử dụng web theo thứ tự**, nhằm phát hiện nhanh các vấn đề về:

- font chữ / hiển thị tiếng Việt
- nút bị đơ hoặc phải refresh
- chuyển dự án / đổi khu vực sai trạng thái
- tải dữ liệu chậm
- lỗi mở màn hình hoặc lỗi chunk sau deploy

## 1. Điều Kiện Chuẩn Bị

### Tài khoản

Nên có sẵn 3 tài khoản test:

- **Admin**
- **Điều phối viên**
- **Nhân sự**

### Dữ liệu tối thiểu

Mỗi dự án test nên có:

- ít nhất 1 dự án
- ít nhất 1 khu vực
- vài vùng / zones
- vài thành viên
- ít nhất 1 báo cáo cụm

### Môi trường

- Mở đúng domain web của dự án
- Trình duyệt sạch cache nếu vừa deploy
- Có kết nối mạng ổn định để test hành vi online

## 2. Mục Tiêu Test

Kiểm tra xem người dùng có thể đi qua toàn bộ luồng chính mà:

- không gặp lỗi font
- không bị treo giao diện
- không cần refresh thủ công
- dữ liệu đúng theo dự án đang chọn
- các nút điều hướng hoạt động đúng

## 3. Thứ Tự Test Tổng Quát

### Bước 1 — Mở web

**Thao tác**
- Mở trang TerriMap.

**Kỳ vọng**
- Trang tải thành công.
- Không có màn trắng hoặc lỗi chunk.
- Font hiển thị đúng tiếng Việt.

**Cần để ý**
- Chữ có dấu như `Khu vực`, `Đổi dự án`, `Tổng quan` phải hiển thị đúng.

---

### Bước 2 — Đăng nhập

**Thao tác**
- Đăng nhập bằng tài khoản test.

**Kỳ vọng**
- Đăng nhập xong đi tiếp đúng màn hình.
- Không bị đứng ở trạng thái loading quá lâu.

**Cần để ý**
- Nút đăng nhập không được đơ.
- Nếu sai mật khẩu, phải hiện lỗi rõ ràng.

---

### Bước 3 — Chọn dự án

**Thao tác**
- Chọn một dự án cũ.
- Quay lại màn chọn dự án.
- Tạo một dự án mới nếu cần kiểm tra flow tạo mới.

**Kỳ vọng**
- Chuyển dự án không bị sai trạng thái cũ.
- Tạo dự án mới xong phải vào đúng dự án đó ngay.
- Không cần refresh để thấy dự án mới.

**Cần để ý**
- Có bị dính khu vực cũ của dự án khác không.
- Có bị đơ khi bấm `Đăng xuất` hoặc `Đổi dự án` không.

---

### Bước 4 — Màn Tổng quan

**Thao tác**
- Vào `Tổng quan`.
- Chọn `Tất cả khu vực`.
- Chọn từng khu vực riêng lẻ.

**Kỳ vọng**
- KPI và bảng báo cáo thay đổi đúng theo khu vực đang chọn.
- Không bị lỗi font ở tiêu đề / bảng / nhãn.
- Dữ liệu hiển thị đúng dự án đang xem.

**Cần để ý**
- Có bị giữ lại khu vực của project cũ không.
- Có màn nào tải mãi không xong không.

---

### Bước 5 — Khu Vực & Bản Đồ

**Thao tác**
- Vào `Khu vực & bản đồ`.
- Chọn một khu vực hiện có.
- Nếu dự án chưa có khu vực, tạo khu vực mới.
- Vẽ / chỉnh vùng nếu có dữ liệu bản đồ.
- Bấm lưu map.
- Đổi sang khu vực khác rồi quay lại.

**Kỳ vọng**
- Khu vực chọn đúng với project hiện tại.
- Tạo khu vực mới thành công.
- Lưu map không bị treo lâu.
- Vùng hiển thị đúng, không mất dữ liệu sau khi quay lại.

**Cần để ý**
- Có nút nào bị trắng chữ hoặc sai font không.
- Có phải refresh mới thấy vùng đã lưu không.

---

### Bước 6 — Nhân Sự

**Thao tác**
- Vào `Nhân sự`.
- Chờ danh sách thành viên tải xong.
- Kiểm tra thêm / sửa / gán vai trò nếu quyền cho phép.

**Kỳ vọng**
- Danh sách thành viên hiển thị trong thời gian hợp lý.
- Không bị kẹt ở trạng thái `Đang tải thành viên...`.
- Thao tác lưu không khóa màn hình.

**Cần để ý**
- Có bị lỗi font ở bảng thành viên không.
- Có bị mất ngữ cảnh dự án hiện tại không.

---

### Bước 7 — Phân Chia Lãnh Thổ

**Thao tác**
- Vào `Phân chia lãnh thổ`.
- Kiểm tra khu vực đang chọn.
- Chạy phân chia hoặc mở chế độ xem kết quả.
- Thử thao tác đổi khu vực xem có cập nhật đúng không.

**Kỳ vọng**
- Điều phối viên / admin vào được đúng màn.
- Kết quả phân chia hiển thị đúng khu vực.
- Không bị treo khi đổi khu vực hoặc chạy tác vụ.

**Cần để ý**
- Có lỗi quyền truy cập không.
- Có kết quả cũ hiển thị sai cho khu vực mới không.

---

### Bước 8 — Vận Hành

**Thao tác**
- Vào `Vận hành`.
- Chọn tháng.
- Chọn khu vực.
- Tìm theo cụm / user / ghi chú.
- Xuất CSV nếu cần.

**Kỳ vọng**
- Dropdown khu vực hiển thị đầy đủ khu vực của dự án.
- Bảng lọc đúng.
- Tải dữ liệu không quá lâu.

**Cần để ý**
- Có chỗ nào vẫn chỉ hiện 1 khu vực thay vì toàn bộ khu vực dự án không.

---

### Bước 9 — Phân Chia Tự Động

**Thao tác**
- Vào `Phân chia tự động`.
- Chọn khu vực.
- Chọn thuật toán.
- Chạy phân chia.

**Kỳ vọng**
- Nút chạy hoạt động ngay.
- Có kết quả so sánh.
- Điều phối viên không bị chặn thao tác nếu quyền đã cho phép.

**Cần để ý**
- Có bị treo ở phần chọn thuật toán hoặc chọn khu vực không.

---

### Bước 10 — Cài Đặt

**Thao tác**
- Vào `Cài đặt`.
- Kiểm tra hiển thị.
- Nếu có profile, thử lưu thông tin cá nhân.

**Kỳ vọng**
- Không còn nhãn thừa về ngôn ngữ.
- Lưu thông tin cá nhân phản hồi rõ ràng.

**Cần để ý**
- Có thông báo lỗi mơ hồ hoặc bị treo nút lưu không.

---

### Bước 11 — Đổi giao diện sáng/tối

**Thao tác**
- Bấm nút đổi sáng/tối ở màn chọn dự án.
- Bấm lại ở màn chính nếu có.

**Kỳ vọng**
- Giao diện đổi ngay.
- Không bị lỗi font khi đổi theme.

---

### Bước 12 — Đổi dự án / đăng xuất

**Thao tác**
- Bấm `Đổi dự án`.
- Chọn dự án khác.
- Bấm `Đăng xuất`.

**Kỳ vọng**
- Không bị treo.
- Không cần refresh để quay lại màn chọn dự án.
- Trạng thái dự án cũ không còn dính sang dự án mới.

## 4. Tiêu Chí Pass

Một lượt test được xem là đạt nếu:

- đi hết các bước trên mà không gặp màn lỗi
- không gặp font sai ở chữ Việt có dấu
- không bị kẹt ở loading vô hạn
- không phải refresh để cứu UI
- dữ liệu đúng theo dự án / khu vực đang chọn

## 5. Cách Ghi Nhận Lỗi

Khi phát hiện lỗi, ghi lại:

- bước đang test
- màn hình / nút bị lỗi
- tài khoản đang dùng
- dự án đang mở
- ảnh chụp màn hình
- thời điểm xảy ra

## 6. Gợi Ý Chạy Test

Nên test theo thứ tự:

1. Admin
2. Điều phối viên
3. Nhân sự

Và lặp lại sau mỗi lần deploy hoặc thay đổi liên quan đến:

- auth
- theme / font
- dự án
- lưu dữ liệu
- bản đồ / vùng / báo cáo

