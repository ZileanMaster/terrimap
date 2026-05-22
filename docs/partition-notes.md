# Partition Engine — Design Notes

> Tài liệu kỹ thuật nội bộ cho L1b Partition Engine.
> Cập nhật lần cuối: 2026-03-30.

---

## KMeans balance characteristic

`partitionKMeans` là **purely spatial algorithm**.  
Nó cluster zones theo khoảng cách địa lý (centroid Euclidean/Haversine),
**không** tối ưu customer workload hay doanh thu.

**Balance ratio thực tế** (đo từ benchmark: zones=20, m=4, runs=10):

| Metric | Giá trị thực tế |
|---|---|
| `stdDev / (mean + 1)` | **~0.35 – 0.45** với random workload |
| Ngưỡng "acceptable" | `< 0.3` (không đạt được với KMeans thuần) |
| Ngưỡng test KMeans | `< 0.5` (nới rộng hợp lý) |

### Hệ quả cho L2 `TerritoryService`

1. **UI Warning**: Khi user chọn KMeans và `balance > 0.4`, UI phải hiển thị
   warning badge — ví dụ:
   > ⚠️ Phân vùng chưa cân bằng workload. Cân nhắc dùng SA để tối ưu.

2. **Auto-improve**: Coordinator nên chạy SA sau KMeans nếu
   `balance > threshold` và user ưu tiên cân bằng hơn tốc độ:
   ```
   if (result.balance > 0.4 && opts.prioritize === 'balance') {
     result = partitionSA(zones, m, { maxIter: 200 })
   }
   ```

3. **Return balance metric**: `runPartition()` ở L2 **bắt buộc** trả về
   `balance` trong `PartitionResult` để L3/L4 có thể quyết định
   có cần suggest rebalance hay không:
   ```ts
   interface PartitionResult {
     assignments: Assignment[]
     balance: number      // stdDev / (mean + 1), range [0, ∞)
     diameter: number     // max district diameter km
     algorithm: 'greedy' | 'kmeans' | 'sa'
     durationMs: number
   }
   ```

---

## SA vs KMeans tradeoff

> Dữ liệu thực tế từ `tests/partition-benchmark.ts`.
> Fixture: `zones20` (lưới 4×5, Hà Nội bounds), m=4, runs=10.

| Metric | Greedy | KMeans | SA |
|---|---|---|---|
| `avg_balance` _(stdDev/mean+1, thấp hơn = tốt hơn)_ | **0.094** | 0.347 | **0.050** |
| `avg_diameter` _(km, thấp hơn = compact hơn)_ | 49.1 km | **24.5 km** | 48.6 km |
| `avg_time` _(ms/call)_ | **0.3 ms** | **0.1 ms** | 1.9 ms |

### Nhận xét

| | Greedy | KMeans | SA |
|---|---|---|---|
| **Ưu điểm** | Nhanh, balance tốt | Nhanh nhất, diameter nhỏ nhất (compact) | Balance tốt nhất |
| **Nhược điểm** | Diameter lớn | Balance kém (purely spatial) | Chậm nhất (stochastic) |
| **Dùng khi** | Default nhanh | Cần compact, sau đó post-process SA | Balance quan trọng hơn tốc độ |

### Decision guide cho L2/L3

```
Yêu cầu        →  Thuật toán khuyến nghị
─────────────────────────────────────────
Speed first    →  KMeans (0.1ms)
Balance first  →  SA     (balance=0.05)
Balanced/Safe  →  Greedy (balance=0.09, 0.3ms)
Production     →  KMeans → check balance → nếu > 0.4 thì chạy SA
```

---

## Test thresholds tương ứng

| Thuật toán | `QUALITY-1` threshold | Lý do |
|---|---|---|
| `partitionGreedy` | `stdDev/(mean+1) < 0.3` | Customer-aware greedy |
| `partitionKMeans` | `stdDev/(mean+1) < 0.5` | Purely spatial, nới rộng hợp lý |
| `partitionSA` | `stdDev/(mean+1) < 0.3` | Imbalance trong objective function |

---

## Tham khảo

- Implementation: [`lib/partition.ts`](../lib/partition.ts)
- Test suite: [`tests/partition.test.ts`](../tests/partition.test.ts)
- Benchmark script: [`tests/partition-benchmark.ts`](../tests/partition-benchmark.ts)
- Fixture: [`tests/fixtures/zones20-fixture.ts`](../tests/fixtures/zones20-fixture.ts)
