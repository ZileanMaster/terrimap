/**
 * Benchmark so sánh 3 thuật toán phân vùng.
 *
 * Chạy: npx tsx tests/partition-benchmark.ts
 */
import {
  partitionGreedy,
  partitionLocalSearch,
  partitionSA,
} from '../lib/partition.js';
import { zoneDiameter } from '../lib/geometry.js';
import { zones20 } from './fixtures/zones20-fixture.js';

const M = 4;
const RUNS = 10;

function getCustomerCounts(result: { zoneId: string; districtId: number }[], m: number): number[] {
  const zoneCustomers = new Map<string, number>();
  for (const z of zones20) {
    const c = z.activities?.find((a: { type: string }) => a.type === 'CUSTOMER');
    zoneCustomers.set(z.id, (c as { value: number } | undefined)?.value ?? 0);
  }
  const counts = new Array<number>(m).fill(0);
  for (const { zoneId, districtId } of result) {
    counts[districtId] = (counts[districtId] ?? 0) + (zoneCustomers.get(zoneId) ?? 0);
  }
  return counts;
}

function benchAlgo(
  name: string,
  fn: () => { zoneId: string; districtId: number }[],
  runs = RUNS,
): void {
  const times: number[] = [];
  const diameters: number[] = [];
  const balances: number[] = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const result = fn();
    times.push(performance.now() - start);

    // Max diameter across districts
    let maxD = 0;
    for (let d = 0; d < M; d++) {
      const dzones = zones20.filter((_, j) => result[j]?.districtId === d);
      maxD = Math.max(maxD, zoneDiameter(dzones));
    }
    diameters.push(maxD);

    // Customer balance: stdDev/(mean+1)
    const counts = getCustomerCounts(result, M);
    const mean = counts.reduce((s, c) => s + c, 0) / M;
    const stdDev = Math.sqrt(counts.reduce((s, c) => s + (c - mean) ** 2, 0) / M);
    balances.push(stdDev / (mean + 1));
  }

  const avg = (arr: number[]): number => arr.reduce((s, v) => s + v, 0) / arr.length;
  const pad = (s: string, n: number): string => s.padEnd(n);

  console.log(
    `${pad(name, 10)} | ` +
    `avg_balance=${avg(balances).toFixed(3)} | ` +
    `avg_diameter=${avg(diameters).toFixed(1)}km | ` +
    `avg_time=${avg(times).toFixed(1)}ms`,
  );
}

console.log('\n🔬 Partition Algorithm Benchmark');
console.log(`   zones=${zones20.length}, m=${M}, runs=${RUNS}\n`);
console.log(''.repeat(65));

benchAlgo('greedy', () => partitionGreedy(zones20, M));
benchAlgo('hill-climbing', () => partitionLocalSearch(zones20, M));
benchAlgo('sa', () => partitionSA(zones20, M, { maxIter: 200 }));

console.log(''.repeat(65));
console.log('\n📊 Columns:');
console.log('   avg_balance  = stdDev/(mean+1), lower is better (threshold < 0.3)');
console.log('   avg_diameter = max district diameter in km, lower is better');
console.log('   avg_time     = wall clock ms per call\n');

