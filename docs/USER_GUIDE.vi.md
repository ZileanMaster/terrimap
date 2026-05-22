# 📖 Hướng dẫn sử dụng TerriMap

> **Phần mềm**: TerriMap — Hệ thống thiết kế vùng thương mại
> **Phiên bản**: 1.0.0
> **Ngày cập nhật**: 2026-04-06

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Khởi động ứng dụng](#2-khởi-động-ứng-dụng)
3. [Giao diện chung](#3-giao-diện-chung)
4. [Hướng dẫn cho Quản trị viên (Admin)](#4-hướng-dẫn-cho-quản-trị-viên-admin)
5. [Hướng dẫn cho Người điều phối (Coordinator)](#5-hướng-dẫn-cho-người-điều-phối-coordinator)
6. [Hướng dẫn cho Nhân viên bán hàng (Sales)](#6-hướng-dẫn-cho-nhân-viên-bán-hàng-sales)
7. [Xử lý sự cố](#7-xử-lý-sự-cố)
8. [Câu hỏi thường gặp (FAQ)](#8-câu-hỏi-thường-gặp-faq)

---

## 1. Giới thiệu

TerriMap là ứng dụng web giúp **chia các vùng địa lý (zones) cho đội ngũ bán hàng (sales)** một cách tối ưu. Hệ thống hỗ trợ:

- **3 thuật toán** phân chia tự động (Tham lam, K-Means, Simulated Annealing)
- **Bản đồ tương tác** với polygon vùng tô màu theo district
- **3 vai trò** người dùng với quyền hạn khác nhau
- **Xuất dữ liệu** ra CSV, GeoJSON, PDF

### Vai trò người dùng

| Vai trò | Quyền hạn | Mô tả |
|---------|----------|-------|
| 🟢 **Quản trị (Admin)** | Toàn quyền | Chạy thuật toán, vẽ vùng mới, sửa dữ liệu, tạo snapshot, xuất báo cáo |
| 🟡 **Điều phối (Coordinator)** | Đọc + gán vùng | Xem tổng quan đội ngũ, gán vùng thủ công cho sales |
| 🔵 **Bán hàng (Sales)** | Chỉ đọc | Xem khu vực mình được giao, thông tin khách hàng/đơn hàng |

---

## 2. Khởi động ứng dụng

### Yêu cầu
- **Node.js** phiên bản 18 trở lên
- **Trình duyệt**: Chrome, Firefox, Edge (khuyến nghị Chrome)

### Khởi động

Mở terminal tại thư mục dự án và chạy:

```bash
npm run dev
```

Ứng dụng sẽ mở tại địa chỉ: **http://localhost:5173/**

> [!TIP]
> Nếu port 5173 đã bị chiếm, Vite sẽ tự động chọn port khác (5174, 5175...). Kiểm tra trong terminal.

---

## 3. Giao diện chung

![Giao diện Admin — TerriMap](./assets/admin-ui.png)

### Thanh điều hướng (TopBar)

Thanh trên cùng chứa:

| Thành phần | Vị trí | Chức năng |
|-----------|--------|----------|
| 🔵 **Logo TerriMap** | Trái | Về trang chính |
| **Quản trị / Điều phối / Bán hàng** | Giữa-trái | Chuyển đổi vai trò |
| ☀️ / 🌙 | Phải | Chuyển chế độ Sáng / Tối |
| 🖥️ | Phải | Bật/tắt chế độ toàn màn hình |
| **VI / EN** | Phải | Chuyển ngôn ngữ Tiếng Việt / English |

### Bố cục 3 cột

| Cột | Vị trí | Nội dung |
|-----|--------|---------|
| **Sidebar** (trái) | 280px | Thống kê, danh sách sales, danh sách vùng |
| **Bản đồ** (giữa) | Linh hoạt | Bản đồ Leaflet với polygon tô màu |
| **Panel phải** | 350px | Thuật toán, kết quả, lịch sử, ma trận, xuất |

> [!NOTE]
> Cột Panel phải chỉ hiển thị với vai trò **Admin** và **Coordinator**. Sales chỉ có 2 cột.

---

## 4. Hướng dẫn cho Quản trị viên (Admin)

> **Chuyển sang Admin**: Nhấp vào tab **"Quản trị"** trên thanh điều hướng.

### 4.1 Tổng quan hệ thống

Ở đầu sidebar trái, bạn thấy 3 ô thống kê:

| Ô | Ý nghĩa |
|---|---------|
| **12 VÙNG** | Tổng số vùng (zones) trong hệ thống |
| **4 DISTRICTS** | Tổng số khu vực (districts) đã phân chia |
| **4 SALES** | Tổng số nhân viên bán hàng |

> Các con số này **cập nhật tự động** khi bạn thêm vùng mới hoặc chạy thuật toán.

---

### 4.2 Chạy thuật toán phân chia

Đây là tính năng cốt lõi — chia các vùng cho đội ngũ sales tự động.

#### Bước 1: Chọn thuật toán

Ở panel phải, mục **"Thuật toán phân chia"**, chọn 1 trong 3:

| Thuật toán | Đặc điểm | Khi nào dùng |
|-----------|----------|-------------|
| ⚡ **Tham lam** (Greedy) | Nhanh nhất, O(n log n) | Cần kết quả nhanh, không cần tối ưu |
| 🎯 **K-Means** | Tối ưu theo vị trí địa lý | Muốn các vùng gần nhau về mặt địa lý |
| 🔥 **Simulated Annealing** | Cân bằng tốt nhất | Muốn phân bổ công bằng nhất cho sales |

#### Bước 2: Chọn số districts

Dùng nút **−** / **+** bên cạnh "Số districts" để chọn số lượng khu vực (tối thiểu 2, tối đa bằng số vùng).

#### Bước 3: Nhấn "Chạy phân chia"

Nhấn nút xanh **"▶ Chạy phân chia"**. Bản đồ sẽ cập nhật:
- Mỗi vùng được **tô màu** theo district
- Thanh tiến trình hiển thị (đặc biệt với SA)

#### Bước 4: Đọc kết quả

Sau khi chạy xong, mục **"Kết quả"** hiển thị:

| Chỉ số | Ý nghĩa | Giá trị tốt |
|--------|---------|-------------|
| **Điểm cân bằng** | Mức độ phân bổ đều giữa các district (0-100) | > 80 (Tốt), > 90 (Rất tốt) |
| **Đường kính (km)** | Khoảng cách tối đa trong district lớn nhất | Càng nhỏ càng tốt |
| **Thời gian (ms)** | Thời gian chạy thuật toán | < 500ms là bình thường |
| **Vi phạm** | Số lỗi ràng buộc (vùng cô lập, district tách rời) | 0 là lý tưởng |

> [!TIP]
> Nếu điểm cân bằng thấp (< 60) và bạn đang dùng Greedy/KMeans, hệ thống sẽ gợi ý **"Chạy SA tự động"**. Nhấn nút này để tối ưu kết quả.

---

### 4.3 Xem thông tin vùng trên bản đồ

1. **Nhấp vào polygon** trên bản đồ → hiện bảng thông tin chi tiết ở góc dưới
2. Thông tin hiển thị:
   - Tên vùng + badge district (D0, D1, D2...)
   - Số khách hàng (👥)
   - Số đơn hàng (📦)

#### Sửa thông tin hoạt động (Activity)

Khi đang xem thông tin vùng, Admin có thể **sửa trực tiếp**:

1. Nhập số mới vào ô **"Sửa KH"** hoặc **"Sửa đơn"**
2. Nhấn **"Lưu"**
3. Dữ liệu cập nhật ngay — sidebar và bản đồ phản ánh thay đổi

> [!IMPORTANT]
> Chỉ nhập số nguyên ≥ 0. Nếu nhập chữ hoặc số âm, dữ liệu sẽ không được lưu (bảo vệ NaN).

---

### 4.4 Vẽ vùng mới trên bản đồ

Admin có thể **tạo vùng mới** trực tiếp trên bản đồ:

1. Nhấn vào biểu tượng **vẽ polygon** (🔷) ở góc trên phải bản đồ
2. Nhấp từng điểm trên bản đồ để vẽ các đỉnh polygon
3. Nhấp đúp (double-click) để hoàn thành polygon
4. Nhập **tên vùng** trong hộp thoại popup
5. Vùng mới xuất hiện trên bản đồ và trong danh sách sidebar

> [!NOTE]
> Vùng mới được thêm ở trạng thái "chưa gán" (unassigned). Chạy lại thuật toán để gán nó vào district.

---

### 4.5 Xem ma trận kề & khoảng cách

Cuộn xuống trong panel phải, mở mục **"Ma trận"**:

| Tab | Nội dung |
|-----|---------|
| **Kề (Adj)** | Bảng hiển thị vùng nào kề vùng nào (✓ = kề, · = không kề) |
| **Khoảng cách (Dist)** | Bảng khoảng cách giữa các cặp vùng (km), tô màu heatmap |

> Bảng có **cột cố định** (sticky) — cuộn ngang vẫn thấy tên vùng bên trái.

---

### 4.6 Quản lý phiên bản (Snapshot)

Cho phép **lưu trạng thái hiện tại** để so sánh hoặc khôi phục sau:

1. Cuộn xuống cuối sidebar trái
2. Nhấn **"📸 Tạo snapshot"**
3. Snapshot được lưu với timestamp tự động
4. Xem danh sách snapshots trong mục **"Lịch sử phiên bản"** ở panel phải

> Mỗi snapshot lưu: zones, assignments, và metadata tại thời điểm tạo.

---

### 4.7 Xuất dữ liệu (Export)

Cuộn xuống cuối panel phải, mở mục **"📥 Xuất dữ liệu"**:

| Nút | Format | Nội dung |
|-----|--------|---------|
| **📋 Phân vùng** | CSV | Bảng: zone → district → sales → KH → đơn |
| **🗺️ Danh sách vùng** | CSV | Bảng: zone → tọa độ → KH → đơn → số đỉnh polygon |
| **📐 Ma trận kề** | CSV | Bảng: zone → danh sách neighbor IDs |
| **🌐 GeoJSON** | GeoJSON | File bản đồ (import vào QGIS, Google Earth, Mapbox) |
| **📄 Báo cáo PDF** | PDF | Mở tab mới → hộp thoại in → lưu PDF |

#### Cách xuất:

1. Nhấp mở mục **"📥 Xuất dữ liệu"**
2. Nhấn nút tương ứng
3. File được tải xuống tự động (CSV/GeoJSON) hoặc mở tab in (PDF)
4. Sau khi tải, nút hiện **✓** xác nhận

> [!TIP]
> **GeoJSON** rất hữu ích để import vào các phần mềm GIS chuyên nghiệp như QGIS hoặc hiển thị trên Google Maps/Mapbox.

---

### 4.8 Phát hiện bất thường

Hệ thống tự động phát hiện và cảnh báo:

| Cảnh báo | Biểu tượng | Ý nghĩa |
|---------|----------|---------|
| **Vùng cô lập** | 🏝️ (badge trên zone card) | Vùng không kề vùng nào trong 50km |
| **District tách rời** | 🔴 (badge trên agent card) | District có vùng bị tách rời (không liên thông) |
| **Gợi ý SA** | Banner vàng | Điểm cân bằng thấp — nên chạy SA |

> Trên bản đồ: vùng cô lập có **viền cam đứt đoạn**, district tách rời có **viền đỏ đứt đoạn**.

---

### 4.9 Đội ngũ Sales (Sidebar)

Sidebar hiển thị danh sách sales agents:

| Thông tin | Mô tả |
|----------|-------|
| **Tên** | Nguyễn Văn Alpha, Trần Thị Beta... |
| **Khu vực** | Tây-Bắc Hà Nội, Đông-Nam Hà Nội... |
| **Số vùng** | Số zones được gán |

- **Nhấp vào agent card** → bản đồ highlight các vùng của sales đó
- **Nhấp lại** → bỏ highlight (toggle)

---

## 5. Hướng dẫn cho Người điều phối (Coordinator)

> **Chuyển sang Coordinator**: Nhấp vào tab **"Điều phối"** trên thanh điều hướng.

### 5.1 Tổng quan đội ngũ

Coordinator thấy:

| Thông tin | Vị trí |
|----------|--------|
| **Tổng KH** | Ô thống kê đầu sidebar |
| **Tổng đơn hàng** | Ô thống kê đầu sidebar |
| **Danh sách sales agents** | Cards phía dưới, hiện tên + khu vực + số zones + KH |

> Nhấp vào agent card để **highlight vùng trên bản đồ** tương tự Admin.

---

### 5.2 Gán vùng thủ công

Coordinator có thể **chuyển vùng từ district này sang district khác**:

#### Bước 1: Chọn vùng
Nhấp vào polygon trên bản đồ → bảng thông tin hiện ra.

#### Bước 2: Chọn district mới
Trong dropdown **"Chuyển sang district"**, chọn district đích (D0, D1, D2...).

#### Bước 3: Xác nhận
Nhấn **"Xác nhận"**. Bản đồ cập nhật:
- Polygon đổi màu theo district mới
- Sidebar cập nhật số zones của sales agents

> [!WARNING]
> Khi gán thủ công, hệ thống **kiểm tra ràng buộc** (contiguity, balance). Nếu vi phạm, thao tác vẫn được phép nhưng sẽ hiển thị cảnh báo.

---

### 5.3 Lịch sử cập nhật

Cuộn xuống cuối sidebar để xem **lịch sử cập nhật** gần đây:

| Thông tin | Mô tả |
|----------|-------|
| **Thời gian** | Ngày/giờ thay đổi |
| **Nội dung** | Mô tả hành động (gán vùng, cập nhật activity...) |
| **Chu kỳ** | Tự động nhóm theo tuần hoặc tháng |

---

### 5.4 Danh sách vùng

Dưới lịch sử là **danh sách tất cả zones** với:
- Tên vùng
- District hiện tại (D0, D1...)
- Số khách hàng

Nhấp vào zone card → bản đồ **zoom đến** vùng đó và hiện thông tin chi tiết.

---

## 6. Hướng dẫn cho Nhân viên bán hàng (Sales)

> **Chuyển sang Sales**: Nhấp vào tab **"Bán hàng"** trên thanh điều hướng.

### 6.1 Giao diện đơn giản

Sales chỉ thấy **2 cột**:
- **Sidebar trái**: Danh sách zones trong district của mình
- **Bản đồ**: Hiển thị khu vực được giao (chỉ district của mình)

> [!NOTE]
> Sales **không** thấy panel phải (thuật toán, ma trận, xuất dữ liệu). Đây là giao diện chỉ đọc.

---

### 6.2 Xem khu vực được giao

Bản đồ tự động **filter** chỉ hiển thị các vùng thuộc district của bạn:
- Polygon tô màu theo district
- Zoom phù hợp với khu vực

---

### 6.3 Xem thông tin zone

Nhấp vào polygon trên bản đồ để xem:

| Thông tin | Mô tả |
|----------|-------|
| **Tên vùng** | Ví dụ: "Hoàn Kiếm", "Ba Đình" |
| **District** | Badge màu (D0, D1...) |
| **👥 Khách hàng** | Số lượng KH trong zone |
| **📦 Đơn hàng** | Số lượng đơn hàng dự kiến |

> Sales **không thể sửa** thông tin — chỉ có Admin mới có quyền.

---

### 6.4 Sidebar — Danh sách zones

Sidebar hiển thị tất cả zones trong district:
- Mỗi zone card hiện **tên + district + số KH**
- Nhấp vào zone card → bản đồ highlight zone đó
- Zone đang chọn có **viền xanh** nổi bật

---

## 7. Xử lý sự cố

### 7.1 Bản đồ không hiển thị

| Nguyên nhân | Cách khắc phục |
|------------|----------------|
| Mạng Internet chậm | Chờ tiles tải xong (OpenStreetMap cần kết nối mạng) |
| CSS chưa load | Refresh trang (F5) |
| Zoom quá xa/gần | Nhấn nút **+** / **−** ở góc trên trái bản đồ |

### 7.2 Thuật toán chạy lâu

| Thuật toán | Thời gian bình thường | Xử lý |
|-----------|---------------------|-------|
| Greedy | < 50ms | Nếu lâu hơn → refresh trang |
| K-Means | < 200ms | Bình thường |
| SA | < 500ms (Web Worker) | UI vẫn responsive, đợi kết quả |

> SA chạy trong **background worker** — bạn có thể thao tác bản đồ trong lúc đợi.

### 7.3 File xuất không mở được

| Vấn đề | Cách xử lý |
|--------|-----------|
| CSV hiển thị tiếng Việt lỗi | Mở bằng Excel → Data → From Text → chọn UTF-8 |
| GeoJSON không mở | Sử dụng [geojson.io](https://geojson.io) hoặc QGIS |
| PDF không in | Kiểm tra popup blocker trong trình duyệt |

### 7.4 Trang trắng khi mở

```bash
# Kiểm tra server đang chạy:
npm run dev

# Nếu lỗi port:
npx vite --port 3000
```

---

## 8. Câu hỏi thường gặp (FAQ)

### ❓ Tôi có thể thêm/xóa nhân viên sales không?

Hiện tại hệ thống sử dụng danh sách sales cố định (4 agents). Để thay đổi, cần chỉnh sửa file `src/data/mock-agents.ts`.

### ❓ Dữ liệu có được lưu lại khi refresh trang không?

Không — dữ liệu hiện được lưu trong bộ nhớ (in-memory). Khi refresh trang, dữ liệu trở về trạng thái ban đầu. Hãy **xuất dữ liệu** (CSV/GeoJSON) trước khi rời trang.

### ❓ Thuật toán nào tốt nhất?

- **Cần nhanh**: Tham lam (Greedy)
- **Cần phân bố đều địa lý**: K-Means
- **Cần cân bằng tải tối ưu**: Simulated Annealing (SA)

> Khuyến nghị: Chạy **SA** cho kết quả sản xuất, dùng **Greedy/KMeans** để xem nhanh.

### ❓ "Vi phạm" nghĩa là gì?

Vi phạm là các ràng buộc bị phá:
- **CONTIGUITY**: District không liên thông (có vùng bị tách rời)
- **BALANCE**: Phân bổ không đều giữa các district
- **DIAMETER**: Khoảng cách tối đa trong district quá lớn

Số vi phạm = 0 là kết quả lý tưởng.

### ❓ Tôi có thể dùng nhiều ngôn ngữ không?

Có — nhấn **"VI"** ở góc phải TopBar để chuyển sang English (**"EN"**). Giao diện hỗ trợ cả Tiếng Việt và English.

### ❓ Dark mode hoạt động thế nào?

Nhấn biểu tượng **☀️** (chế độ sáng) hoặc **🌙** (chế độ tối) ở góc phải TopBar. Hệ thống cũng có chế độ **tự động** theo cài đặt hệ điều hành.

### ❓ Số districts tối đa là bao nhiêu?

Số districts phải từ **2** đến **số zones**. Với 12 zones mặc định → tối đa 12 districts.

---

## Bảng tóm tắt phím tắt & thao tác

| Thao tác | Cách làm |
|---------|---------|
| Zoom bản đồ | **Scroll chuột** hoặc nút **+** / **−** |
| Chọn vùng | **Nhấp vào polygon** trên bản đồ |
| Bỏ chọn | **Nhấp vào chỗ trống** hoặc nhấp lại polygon |
| Highlight sales agent | **Nhấp vào agent card** trong sidebar |
| Vẽ polygon mới (Admin) | Nhấp **biểu tượng vẽ** → nhấp từng đỉnh → **nhấp đúp** để hoàn thành |
| Chuyển vai trò | Nhấp **tab trên TopBar** |
| Chuyển ngôn ngữ | Nhấp **VI/EN** trên TopBar |
| Toàn màn hình | Nhấp **biểu tượng monitor** trên TopBar |

---

> **Liên hệ hỗ trợ**: Nếu gặp vấn đề kỹ thuật, vui lòng liên hệ đội phát triển kèm theo:
> 1. Screenshot lỗi
> 2. Mô tả bước tái hiện
> 3. Console log (`F12` → tab Console)
