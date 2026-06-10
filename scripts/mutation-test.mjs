/**
 * Manual Mutation Testing Script - lib/geometry.ts
 *
 * Chạy từng mutant manually bằng cách sử dụng AST-level analysis.
 * Script này đọc geometry.ts, tạo ra các mutant cần thiết,
 * chạy test với từng mutant, và báo cáo kết quả.
 *
 * Usage: node scripts/mutation-test.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const GEOMETRY_PATH = resolve('lib/geometry.ts');
const ORIGINAL = readFileSync(GEOMETRY_PATH, 'utf-8');

let killed = 0;
let survived = 0;
let errors = 0;

const survivedMutants = [];
const killedMutants = [];

/**
 * Áp dụng 1 mutant, chạy test, khôi phục file
 */
function testMutant(description, lineNum, originalCode, mutatedCode) {
  const mutated = ORIGINAL.replace(originalCode, mutatedCode);
  if (mutated === ORIGINAL) {
    console.log(`  ⚠️  SKIP [${description}] - không tìm thấy string để mutate`);
    return;
  }

  writeFileSync(GEOMETRY_PATH, mutated, 'utf-8');

  try {
    execSync('npx vitest run tests/geometry.test.ts --reporter=verbose 2>&1', {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 30000,
    });
    // Tests PASS = mutant SURVIVED (tests không bắt được mutation)
    survived++;
    survivedMutants.push({ description, lineNum, originalCode, mutatedCode });
    console.log(`  ❌ SURVIVED [Line ${lineNum}]: ${originalCode} -> ${mutatedCode}`);
  } catch {
    // Tests FAIL = mutant KILLED (tests phát hiện được mutation)
    killed++;
    killedMutants.push({ description, lineNum, originalCode, mutatedCode });
    console.log(`  ✅ KILLED   [Line ${lineNum}]: ${originalCode} -> ${mutatedCode}`);
  } finally {
    // Luôn khôi phục file gốc
    writeFileSync(GEOMETRY_PATH, ORIGINAL, 'utf-8');
  }
}

console.log('\n🧬 MANUAL MUTATION TESTING - lib/geometry.ts\n');
console.log('='.repeat(60));

// ===========================================================
// NHÓM 1: haversineDistance mutations
// ===========================================================
console.log('\n📍 GROUP 1: haversineDistance');

testMutant('haversine: R = 6371 -> 0',
  52, 'const R = 6_371;', 'const R = 0;');

testMutant('haversine: R = 6371 -> 1',
  52, 'const R = 6_371;', 'const R = 1;');

testMutant('haversine: b.lat - a.lat -> b.lat + a.lat',
  53, 'b.lat - a.lat', 'b.lat + a.lat');

testMutant('haversine: b.lng - a.lng -> b.lng + a.lng',
  54, 'b.lng - a.lng', 'b.lng + a.lng');

testMutant('haversine: Math.min(1, ...) -> Math.max(1, ...)',
  64, 'Math.min(1, Math.sqrt(Math.max(0, h)))', 'Math.max(1, Math.sqrt(Math.max(0, h)))');

testMutant('haversine: Math.max(0, h) -> Math.min(0, h)',
  64, 'Math.max(0, h)', 'Math.min(0, h)');

testMutant('haversine: dist === 0 -> dist !== 0 (normalize -0)',
  69, 'return dist === 0 ? 0 : dist;', 'return dist !== 0 ? 0 : dist;');

testMutant('haversine: Math.asin -> Math.acos',
  64, 'Math.asin', 'Math.acos');

testMutant('haversine: * 2 -> * 1 (missing factor)',
  64, '2 * Math.asin', '1 * Math.asin');

testMutant('haversine: Math.cos(toRad(a.lat)) -> Math.sin(toRad(a.lat))',
  61, 'Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat))',
  'Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat))');

// ===========================================================
// NHÓM 2: polygonCentroid mutations
// ===========================================================
console.log('\n📍 GROUP 2: polygonCentroid');

testMutant('centroid: coords.length === 0 -> coords.length !== 0',
  132, 'if (coords.length === 0) {', 'if (coords.length !== 0) {');

testMutant('centroid: coords.length === 1 -> coords.length !== 1',
  137, 'if (coords.length === 1) {', 'if (coords.length !== 1) {');

testMutant('centroid: coords.length === 2 -> coords.length !== 2',
  142, 'if (coords.length === 2) {', 'if (coords.length !== 2) {');

testMutant('centroid: midpoint div 2 -> div 1',
  144,
  '(coords[0]!.lat + coords[1]!.lat) / 2',
  '(coords[0]!.lat + coords[1]!.lat) / 1');

