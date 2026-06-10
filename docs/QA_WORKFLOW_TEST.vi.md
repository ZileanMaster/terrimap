# Kịch bản Test Luồng Sử Dụng TerriMap

Tài liệu này dùng để kiểm tra **toàn bộ luồng sử dụng web theo đúng thứ tự**, nhằm phát hiện các vấn đề trong quá trình dùng thực tế.

Mục tiêu chính:

- không lỗi font tiếng Việt
- không bị treo nút
- không cần refresh để cứu giao diện
- dữ liệu đúng theo dự án đang chọn
- các màn chính hiển thị đầy đủ và đúng trạng thái

---

## 1) Chuẩn bị

### Tài khoản test

Nên có tối thiểu:

- 1 tài khoản **Admin**
- 1 tài khoản **Điều phối viên**
- 1 tài khoản **Nhân sự**

### Dữ liệu mẫu

Mỗi dự án test nên có:

- ít nhất 1 dự án
- ít nhất 1 khu vực
- vài vùng
- vài thành viên
- ít nhất 1 báo cáo cụm

### Môi trường

- Mở đúng domain của dự án
- Nếu vừa deploy mới, hard refresh 1 lần để tránh bundle cũ
- Có mạng ổn định để kiểm tra hành vi online

---

## 2) Thứ tự test đề xuất

### Bước 1 - Mở web

**Thao tác**
- Mở TerriMap.

**Kỳ vọng**
- App tải thành công.
- Không có màn trắng.
- Không có lỗi chunk.
- Chữ tiếng Việt hiển thị đúng.

---

### Bước 2 - Đăng nhập

**Thao tác**
- Đăng nhập bằng tài khoản test.

**Kỳ vọng**
- Chuyển đúng sang màn chọn dự án.
- Không bị đơ ở trạng thái loading.

---

### Bước 3 - Chọn hoặc tạo dự án

**Thao tác**
- Chọn dự án cũ.
- Quay lại màn chọn dự án.
- Tạo dự án mới.

**Kỳ vọng**
- Chuyển dự án không bị dính trạng thái cũ.
- Tạo dự án mới xong vào đúng dự án đó ngay.
- Không cần refresh để thấy dự án mới.

**Cần để ý**
- Có bị treo nút `Đăng xuất` hoặc `Đổi dự án` không.
- Có giữ sai khu vực của project cũ không.

---

### Bước 4 - Tổng quan

**Thao tác**
- Vào `Tổng quan`.
- Chọn `Tất cả khu vực`.
- Chọn từng khu vực riêng lẻ.

**Kỳ vọng**
- KPI và bảng báo cáo đổi đúng theo khu vực.
- Không lỗi font ở tiêu đề, bảng, nhãn.
- Dữ liệu đúng theo project hiện tại.

**Cần để ý**
- Có giữ sai khu vực của project trước không.
- Có chỗ nào tải mãi không xong không.

---

### Bước 5 - Khu vực & bản đồ

**Thao tác**
- Vào `Khu vực & bản đồ`.
- Chọn khu vực hiện có.
- Nếu dự án chưa có khu vực, tạo khu vực mới.
- Chỉnh vùng và lưu map.

**Kỳ vọng**
- Khu vực chọn đúng với project hiện tại.
- Tạo khu vực mới thành công.
- Lưu map cập nhật ngay, không cần refresh.
- Vùng và snapshot phản hồi rõ ràng.

**Cần để ý**
- Có nút nào vẫn bị trắng chữ hoặc sai font không.
- Có bị treo ở trạng thái lưu không.

---

### Bước 6 - Nhân sự

**Thao tác**
- Vào `Nhân sự`.
- Chờ danh sách tải xong.
- Kiểm tra thêm/sửa/gán vai trò nếu có quyền.

**Kỳ vọng**
- Danh sách thành viên hiển thị bình thường.
- Không kẹt mãi ở `Đang tải thành viên...`.
- Lưu xong có phản hồi rõ ràng.

**Cần để ý**
- Có bị treo tải do Supabase chậm không.
- Có lỗi font ở cột bảng không.

---

### Bước 7 - Phân chia lãnh thổ

**Thao tác**
- Vào `Phân chia lãnh thổ`.
- Kiểm tra khu vực đang chọn.
- Thử chuyển vùng / cụm nếu được phép.

**Kỳ vọng**
- Màn hiển thị đúng khu vực.
- Chuyển vùng hợp lệ thì cập nhật được.
- Thao tác không bị treo.

---

### Bước 8 - Vận hành

**Thao tác**
- Vào `Vận hành`.
- Chọn tháng.
- Chọn khu vực.
- Tìm theo cụm, user, ghi chú.

**Kỳ vọng**
- Dropdown khu vực hiển thị đầy đủ khu vực của dự án.
- Bảng báo cáo lọc đúng.
- Không còn trạng thái mơ hồ như “bấm mà không thấy gì”.

---

### Bước 9 - Thuật toán phân chia

**Thao tác**
- Vào `Thuật toán phân chia`.
- Chọn khu vực.
- Chọn thuật toán.
- Chọn số cụm.
- Bấm `Chạy phân chia`.

**Kỳ vọng**
- Không tự chạy khi vừa đổi cấu hình.
- Có overlay hoặc trạng thái cho biết thuật toán đang chạy.
- Kết quả xuất hiện sau khi xử lý xong.
- UI không bị đơ cứng.

**Cần để ý**
- SA có chạy nhưng vẫn nhìn thấy giao diện phản hồi.
- Chỉ số hiển thị đúng tiếng Việt.

---

### Bước 10 - Cài đặt

**Thao tác**
- Vào `Cài đặt`.
- Kiểm tra hiển thị thông tin cá nhân.
- Thử lưu nếu có thay đổi.

**Kỳ vọng**
- Không còn nhãn đổi ngôn ngữ.
- Lưu thông tin cá nhân báo kết quả rõ ràng.

---

### Bước 11 - Đổi giao diện sáng/tối

**Thao tác**
- Bấm nút theme trên màn chọn dự án.
- Bấm lại trên app chính nếu cần.

**Kỳ vọng**
- Giao diện đổi ngay.
- Không lỗi font sau khi đổi theme.

---

### Bước 12 - Đổi dự án / đăng xuất

**Thao tác**
- Bấm `Đổi dự án`.
- Chọn dự án khác.
- Bấm `Đăng xuất`.

**Kỳ vọng**
- Không bị treo.
- Không cần refresh để quay về màn chọn dự án.
- Trạng thái dự án cũ không dính sang dự án mới.

---

## 3) Tiêu chí Pass

Lượt test được xem là đạt nếu:

- đi hết các bước mà không gặp màn lỗi
- không gặp lỗi font ở chữ tiếng Việt có dấu
- không bị kẹt loading vô hạn
- không phải refresh để cứu UI
- dữ liệu đúng theo dự án / khu vực đang chọn

