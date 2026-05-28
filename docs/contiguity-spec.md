# TerriMap Contiguity Spec (Liên Thông)

Mục tiêu của “liên thông” trong TerriMap là đảm bảo mỗi **cụm (district/cluster)** là một miền kết nối trên bản đồ, tránh trường hợp 1 cụm bị tách thành nhiều đảo rời rạc.

## 1) Định nghĩa kề nhau (Adjacency)

TerriMap xây dựng đồ thị kề nhau giữa các zone theo 2 lớp:

1. **Kề theo cạnh (primary)**: 2 polygon được xem là kề nếu **chia sẻ 1 đoạn biên có độ dài > 0** (shared edge).  
   - Chạm **một điểm** (shared vertex) *không* được xem là kề.

2. **Kề theo “khoảng hở nhỏ” (secondary / gap-bridging)**: nếu 2 polygon không kề theo cạnh, nhưng khoảng cách nhỏ nhất giữa **biên với biên** (segment-to-segment) nằm trong ngưỡng `NEAR_BOUNDARY_KM`, thì xem là kề.  
   - Mục đích: bù cho dữ liệu vẽ có sai số (gaps nhỏ do đường, rãnh, sai số số hoá), nhưng không nối nhầm các vùng xa.
   - Mặc định: `NEAR_BOUNDARY_KM = 0.12km` (~120m).
   - `buildAdjacencyMatrix(zones, thresholdKm)` hiện dùng `thresholdKm` để override `NEAR_BOUNDARY_KM`.

## 2) Quy tắc liên thông của một cụm

Một cụm `Ck` được xem là liên thông khi đồ thị con tạo bởi các zone có `districtId = k` là **connected graph** (chỉ có 1 connected component).

Nếu có nhiều hơn 1 component, TerriMap đánh dấu:
- “Cụm bị tách rời” (contiguity violation)

## 3) Lưu ý quan trọng

- Hệ thống **không** coi “chung 1 điểm” là liên thông (để tránh “liên thông giả” dạng chạm góc).
- “Gap-bridging” là cơ chế thực dụng cho dữ liệu thực tế; nếu bạn muốn strict hơn, giảm `thresholdKm`.

## 4) File/Function liên quan

- `lib/geometry.ts`:
  - `buildAdjacencyMatrix(...)`
  - `getMinBoundaryDistKm(...)`
- Tests:
  - `tests/geometry.test.ts` có ca kiểm cho shared-edge, corner-only, và near-boundary.