testMutant('centroid: xi * yj - xj * yi -> xi * yj + xj * yi (cross sign)',
  166, 'const cross = xi * yj - xj * yi;', 'const cross = xi * yj + xj * yi;');

testMutant('centroid: area /= 2 -> area /= 1 (missing halving)',
  173, 'area /= 2;', 'area /= 1;');

testMutant('centroid: factor = 1 / (6 * area) -> 1 / area',
  178, 'const factor = 1 / (6 * area);', 'const factor = 1 / area;');

testMutant('centroid: Math.abs(area) < 1e-12 -> > 1e-12',
  176, 'if (Math.abs(area) < 1e-12) {', 'if (Math.abs(area) > 1e-12) {');

// ===========================================================
// NHÓM 3: zoneDiameter mutations
// ===========================================================
console.log('\n📍 GROUP 3: zoneDiameter');

testMutant('diameter: zones.length === 0 -> !== 0',
  205, 'if (zones.length === 0) return 0;', 'if (zones.length !== 0) return 0;');

testMutant('diameter: zones.length === 1 -> !== 1',
  206, 'if (zones.length === 1) return 0;', 'if (zones.length !== 1) return 0;');

testMutant('diameter: d > max -> d >= max',
  213, 'if (d > max) max = d;', 'if (d >= max) max = d;');

testMutant('diameter: d > max -> d < max',
  213, 'if (d > max) max = d;', 'if (d < max) max = d;');

testMutant('diameter: loop j starts at i+1 -> i',
  212, 'for (let j = i + 1; j < zones.length; j++) {',
  'for (let j = i; j < zones.length; j++) {');

testMutant('diameter: loop i ends at zones.length-1 -> zones.length',
  211, 'for (let i = 0; i < zones.length - 1; i++) {',
  'for (let i = 0; i < zones.length; i++) {');

testMutant('diameter: Object.is(max, -0) ? 0 : max -> 0',
  216, 'const result = Object.is(max, -0) ? 0 : max;', 'const result = 0;');

// ===========================================================
// NHÓM 4: buildAdjacencyMatrix mutations
// ===========================================================
console.log('\n📍 GROUP 4: buildAdjacencyMatrix');

testMutant('adj: d < thresholdKm -> d <= thresholdKm',
  248, 'if (d < thresholdKm) {', 'if (d <= thresholdKm) {');

testMutant('adj: d < thresholdKm -> d > thresholdKm',
  248, 'if (d < thresholdKm) {', 'if (d > thresholdKm) {');

testMutant('adj: thresholdKm <= 0 -> < 0 (edge: 0 threshold)',
  241, 'if (thresholdKm <= 0) return matrix;', 'if (thresholdKm < 0) return matrix;');

testMutant('adj: symmetric push zj.id -> removed (asymmetric)',
  250, '        matrix[zj.id]!.push(zi.id);\n',
  '        // matrix[zj.id]!.push(zi.id);\n');

// ===========================================================
// NHÓM 5: buildDistanceMatrix mutations
// ===========================================================
console.log('\n📍 GROUP 5: buildDistanceMatrix');

testMutant('dist: diagonal = 0 -> 1',
  268, '{ [zone.id]: 0 }', '{ [zone.id]: 1 }');

testMutant('dist: symmetric zj.id assignment removed',
  280, '      matrix[zj.id]![zi.id] = d;', '      // matrix[zj.id]![zi.id] = d;');

testMutant('dist: matrix[zi.id]![zj.id] = d -> = 0',
  279, '      matrix[zi.id]![zj.id] = d;', '      matrix[zi.id]![zj.id] = 0;');

// ===========================================================
// NHÓM 6: NaN Propagation - GAP QUAN TRỌNG
// Kiểm tra các clamp guards ngăn NaN lan truyền
// ===========================================================
console.log('\n📍 GROUP 6: NaN Propagation Guards');

// G1: Bỏ Math.max(0, h) -> sqrt(-ε) có thể = NaN
testMutant('[NaN-1] Remove Math.max guard: sqrt(Math.max(0,h)) -> sqrt(h)',
  90,
  'Math.min(1, Math.sqrt(Math.max(0, h)))',
  'Math.min(1, Math.sqrt(h))');

// G2: Bỏ Math.min(1, ...) -> asin(>1) = NaN
testMutant('[NaN-2] Remove Math.min clamp: asin(Math.min(1,...)) -> asin(sqrt(...))',
  90,
  '2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))))',
  '2 * Math.asin(Math.sqrt(Math.max(0, h)))');

// G3: Threshold degenerate quá nhỏ -> near-zero division
testMutant('[NaN-3] Degenerate threshold: 1e-12 -> 0 (division by exact zero)',
  181,
  'if (Math.abs(area) < 1e-12) {',
  'if (Math.abs(area) < 0) {');

