# Known Risks & Technical Debt

> Cập nhật theo trạng thái hiện tại của TerriMap.
> Mục tiêu: ghi lại các rủi ro còn lại để không nhầm với lỗi đã xử lý.

---

## Đã xử lý gần đây

- Giao diện hiện đã cố định tiếng Việt.
- Đã bỏ nút đổi ngôn ngữ.
- Đã xử lý lỗi chunk lazy-load bằng cơ chế tự reload một lần.
- Đã tối ưu tạo dự án mới theo hướng optimistic.
- Đã tối ưu lưu map / lưu báo cáo theo hướng local-first.
- SA được chạy qua worker ở màn so sánh để giảm cảm giác đơ UI.

---

## Open risks hiện tại

| ID | Mức độ | Mô tả |
| --- | --- | --- |
| RISK-01 | Medium | Một số thao tác Supabase vẫn phụ thuộc mạng, nếu mạng chậm thì vẫn cần hiển thị trạng thái chờ rõ ràng. |
| RISK-02 | Medium | SA vẫn là thuật toán nặng; dù đã qua worker ở màn comparator, cấu hình lớn vẫn có thể mất nhiều thời gian chạy. |
| RISK-03 | Low | Một số tên kỹ thuật nội bộ vẫn còn dùng `district`/`polygon` để giữ ổn định schema và test. |
| RISK-04 | Low | Do dữ liệu demo/test liên tục thay đổi, tài liệu hướng dẫn có thể lệch nhẹ nếu không cập nhật sau mỗi đợt release. |

---

## Ghi chú kỹ thuật

- UI nên tiếp tục ưu tiên `local-first` cho các thao tác save.
- Các màn có thể chạy tác vụ dài cần overlay/trạng thái rõ ràng.
- Nếu sửa partition engine, không nên thay đổi logic cốt lõi khi chưa có lý do rõ ràng.
- Nếu đổi route hoặc nav label, cần cập nhật đồng thời:
  - `DashboardLayout`
  - `App.tsx`
  - `USER_GUIDE.vi.md`
  - `QA_WORKFLOW_TEST.vi.md`

