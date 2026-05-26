# Hướng Dẫn Sử Dụng TerriMap

TerriMap là phần mềm thiết kế và quản lý lãnh thổ bán hàng trên bản đồ. Phần mềm giúp doanh nghiệp chia các polygon địa lý thành các **cụm** phụ trách, gán cụm cho nhân viên sales, kiểm tra điều kiện liên thông và theo dõi chất lượng phân chia.

Tài liệu này dành cho người dùng vận hành phần mềm hằng ngày: quản trị viên, điều phối viên và nhân viên sales.

## 1. Khái Niệm Chính

### Khu vực

Khu vực là phạm vi vận hành lớn, ví dụ Hà Nội, TP. Hồ Chí Minh hoặc Huế. Mỗi khu vực có bản đồ, danh sách polygon, danh sách sales và kết quả phân chia riêng.

Bạn nên chọn khu vực trước khi vẽ polygon, kiểm tra dữ liệu hoặc chạy thuật toán.

### Polygon hoặc vùng

Polygon là một vùng địa lý được vẽ trên bản đồ. Mỗi polygon có:

- Tên vùng.
- Tọa độ ranh giới.
- Số khách hàng.
- Số đơn hàng.
- Cụm hiện tại.
- Sales phụ trách, nếu đã được gán.

Trong UI, “vùng” thường là cách gọi thân thiện của polygon.

### Cụm

Cụm là nhóm các polygon được phân cho cùng một lãnh thổ bán hàng. Trước đây hệ thống dùng thuật ngữ kỹ thuật `district`, nhưng trong giao diện người dùng gọi là **cụm**.

Ví dụ:

- `C0` là cụm 0.
- `C1` là cụm 1.
- Một sales có thể được phân phụ trách một cụm.

### Liên thông

Một cụm được coi là liên thông khi từ bất kỳ polygon nào trong cụm đều có thể đi sang các polygon còn lại trong cùng cụm thông qua chuỗi polygon kề nhau.

Nếu một cụm bị tách thành nhiều phần rời nhau, phần mềm sẽ coi đó là lỗi liên thông. Khi chuyển polygon thủ công sang cụm khác, TerriMap sẽ kiểm tra lại và chặn thao tác nếu làm cụm mất liên thông.

## 2. Khởi Động Phần Mềm

Mở terminal tại thư mục dự án:

```powershell
cd C:\Users\IT-THIEN\terrimap
npm run dev
```

Sau đó mở trình duyệt tại địa chỉ Vite hiển thị trong terminal, thường là:

```text
http://127.0.0.1:5173
```

Nếu chưa cấu hình Supabase hoặc biến môi trường, phần mềm chạy ở chế độ mock/offline để phục vụ demo và kiểm thử.

## 3. Bố Cục Giao Diện

Sau khi vào phần mềm, giao diện chính gồm:

- Thanh điều hướng bên trái.
- Thanh thông tin phía trên.
- Khu vực nội dung chính.
- Bản đồ tương tác ở các màn liên quan đến khu vực và phân chia.

Các mục điều hướng chính:

| Mục | Mục đích |
| --- | --- |
| Tổng quan | Xem trạng thái tổng thể của dữ liệu và workflow |
| Khu vực & bản đồ | Chọn khu vực, xem bản đồ, vẽ polygon, chỉnh cụm |
| Nhân sự Sales | Quản lý nhân viên sales |
| Phân chia lãnh thổ | Chạy thuật toán phân chia cụm |
| So sánh thuật toán | So sánh hai kịch bản thuật toán |
| Cài đặt | Cấu hình tài khoản và hệ thống |

## 4. Luồng Sử Dụng Khuyến Nghị

Luồng chuẩn nên đi theo thứ tự sau:

1. Chọn hoặc tạo khu vực.
2. Kiểm tra danh sách polygon trong khu vực.
3. Kiểm tra dữ liệu khách hàng, đơn hàng.
4. Kiểm tra topology polygon và liên thông địa lý.
5. Tạo hoặc kiểm tra danh sách sales.
6. Chạy thuật toán phân chia.
7. Xem kết quả trên bản đồ.
8. Chỉnh tay polygon sang cụm khác nếu cần.
9. Lưu snapshot hoặc export dữ liệu.

