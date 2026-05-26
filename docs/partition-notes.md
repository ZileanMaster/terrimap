# Partition Engine - Design Notes

> Tai lieu ky thuat noi bo cho L1b Partition Engine.
> Cap nhat lan cuoi: 2026-05-26.

---

## Supported Algorithms

Partition Engine chi ho tro 3 thuat toan:

| Algorithm | ID | Vai tro |
|---|---|---|
| Greedy Seed Expansion | `greedy` | Tao nghiem ban dau nhanh bang cach mo rong district theo adjacency graph. |
| Local Search | `local-search` | Mac dinh khuyen nghi; cai thien nghiem Greedy bang boundary swaps co BFS guard. |
| Simulated Annealing | `sa` | Toi uu nang cao; chap nhan swap xau co xac suat de thoat local optimum. |

Tat ca API public dung union:

```ts
type AlgorithmName = 'greedy' | 'local-search' | 'sa'
```

---

## Current Tradeoff

> Fixture tham chieu: `zones20` trong `tests/fixtures/zones20-fixture.ts`, m=4.

| Metric | Greedy | Local Search | SA |
|---|---|---|---|
| Toc do | Nhanh nhat | Nhanh-vua | Cham hon |
| Chat luong | Baseline tot | Tot va on dinh | Co the tot nhat |
| Deterministic | Co | Co | Khong |
| Connectivity guard | Co | Co | Co |
| Use case | Preview nhanh / initial solution | Default production | Toi uu khi can chat luong cao |

---

## Decision Guide

```text
Yeu cau          ->  Thuat toan khuyen nghi
Preview nhanh   ->  greedy
Default an toan  ->  local-search
Toi uu sau cung  ->  sa
```

`TerritoryService.runPartition()` tra ve `suggestSA = true` khi balance score thap va algorithm hien tai khong phai `sa`. UI co the dung flag nay de goi y chay toi uu nang cao.

---

## Test Thresholds

| Thuat toan | Quality expectation |
|---|---|
| `partitionGreedy` | Moi zone duoc assign dung 1 lan, districtId hop le, khong district rong. |
| `partitionLocalSearch` | Deterministic, cai thien hoac giu nghiem Greedy, khong pha lien thong district nguon. |
| `partitionSA` | Assignment hop le, cost finite, chap nhan stochastic output. |

---

## References

- Implementation: [`lib/partition.ts`](../lib/partition.ts)
- Test suite: [`tests/partition.test.ts`](../tests/partition.test.ts)
- Benchmark script: [`tests/partition-benchmark.ts`](../tests/partition-benchmark.ts)
- Fixture: [`tests/fixtures/zones20-fixture.ts`](../tests/fixtures/zones20-fixture.ts)
