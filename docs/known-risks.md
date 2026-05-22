# Known Risks & Technical Debt

> Last updated: 2026-04-05
> Baseline: **359/359 unit tests + 22/22 E2E tests pass** (14 unit files + 5 E2E specs)
> Scope: L0 (types) → L1 (geometry/partition/validator) → L2 (services) → L3 (facades) → L4 (UI shell)

---

## Fixed (Audit 2026-03-30/31 + L4b 2026-04-05)

Ghi lại để audit trail — không cần xử lý thêm.

| ID     | Description                                         | Fixed by                              | Date       |
|--------|-----------------------------------------------------|---------------------------------------|------------|
| KR-F01 | `getTeamOverview` modulo mapping (`districtId % n`) | Replaced with `salesAgentId` lookup   | 2026-03-30 |
| KR-F02 | `GeoJSONPolygon` union type không narrowable        | Refactored to discriminated union     | 2026-03-31 |
| KR-F03 | `l1-l0-integration.test.ts` — 3 test bugs          | Fixed fixture typing + fuzz guard     | 2026-03-30 |
| KR-F04 | `CoordinatorFacade`/`SalesFacade` coverage gaps     | 6 tests added (SAL-*, COORD-*)        | 2026-03-31 |
| KR-F05 | `services/errors.ts` branch gap 66.66%              | 2 tests added (ERR-1, ERR-2)          | 2026-03-31 |
| KR-F06 | `TODO(L4-ViewModel)` — PartitionResult expose L1 types | `AlgorithmResultVM` + `ViolationVM` wrap; L4 imports via `viewmodels.ts` | 2026-04-05 |

---

## Open

| ID      | Severity | Affects L4 | Fix before L4 | Description                                           |
|---------|----------|------------|---------------|-------------------------------------------------------|
| OPEN-2  | Low      | No         | No            | Zod `exactOptionalPropertyTypes` tsc errors           |
| OPEN-3  | Medium   | Yes        | No            | ActivityService & MapService Func coverage 0%         |
| OPEN-4  | Medium   | Yes        | Optional      | SalesFacade `_districtId = findIndex()` fragility     |
| OPEN-5  | Low      | No         | No            | Golden regression files chưa được generate           |

---

## Chi tiết OPEN items

### OPEN-2 — Zod `exactOptionalPropertyTypes` tsc errors

- **Files**: `tests/partition.test.ts` (lines 160–800), `tests/l1-l0-integration.test.ts`
- **Vấn đề**: `domain.schema.ts` Zod inference dùng tuple `[number, number][]` và
  `Coordinate | undefined` không khớp với `exactOptionalPropertyTypes: true` trong `tsconfig.json`.
  `tsc --noEmit` báo ~30 errors nhưng **runtime không bị ảnh hưởng** — vitest chạy 963/963 pass.
- **Root cause**: Zod v3/v4 không tự động tôn trọng `exactOptionalPropertyTypes`;
  cần wrap bằng `z.optional()` explicit thay vì `.optional()` chaining.
- **Affects L4**: Không — lỗi chỉ ở test fixtures, không ở source code hay runtime.
- **Fix nếu muốn**: Refactor `domain.schema.ts` dùng `z.object({ location: z.optional(...) })`
  hoặc thêm `// @ts-expect-error` cho test fixtures.

---

### OPEN-3 — ActivityService & MapService Func coverage 0%

- **Files**: `services/ActivityService.ts`, `services/MapService.ts`
- **Vấn đề**: Hai services này có Func coverage 0% trong report vì L3 tests
  mock toàn bộ `../services` module. Smoke tests (`tests/l2-smoke.test.ts`) đã
  confirm không có runtime bug — **đây là expected gap do mock strategy**.
- **Affects L4**: Yes — L4 sẽ là consumer đầu tiên wire entry points thực sự.
- **Action for L4**: Khi L4 gọi `ActivityService.getDistrictSummary()` và
  `MapService` methods thực, coverage sẽ tự động tăng. Không cần unit test thêm
  ở L2 trước khi build L4.

---

### OPEN-4 — SalesFacade `_districtId = findIndex()` fragility