Không nên chạy thuật toán khi khu vực chưa có đủ polygon, chưa có sales hoặc dữ liệu polygon đang lỗi topology.

## 5. Màn Tổng Quan

Màn Tổng quan cho biết tình trạng sẵn sàng của dự án.

Bạn sẽ thấy các bước:

- Khu vực.
- Zones.
- Sales.
- Topology.
- Liên thông.

Ý nghĩa:

- Nếu tất cả bước đều xanh, khu vực đã sẵn sàng để chạy phân chia.
- Nếu có cảnh báo topology, cần kiểm tra polygon chồng lắp hoặc tự cắt.
- Nếu có cảnh báo liên thông, dữ liệu polygon có thể đang bị tách rời hoặc không đủ quan hệ kề để đảm bảo cụm liên thông.

Màn này cũng hiển thị thống kê theo khu vực:

- Số zones.
- Số sales.
- Tỷ lệ phân công.
- Trạng thái liên thông.
- Mức cân bằng tải.
- Số cụm quá tải hoặc thiếu tải.

## 6. Chọn Và Quản Lý Khu Vực

Vào mục **Khu vực & bản đồ**.

Nếu chưa mở khu vực nào, hệ thống hiển thị các thẻ khu vực. Mỗi thẻ cho biết:

- Tên khu vực.
- Số zones.
- Số sales.
- Số lỗi topology.
- Số component liên thông.
- Số zone cô lập.

Để mở khu vực:

1. Chọn thẻ khu vực mong muốn.
2. Nhấn **Mở khu vực**.
3. Hệ thống chuyển sang bản đồ của khu vực đó.

Để đổi khu vực khi đang ở bản đồ:

1. Nhấn nút **Đổi khu vực** trên bản đồ.
2. Chọn khu vực khác từ màn danh sách.

## 7. Sử Dụng Bản Đồ

Màn bản đồ gồm:

- Danh sách khu vực và danh sách vùng ở bên trái.
- Bản đồ chính ở giữa.
- Toolbar bản đồ.
- Chú giải cụm.
- Popup thông tin polygon khi chọn vùng.

### Chú giải bản đồ

Chú giải hiển thị màu của từng cụm:

- `Cụm 0`, `Cụm 1`, `Cụm 2`, ...
- Màu xám hoặc viền đứt biểu thị vùng chưa gán.
- Nếu có cụm mất liên thông, chú giải sẽ cảnh báo cụm có viền đỏ.

### Chọn polygon

Có hai cách chọn polygon:

1. Nhấp trực tiếp vào polygon trên bản đồ.
2. Nhấp vào tên vùng trong danh sách bên trái.

Khi chọn polygon, popup thông tin xuất hiện trên bản đồ.

## 8. Popup Thông Tin Polygon

Popup polygon hiển thị:

- Tên vùng.
- ID polygon.
- Badge cụm hiện tại, ví dụ `C0`.
- Số khách hàng.
- Số đơn hàng.
- Cụm hiện tại.
- Sales phụ trách.

### Sửa số khách hàng và đơn hàng

Quản trị viên có thể sửa số khách hàng và số đơn hàng ngay trong popup.

Các bước:

1. Chọn polygon.
2. Nhập số mới vào ô **Số KH** hoặc **Số đơn**.
3. Nhấn **Lưu**.

Lưu ý:

- Chỉ nhập số không âm.
- Nếu để trống một ô, giá trị đó không thay đổi.
- Sau khi lưu, dữ liệu vùng được cập nhật vào store và cơ sở dữ liệu nếu đang online.

### Chuyển polygon sang cụm khác

Đây là thao tác chỉnh tay sau khi đã có kết quả phân chia.

Các bước:

1. Chọn polygon cần chuyển.
2. Trong popup, tìm mục **Chuyển sang cụm**.
3. Chọn cụm đích trong dropdown.
4. Xem preview:
   - Cụm nguồn còn bao nhiêu vùng.
   - Cụm đích sẽ có bao nhiêu vùng.
   - Sales phụ trách sau khi chuyển.
5. Nhấn **Xác nhận gán**.

Nếu thao tác làm mất liên thông, hệ thống sẽ chặn và hiển thị lỗi ngay trong popup. Khi lỗi xuất hiện, bạn cần chọn cụm khác hoặc chỉnh lại dữ liệu polygon trước.

