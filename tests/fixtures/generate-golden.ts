/**
 * Generate golden output file cho regression tests.
 *
 * Chạy một lần:
 *   npx tsx tests/fixtures/generate-golden.ts
 *
 * Output: tests/fixtures/partition-golden.json
 */
import { partitionGreedy, partitionLocalSearch } from '../../lib/partition.js';
import { zones20 } from './zones20-fixture.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const golden = {
  greedy: {
    assignments: partitionGreedy(zones20, 4),
    timestamp: new Date().toISOString(),
    zonesCount: zones20.length,
    m: 4,
  },
  'local-search': {
    assignments: partitionLocalSearch(zones20, 4),
    timestamp: new Date().toISOString(),
    zonesCount: zones20.length,
    m: 4,
  },
};

const outPath = join(__dirname, 'partition-golden.json');
writeFileSync(outPath, JSON.stringify(golden, null, 2), 'utf8');
console.log(`✅ Golden file written to: ${outPath}`);
console.log(`   greedy: ${golden.greedy.assignments.length} assignments`);
console.log(`   local-search: ${golden['local-search'].assignments.length} assignments`);