- **File**: `facades/SalesFacade.ts:34`
- **Code**: `const idx = salesAgents.findIndex((sa) => sa.id === salesId)`
- **Vấn đề**: `_districtId` = vị trí index của `salesId` trong `salesAgents` array.
  Nếu array bị reorder giữa hai lần tạo `SalesFacade` (ví dụ: sort A-Z ở một component,
  sort by region ở component khác), cùng một `salesId` sẽ trả về `_districtId` khác nhau
  → wrong district được hiển thị.
- **Test documenting this**: `[ISO-6] _districtId = findIndex risk` trong `tests/l3-facades.test.ts`
- **Workaround hiện tại**: App.tsx phải luôn pass `salesAgents` theo thứ tự canonical
  (theo `SalesAgent.id` alphabetical hoặc theo insertion order từ API).
  **Không được sort `salesAgents` array trước khi pass vào `SalesFacade`.**
- **Fix dứt điểm (nếu cần)**: Thêm `districtId: number` field vào `SalesAgent` type
  (L0), rồi dùng `sa.districtId` thay vì `findIndex`. Đây là breaking change nhỏ.
- **Severity**: Medium — Silent wrong data nếu vi phạm workaround, không crash.

---

### OPEN-5 — Golden regression files chưa được generate

- **File**: `tests/fixtures/golden/` (chưa tồn tại)
- **Vấn đề**: `tests/partition.test.ts` có `[REG-1]` và `[REG-2]` regression tests
  kiểm tra Greedy và KMeans output không đổi so với golden file.
  Hiện tại các tests này **skip** với warning `⚠️ Golden file not found`.
- **Impact**: Regression tests không hoạt động → nếu L1 partition algorithm vô tình
  thay đổi output, không có safety net.
- **Fix**: Chạy `npx tsx tests/fixtures/generate-golden.ts` một lần để generate golden files.
  Sau đó commit `tests/fixtures/golden/` vào source control.
- **Affects L4**: Không — chỉ ảnh hưởng L1b regression safety.

---

## Bước 5 — Kết luận

### Câu 1: Có OPEN item nào Critical/High + Fix before L4 = Yes không?

**Không.** Tất cả OPEN items đều là Low hoặc Medium severity, và không item nào
require fix trước khi build L4.

> ✅ **PROCEED to L4**

---

### Câu 2: L4 Developer Briefing

**5 điều L4 developer cần biết:**

- **`SalesFacade` phải nhận `salesAgents` đúng thứ tự**: Đừng sort array `salesAgents`
  trước khi khởi tạo `SalesFacade`. Thứ tự array quyết định `_districtId` — xem `OPEN-4`.
  Nếu cần sort để hiển thị UI, sort bản copy (`[...salesAgents].sort(...)`) nhưng pass
  bản gốc vào `SalesFacade`.

- **`AdminFacade.runAlgorithm()` trả `AlgorithmResultVM`** (đã fix OPEN-1): Flat fields
  `balanceScore`, `maxDiameter`, `violationCount`, `suggestSA` + `assignments[]` (có
  `salesAgentId`). L4 map renderer dùng `assignments[]` để tô màu zones theo `districtId`.
  `ResultMetrics.tsx` dùng flat fields — không cần access `PartitionMetrics` từ L1c.

- **KMeans balance thường > 0.4**: Khi user chọn KMeans, UI nên hiển thị warning
  nếu `metrics.balanceScore < 60`. Suggest chuyển sang SA nếu balance quan trọng.
  Threshold đã được benchmark — xem `docs/partition-notes.md`.

- **`ActivityService` và `MapService` chưa có UI consumer**: Hai services này được
  smoke-tested nhưng chưa có integration test thực sự. Khi L4 wire, viết ít nhất
  1 integration test per service endpoint mới được gọi để catch runtime bugs sớm.

- **`tsc --noEmit` sẽ báo ~30 errors từ Zod schema**: Đây là pre-existing, không phải
  do L4 code. IDE sẽ hiển thị red squiggles trong test files — ignore hoặc xem `OPEN-2`
  để fix dứt điểm nếu IDE noise gây phiền.