### Xóa polygon

Quản trị viên có thể xóa polygon:

1. Chọn polygon.
2. Nhấn **Xóa vùng**.
3. Xác nhận thao tác.

Khi xóa polygon, assignment liên quan cũng bị loại bỏ.

## 9. Vẽ Polygon Mới

Trong màn bản đồ của khu vực, quản trị viên có thể vẽ polygon mới.

Các bước:

1. Mở khu vực cần thêm polygon.
2. Chọn công cụ vẽ polygon trên bản đồ.
3. Nhấp các điểm trên bản đồ để tạo ranh giới.
4. Hoàn tất polygon.
5. Nhập tên vùng.
6. Hệ thống thêm vùng mới vào khu vực hiện tại.

Điều kiện quan trọng:

- Polygon mới không được chồng lắp polygon đã có.
- Polygon không nên tự cắt.
- Nếu polygon chồng lắp, hệ thống sẽ từ chối và yêu cầu vẽ lại.

## 10. Quản Lý Sales

Vào mục **Nhân sự Sales** để quản lý đội ngũ bán hàng.

Bạn có thể:

- Thêm nhân viên sales.
- Sửa thông tin sales.
- Gán sales vào khu vực.
- Cấu hình capacity.
- Xóa sales không còn sử dụng.

Sales dùng để:

- Gán phụ trách cụm.
- Tính tải công việc.
- Hiển thị thống kê đội ngũ.
- Xuất báo cáo phân công.

## 11. Phân Công Sales Theo Cụm

Trong sidebar hoặc phần phân công, mỗi cụm có thể được gán một nhân viên sales.

Thông tin thường hiển thị:

- Cụm.
- Số vùng trong cụm.
- Tổng khách hàng.
- Sales đang phụ trách.

Để đổi sales phụ trách:

1. Tìm cụm cần đổi.
2. Chọn sales mới trong dropdown.
3. Hệ thống lưu lại assignment mới.

## 12. Chạy Thuật Toán Phân Chia

Vào mục **Phân chia lãnh thổ**.

Trước khi chạy, hãy kiểm tra:

- Đã chọn khu vực.
- Khu vực có ít nhất 2 polygon.
- Có đủ sales.
- Không có lỗi topology.
- Graph zone trong khu vực liên thông.

### Chọn thuật toán

TerriMap hiện hỗ trợ:

| Thuật toán | Mục đích | Đặc điểm |
| --- | --- | --- |
| Greedy Seed Expansion | Tạo kết quả nhanh | Mở rộng cụm từ các seed, ưu tiên tốc độ |
| Local Search Refinement | Cải thiện kết quả greedy | Thử chuyển vùng biên để tăng cân bằng, vẫn kiểm tra liên thông |
| Simulated Annealing | Tối ưu sâu hơn | Chạy lâu hơn, chấp nhận tìm kiếm rộng hơn để cải thiện cân bằng |

K-Means đã bị loại bỏ khỏi dự án vì không phù hợp với điều kiện liên thông polygon.

### Chọn số cụm

Nhập hoặc điều chỉnh **Số cụm**.

Số cụm nên phù hợp với:

- Số sales.
- Quy mô khu vực.
- Số lượng polygon.
- Mục tiêu vận hành thực tế.

Ví dụ nếu khu vực có 20 sales chính, bạn thường bắt đầu với 20 cụm.

### Chạy phân chia

1. Chọn thuật toán.
2. Chọn số cụm.
3. Nhấn **Chạy phân chia**.
4. Chờ kết quả.
5. Xem màu cụm trên bản đồ và các chỉ số đánh giá.

Nếu thuật toán từ chối chạy vì graph không liên thông, cần sửa dữ liệu polygon hoặc tách khu vực vận hành cho phù hợp.

## 13. So Sánh Thuật Toán

Vào mục **So sánh thuật toán**.

Mục này cho phép chạy hai kịch bản song song:

- Kịch bản A.
- Kịch bản B.

Mỗi kịch bản có thể chọn:

- Thuật toán.
- Số cụm.

Sau khi chạy, bạn so sánh:

- Điểm cân bằng.
- Số vi phạm.
- Thời gian chạy.
- Bản đồ kết quả.

