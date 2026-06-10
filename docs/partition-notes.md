# Ghi Chú Partition Engine

> Tài liệu kỹ thuật nội bộ cho phần phân chia lãnh thổ.
> Cập nhật theo trạng thái hiện tại của dự án.

---

## Thuật toán đang hỗ trợ

TerriMap hiện hỗ trợ 3 thuật toán:

| Thuật toán | ID | Vai trò |
| --- | --- | --- |
| Greedy Seed Expansion | `greedy` | Tạo nghiệm ban đầu nhanh bằng cách mở rộng theo kề nhau |
| Local Search | `local-search` | Tối ưu cục bộ, ưu tiên cải thiện chất lượng phân chia |
| Simulated Annealing | `sa` | Tối ưu sâu hơn, ưu tiên nghiệm tốt hơn thay vì chỉ nhanh |

```ts
type AlgorithmName = 'greedy' | 'local-search' | 'sa'
```

---

## Định hướng hiện tại

Mục tiêu hiện nay của engine là:

1. **Giữ cụm hợp lệ và liên thông**
2. **Ưu tiên cân bằng chất lượng** giữa khách hàng và đơn hàng
3. **Tránh để UI bị đơ** khi chạy thuật toán nặng
4. **Chỉ chạy khi người dùng bấm nút**

Nói ngắn gọn: **không auto-run**, không tự chạy khi đổi cấu hình, và không ưu tiên tốc độ đến mức hy sinh chất lượng.

---

## Trade-off hiện tại

| Metric | Greedy | Local Search | SA |
| --- | --- | --- | --- |
| Tốc độ | Nhanh nhất | Trung bình | Chậm hơn |
| Chất lượng | Tốt cho khởi tạo | Tốt và ổn định | Có thể tốt nhất |
| Deterministic | Có | Có | Không |
| Connectivity guard | Có | Có | Có |
| UI impact | Nhẹ | Nhẹ-vừa | Cần overlay / worker |

---

## Cách đọc cost và chất lượng

Hiện engine ưu tiên:

- cân bằng khách hàng
- cân bằng đơn hàng
- độ gọn của cụm
- số vi phạm bằng 0

Nếu cần lựa chọn cho demo hoặc mặc định vận hành:

- `greedy` -> xem nhanh
- `local-search` -> mặc định an toàn
- `sa` -> khi muốn tìm phương án chất lượng cao hơn

---

## Chất lượng thay vì tự động

Hiện tại:

- `Thuật toán phân chia` chỉ chạy khi bấm nút
- thay đổi thuật toán / số cụm sẽ không tự sinh lại kết quả ngay
- SA được chạy qua worker ở màn so sánh để tránh chặn main thread
- overlay “Thuật toán đang chạy” được hiển thị để người dùng biết hệ thống vẫn đang xử lý

Điều này giúp UI có cảm giác tốt hơn mà không đổi lõi thuật toán.

---

## Connectivity guard

Mỗi move phải kiểm tra liên thông theo adjacency graph.

Nếu một move làm cụm nguồn mất liên thông, move đó phải bị reject.

Áp dụng cho:

- local search
- simulated annealing
- chỉnh tay trong phần phân chia lãnh thổ

---

## Quy ước kiểm thử

| Hàm | Kỳ vọng |
| --- | --- |
| `partitionGreedy` | Mỗi vùng được gán đúng một lần, không có cụm rỗng |
| `partitionLocalSearch` | Không phá liên thông, cost tốt hơn hoặc bằng greedy |
| `partitionSimulatedAnnealing` | Kết quả hợp lệ, cost finite, chất lượng có thể tốt hơn greedy/local search |

---

## File tham chiếu

- `lib/partition.ts`
- `src/hooks/useSAWorker.ts`
- `src/components/algorithm/AlgorithmComparator.tsx`
- `src/pages/AdminPage.tsx`
- `src/components/algorithm/ResultMetrics.tsx`
- `tests/partition.test.ts`