// ===========================================================
// NHÓM 7: Logic Operators &&/|| - GAP QUAN TRỌNG
// Điều kiện khép kín polygon
// ===========================================================
console.log('\n📍 GROUP 7: Logic Operators &&/||');

// G4: || -> && trong polygon close condition
// Nếu chỉ cần cả 2 điều kiện cùng lúc -> polygon có thể không khép kín
testMutant('[LOGIC-1] close-polygon: || -> && (cần cả lat VÀ lng khác nhau mới push)',
  152,
  'if (first.lat !== last.lat || first.lng !== last.lng) {',
  'if (first.lat !== last.lat && first.lng !== last.lng) {');

// G5: Đảo logic sentinel: || -> && trong isFinite check
testMutant('[LOGIC-2] sentinel: !isFinite(lat) || !isFinite(lng) -> && (chỉ throw khi CẢ HAI bad)',
  200,
  'if (!Number.isFinite(resultLat) || !Number.isFinite(resultLng)) {',
  'if (!Number.isFinite(resultLat) && !Number.isFinite(resultLng)) {');

// ===========================================================
// NHÓM 8: String / ID Operators - GAP MEDIUM
// Kiểm tra push ID đúng zoneId trong adjacency matrix
// ===========================================================
console.log('\n📍 GROUP 8: String ID Mutations');

// G6: Push zi.id thay vì zj.id (tự push chính mình thay vì neighbor)
testMutant('[ID-1] adj push wrong ID: matrix[zi.id].push(zj.id) -> push(zi.id)',
  301,
  'matrix[zi.id]!.push(zj.id);',
  'matrix[zi.id]!.push(zi.id);');

// G7: Push zj.id thay vì zi.id (swap symmetric side)
testMutant('[ID-2] adj push swapped: matrix[zj.id].push(zi.id) -> push(zj.id)',
  302,
  'matrix[zj.id]!.push(zi.id);',
  'matrix[zj.id]!.push(zj.id);');

// ===========================================================
// NHÓM 9: Accumulator Arithmetic += / -= - GAP MEDIUM
// Kiểm tra sign trong các vòng lặp tích lũy
// ===========================================================
console.log('\n📍 GROUP 9: Accumulator Arithmetic');

// G8: cLng += ... -> cLng -= ... (đảo dấu tích lũy Shoelace)
testMutant('[ACCUM-1] Shoelace cLng: += -> -=',
  174,
  'cLng += (xi + xj) * cross;',
  'cLng -= (xi + xj) * cross;');

// G9: cLat += ... -> cLat -= ... (đảo dấu tích lũy Shoelace)
testMutant('[ACCUM-2] Shoelace cLat: += -> -=',
  175,
  'cLat += (yi + yj) * cross;',
  'cLat -= (yi + yj) * cross;');

// ===========================================================
// NHÓM 10: toRad Conversion - GAP MEDIUM
// Kiểm tra divisor trong hàm toRad
// ===========================================================
console.log('\n📍 GROUP 10: toRad Converter');

// G10: / 180 -> / 90 (double angle -> tất cả kết quả haversine sai 2x)
testMutant('[toRad-1] divisor: / 180 -> / 90 (2x scale error)',
  55,
  'return (deg * Math.PI) / 180;',
  'return (deg * Math.PI) / 90;');

// ===========================================================
// SUMMARY - FULL REPORT
// ===========================================================
console.log('\n' + '='.repeat(60));
console.log('📊 MUTATION TESTING RESULTS - FINAL (42 mutants)');
console.log('='.repeat(60));

const total = killed + survived;
const score = total > 0 ? Math.round((killed / total) * 100) : 0;

console.log(`\nMutation score: ${score}%`);
console.log(`Killed:    ${killed} / ${total}`);
console.log(`Survived:  ${survived} / ${total}\n`);

if (survivedMutants.length > 0) {
  console.log('❌ SURVIVED MUTANTS (cần thêm tests):');
  for (const m of survivedMutants) {
    console.log(`  [Line ${m.lineNum}] "${m.originalCode}" -> "${m.mutatedCode}"`);
    console.log(`           Desc: ${m.description}`);
  }
}

if (score >= 80) {
  console.log('\n✅ Score >= 80% - Đủ tin để lên L1b');
} else if (score >= 60) {
  console.log('\n⚠️  Score 60–79% - Ghi lại survived mutants, có known gaps');
} else {
  console.log('\n🛑 Score < 60% - DỪNG: viết thêm tests trước khi lên tầng tiếp theo');
}