Khi hài lòng với một kịch bản, bạn có thể áp dụng kết quả đó cho dữ liệu hiện tại.

## 14. Kiểm Tra Liên Thông

TerriMap ưu tiên điều kiện liên thông. Điều này ảnh hưởng cả thuật toán tự động và chỉnh tay.

### Khi nào bị lỗi liên thông?

Lỗi xảy ra khi một cụm có nhiều polygon nhưng các polygon đó không nối được với nhau qua quan hệ kề.

Ví dụ:

- Cụm C0 có 10 polygon.
- 6 polygon nằm ở phía tây.
- 4 polygon nằm rời ở phía đông.
- Không có chuỗi polygon kề nhau nối hai nhóm này.

Khi đó C0 bị coi là mất liên thông.

### Hệ thống xử lý thế nào?

- Thuật toán sẽ cố tạo các cụm liên thông.
- Nếu dữ liệu đầu vào không thể đảm bảo liên thông, thuật toán có thể từ chối chạy.
- Khi chuyển polygon thủ công, hệ thống kiểm tra lại và chặn thao tác nếu làm cụm mất liên thông.

### Người dùng cần làm gì?

Nếu gặp lỗi liên thông:

1. Kiểm tra polygon cô lập.
2. Kiểm tra khoảng cách giữa các polygon.
3. Kiểm tra polygon có bị vẽ sai hoặc thiếu vùng trung gian không.
4. Nếu khu vực thực sự bị tách rời, cân nhắc tách thành nhiều khu vực vận hành khác nhau.

## 15. Kiểm Tra Topology Polygon

Topology là tính hợp lệ hình học của polygon.

TerriMap kiểm tra các lỗi quan trọng:

- Polygon chồng lắp nhau.
- Polygon tự cắt.
- Polygon trùng nhau.
- Import dữ liệu có hình học không hợp lệ.

Nếu dữ liệu topology lỗi, thuật toán không nên chạy vì kết quả phân chia có thể sai hoặc không có ý nghĩa.

## 16. Snapshot Và Lịch Sử

Snapshot là bản lưu trạng thái phân chia tại một thời điểm.

Snapshot thường gồm:

- Danh sách zones.
- Assignments.
- Thời điểm tạo.
- Nhãn snapshot.

Khi nào nên tạo snapshot:

- Trước khi chạy thuật toán mới.
- Sau khi có kết quả phân chia tốt.
- Trước khi chỉnh tay nhiều polygon.
- Trước khi export báo cáo.

Snapshot giúp bạn so sánh hoặc quay lại kết quả cũ nếu cần.

## 17. So Sánh Snapshot

Màn so sánh snapshot cho biết:

- Số vùng ở mỗi snapshot.
- Số cụm ở mỗi snapshot.
- Các vùng đã thay đổi cụm.
- Cụm trước và cụm sau.

Thông tin này hữu ích khi bạn muốn biết thuật toán hoặc chỉnh tay đã thay đổi những vùng nào.

## 18. Export Dữ Liệu

TerriMap hỗ trợ export phục vụ báo cáo và tích hợp.

Các dạng export thường có:

- CSV assignments.
- CSV danh sách zones.
- CSV ma trận kề.
- GeoJSON.
- Báo cáo PDF hoặc trang in.

### CSV assignments

Phù hợp để đưa vào Excel hoặc hệ thống CRM.

Thông tin thường gồm:

- Zone ID.
- Tên vùng.
- Cụm.
- Sales phụ trách.
- Khách hàng.
- Đơn hàng.

### GeoJSON

Phù hợp để dùng với:

- QGIS.
- Mapbox.
- Các hệ thống GIS.
- Công cụ phân tích bản đồ khác.

## 19. Vai Trò Người Dùng

### Quản trị viên

Quản trị viên có quyền đầy đủ:

- Chọn và quản lý khu vực.
- Vẽ polygon.
- Sửa số khách hàng, số đơn hàng.
- Xóa polygon.
- Chạy thuật toán.
- Chỉnh polygon sang cụm khác.
- Quản lý sales.
- Tạo snapshot.
- Export dữ liệu.

### Điều phối viên

Điều phối viên tập trung vào vận hành:

- Xem khu vực được phân quyền.
- Xem danh sách vùng.
- Nhập hoặc kiểm tra chỉ số theo tháng.
- Chỉnh polygon sang cụm khác nếu được phép.
- Theo dõi đội sales.

### Sales

Sales chủ yếu xem thông tin:

- Cụm của mình.
- Các vùng được giao.
- Tổng khách hàng.
- Tổng đơn hàng.

Sales không chạy thuật toán và không quản lý dữ liệu hệ thống.

## 20. Các Lỗi Thường Gặp

### Không chạy được thuật toán

Nguyên nhân có thể:

- Chưa chọn khu vực.
- Khu vực có ít hơn 2 polygon.
- Số cụm không hợp lệ.
- Graph zone không liên thông.
- Có lỗi topology.

Cách xử lý:

1. Vào Tổng quan để xem bước nào chưa đạt.
2. Kiểm tra khu vực đang chọn.
3. Kiểm tra danh sách polygon.
4. Kiểm tra polygon cô lập hoặc topology lỗi.
5. Chạy lại sau khi sửa dữ liệu.

### Không chuyển được polygon sang cụm khác

Nguyên nhân phổ biến:

- Chuyển polygon làm cụm nguồn bị tách rời.
- Chuyển polygon làm cụm đích hoặc toàn bộ kết quả có lỗi liên thông.
- Polygon đang là vùng duy nhất giữ vai trò nối các phần của cụm.

Cách xử lý:

1. Chọn cụm đích khác.
2. Chuyển một polygon liền kề trước.
3. Chạy lại thuật toán để tạo kết quả nền tốt hơn.
4. Kiểm tra dữ liệu polygon nếu cụm bị tách bất thường.

### Polygon mới không được thêm

Nguyên nhân có thể:

- Polygon chồng lắp polygon hiện có.
- Polygon tự cắt.
- Polygon không đủ điểm.

Cách xử lý:

- Vẽ lại polygon gọn hơn.
- Tránh cắt qua vùng đã có.
- Kiểm tra ranh giới trước khi hoàn tất.

### Bản đồ không hiện dữ liệu

Nguyên nhân có thể:

- Chưa chọn khu vực.
- Khu vực chưa có zones.
- Dữ liệu đang tải.
- Supabase chưa cấu hình và mock data không có khu vực tương ứng.

Cách xử lý:

1. Vào Khu vực & bản đồ.
2. Chọn khu vực có zones.
3. Kiểm tra trạng thái dữ liệu mock/offline hoặc online.
4. Reload trang nếu cần.

## 21. Khuyến Nghị Vận Hành

Để kết quả phân chia tốt và ổn định:

- Luôn kiểm tra topology trước khi chạy thuật toán.
- Không import polygon chồng lắp.
- Không cố gộp các vùng địa lý quá xa vào cùng một khu vực.
- Chọn số cụm phù hợp với số sales.
- Sau mỗi lần chỉnh tay nhiều polygon, nên tạo snapshot.
- Khi cần kết quả nhanh, dùng Greedy.
- Khi cần kết quả cân bằng hơn, dùng Local Search.
- Khi cần tối ưu sâu và chấp nhận chạy lâu hơn, dùng Simulated Annealing.

## 22. Checklist Trước Khi Chốt Kết Quả

Trước khi export hoặc đưa kết quả vào vận hành, kiểm tra:

- Đã chọn đúng khu vực.
- Không còn lỗi topology.
- Không có vùng cô lập bất thường.
- Không có cụm mất liên thông.
- Số cụm phù hợp với số sales.
- Tải khách hàng và đơn hàng giữa các cụm chấp nhận được.
- Sales phụ trách đã đúng.
- Đã tạo snapshot lưu trạng thái.
- Đã export file cần thiết.

## 23. Ghi Chú Kỹ Thuật Cho Người Quản Trị

Trong code và database, thuật ngữ kỹ thuật vẫn có thể là `districtId` để giữ ổn định schema, API và test. Trong giao diện người dùng, thuật ngữ hiển thị là **cụm**.

Không nên đổi tên field kỹ thuật nếu không có kế hoạch migration đầy đủ, vì có thể ảnh hưởng:

- Dữ liệu database.
- Export CSV.
- Test suite.
- Thuật toán phân chia.
- Các service và facade.
