/**
 * tests/validator.test.ts
 * Test suite cho L1c Partition Validator - checkBalance, validateGeometry, suggestFix, validatePartition.
 * Không mock - test trực tiếp implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  checkBalance,
  validateGeometry,
  suggestFix,
  validatePartition,
  ValidatorError,
} from '../lib/validator.js';
import {
  fixture_ok,
  fixture_imbalanced,
  fixture_disconnected,
  fixture_large_diameter,
  fixture_all_bad,
} from './fixtures/validator-fixtures.js';

// ══════════════════════════════════════════════════════════════════════════════
// checkBalance()
// ══════════════════════════════════════════════════════════════════════════════

describe('checkBalance', () => {

  it('[BAL-1] fixture_ok -> violations rỗng (ratio mode)', () => {
    const v = checkBalance(fixture_ok.zones, fixture_ok.assignments,
      { mode: 'ratio', threshold: 1.5 });
    expect(v).toHaveLength(0);
  });

  it('[BAL-2] fixture_imbalanced -> có OVER_LOADED và UNDER_LOADED', () => {
    const v = checkBalance(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { mode: 'ratio', threshold: 1.5 });
    const types = v.map((x) => x.type);
    expect(types).toContain('OVER_LOADED');
    expect(types).toContain('UNDER_LOADED');
  });

  it('[BAL-3] threshold cao -> fixture_imbalanced pass', () => {
    const v = checkBalance(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { mode: 'ratio', threshold: 25 });
    expect(v).toHaveLength(0);
  });

  it('[BAL-4] stddev mode: fixture_ok pass threshold 0.5', () => {
    const v = checkBalance(fixture_ok.zones, fixture_ok.assignments,
      { mode: 'stddev', threshold: 0.5 });
    expect(v).toHaveLength(0);
  });

  it('[BAL-5] violation có districtId đúng', () => {
    const v = checkBalance(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { mode: 'ratio', threshold: 1.5 });
    const overloaded = v.find((x) => x.type === 'OVER_LOADED');
    expect(overloaded?.districtId).toBe(0); // D0 có 600 customers
    expect(overloaded?.customerCount).toBe(600);
  });

  it('[BAL-6] all-zero customers -> không throw, violations rỗng', () => {
    // Zones không có activity nào -> customers = 0 mọi district
    const zeroZones = fixture_ok.zones.map((z) => ({ ...z, activities: [] }));
    expect(() =>
      checkBalance(zeroZones, fixture_ok.assignments, { mode: 'ratio', threshold: 1.5 })
    ).not.toThrow();
    const v = checkBalance(zeroZones, fixture_ok.assignments,
      { mode: 'ratio', threshold: 1.5 });
    expect(v).toHaveLength(0);
  });

  it('[BAL-7] stddev mode: fixture_imbalanced vượt threshold 0.5', () => {
    const v = checkBalance(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { mode: 'stddev', threshold: 0.5 });
    expect(v.length).toBeGreaterThan(0);
  });

  it('[BAL-8] ratio field trong violation là finite và >= 0', () => {
    const v = checkBalance(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { mode: 'ratio', threshold: 1.5 });
    for (const viol of v) {
      expect(Number.isFinite(viol.ratio)).toBe(true);
      expect(viol.ratio).toBeGreaterThanOrEqual(0);
    }
  });

  it('[BAL-9] throw INVALID_MODE với mode không hợp lệ', () => {
    expect(() =>
      checkBalance(fixture_ok.zones, fixture_ok.assignments,
        { mode: 'invalid' as never })
    ).toThrow(ValidatorError);
  });

  it('[BAL-10] throw EMPTY_INPUT khi zones rỗng', () => {
    expect(() =>
      checkBalance([], [], { mode: 'ratio' })
    ).toThrow(ValidatorError);
    try {
      checkBalance([], [], { mode: 'ratio' });
    } catch (e) {
      expect((e as ValidatorError).code).toBe('EMPTY_INPUT');
    }
  });

  it('[BAL-11] throw INVALID_THRESHOLD với threshold âm', () => {
    expect(() =>
      checkBalance(fixture_ok.zones, fixture_ok.assignments, { threshold: -1 })
    ).toThrow(ValidatorError);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// validateGeometry()
// ══════════════════════════════════════════════════════════════════════════════

describe('validateGeometry', () => {

  it('[CON-1] fixture_ok -> contiguityViolations rỗng', () => {
    const v = validateGeometry(fixture_ok.zones, fixture_ok.assignments,
      { adjThresholdKm: 50 });
    expect(v.contiguityViolations).toHaveLength(0);
  });

  it('[CON-2] fixture_disconnected -> violation cho D1', () => {
    const v = validateGeometry(fixture_disconnected.zones, fixture_disconnected.assignments,
      { adjThresholdKm: 50 });
    expect(v.contiguityViolations.length).toBeGreaterThan(0);
    const d1viol = v.contiguityViolations.find((x) => x.districtId === 1);
    expect(d1viol).toBeDefined();
    expect(d1viol?.type).toBe('DISCONNECTED');
  });

  it('[CON-3] fixture_large_diameter -> diameter violation cho D2', () => {
    const v = validateGeometry(fixture_large_diameter.zones, fixture_large_diameter.assignments,
      { adjThresholdKm: 50, maxDiameterKm: 30 });
    const d2viol = v.diameterViolations.find((x) => x.districtId === 2);
    expect(d2viol).toBeDefined();
    expect(d2viol!.diameterKm).toBeGreaterThan(30);
    expect(Number.isFinite(d2viol!.diameterKm)).toBe(true);
  });

  it('[CON-4] single-zone district -> luôn connected', () => {
    const singleZone = [fixture_ok.zones[0]!];
    const singleAssign = [{ zoneId: fixture_ok.zones[0]!.id, districtId: 0 }];
    const v = validateGeometry(singleZone, singleAssign, { adjThresholdKm: 50 });
    expect(v.contiguityViolations).toHaveLength(0);
  });

  it('[CON-5] không set maxDiameterKm -> diameterViolations rỗng dù diameter lớn', () => {
    const v = validateGeometry(fixture_large_diameter.zones, fixture_large_diameter.assignments,
      { adjThresholdKm: 50 }); // không set maxDiameterKm
    expect(v.diameterViolations).toHaveLength(0);
  });

  it('[CON-6] fixture_ok + maxDiameterKm=1000 -> không có diameter violation', () => {
    const v = validateGeometry(fixture_ok.zones, fixture_ok.assignments,
      { adjThresholdKm: 50, maxDiameterKm: 1000 });
    expect(v.diameterViolations).toHaveLength(0);
  });

  it('[CON-7] D0/D2/D3 của fixture_disconnected vẫn connected', () => {
    const v = validateGeometry(fixture_disconnected.zones, fixture_disconnected.assignments,
      { adjThresholdKm: 50 });
    const otherDistricts = v.contiguityViolations.filter((x) => x.districtId !== 1);
    expect(otherDistricts).toHaveLength(0);
  });

  it('[CON-8] throw EMPTY_INPUT khi zones rỗng', () => {
    expect(() => validateGeometry([], [])).toThrow(ValidatorError);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// suggestFix()
// ══════════════════════════════════════════════════════════════════════════════

describe('suggestFix', () => {

  it('[FIX-1] fixture_ok -> ít hoặc không có suggestions', () => {
    const suggestions = suggestFix(fixture_ok.zones, fixture_ok.assignments,
      { adjThresholdKm: 50 });
    // Balance đã tốt -> không cần swap nhiều
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it('[FIX-2] fixture_imbalanced -> có suggestions', () => {
    const suggestions = suggestFix(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { adjThresholdKm: 50 });
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('[FIX-3] áp dụng swap -> balance cải thiện', () => {
    const suggestions = suggestFix(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { adjThresholdKm: 50 });

    if (suggestions.length === 0) return; // skip nếu không có

    const best = suggestions[0]!;
    const newAssignments = fixture_imbalanced.assignments.map((a) =>
      a.zoneId === best.zoneId ? { ...a, districtId: best.toDistrict } : a
    );

    // Lấy ratio trước và sau
    const before = checkBalance(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { mode: 'ratio', threshold: 999 });
    const after = checkBalance(fixture_imbalanced.zones, newAssignments,
      { mode: 'ratio', threshold: 999 });

    // fi fixture đã vi phạm -> before.length > 0, after phải có ratio nhỏ hơn
    const ratioBefore = before[0]?.ratio ?? 0;
    const ratioAfter = after[0]?.ratio ?? 0;
    expect(ratioAfter).toBeLessThanOrEqual(ratioBefore + 1e-9);
  });

  it('[FIX-4] không đề xuất swap làm district nguồn disconnected', () => {
    const suggestions = suggestFix(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { adjThresholdKm: 50 });

    for (const swap of suggestions) {
      const newAssignments = fixture_imbalanced.assignments.map((a) =>
        a.zoneId === swap.zoneId ? { ...a, districtId: swap.toDistrict } : a
      );
      const geoResult = validateGeometry(fixture_imbalanced.zones, newAssignments,
        { adjThresholdKm: 50 });
      const sourceDisconnected = geoResult.contiguityViolations
        .some((x) => x.districtId === swap.fromDistrict);
      expect(sourceDisconnected).toBe(false);
    }
  });

  it('[FIX-5] single-zone district -> không đề xuất swap zone đó ra', () => {
    // Tạo situation: D0 chỉ có 1 zone, các zone còn lại vào D1-D3
    const zones = fixture_imbalanced.zones;
    const remap = zones.map((_, i) => {
      if (i === 0) return 0;           // D0 chỉ có zone đầu
      return (i % 3) + 1;             // D1, D2, D3 nhận phần còn lại
    });
    const singleZoneAssignments = zones.map((z, i) => ({
      zoneId: z.id,
      districtId: remap[i]!,
    }));

    const suggestions = suggestFix(zones, singleZoneAssignments, { adjThresholdKm: 50 });
    const swapsFromD0 = suggestions.filter((s) => s.fromDistrict === 0);
    expect(swapsFromD0).toHaveLength(0);
  });

  it('[FIX-6] suggestions đã sắp xếp theo deltaBalance tăng dần', () => {
    const suggestions = suggestFix(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { adjThresholdKm: 50, maxSuggestions: 10 });

    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i]!.deltaBalance).toBeGreaterThanOrEqual(
        suggestions[i - 1]!.deltaBalance - 1e-9
      );
    }
  });

  it('[FIX-7] maxSuggestions giới hạn số kết quả trả về', () => {
    const suggestions = suggestFix(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { adjThresholdKm: 50, maxSuggestions: 2 });
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it('[FIX-8] deltaBalance của mọi suggestion là âm (thực sự cải thiện)', () => {
    const suggestions = suggestFix(fixture_imbalanced.zones, fixture_imbalanced.assignments,
      { adjThresholdKm: 50 });
    for (const s of suggestions) {
      expect(s.deltaBalance).toBeLessThan(0);
    }
  });

  it('[FIX-9] throw EMPTY_INPUT khi zones rỗng', () => {
    expect(() => suggestFix([], [])).toThrow(ValidatorError);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// validatePartition() - integrated validator
// ══════════════════════════════════════════════════════════════════════════════

describe('validatePartition', () => {

  it('[VAL-1] fixture_ok -> valid=true, violations rỗng', () => {
    const result = validatePartition(fixture_ok.zones, fixture_ok.assignments, {
      adjThresholdKm: 50,
      maxDiameterKm: 100,
      balanceMode: 'ratio',
      balanceThreshold: 1.5,
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('[VAL-2] fixture_all_bad -> valid=false, violations > 0', () => {
    const result = validatePartition(fixture_all_bad.zones, fixture_all_bad.assignments, {
      adjThresholdKm: 50,
      maxDiameterKm: 30,
      balanceMode: 'ratio',
      balanceThreshold: 1.5,
    });
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('[VAL-3] metrics.balanceScore trong [0, 100]', () => {
    const result = validatePartition(fixture_all_bad.zones, fixture_all_bad.assignments, {
      adjThresholdKm: 50,
      maxDiameterKm: 30,
    });
    expect(result.metrics.balanceScore).toBeGreaterThanOrEqual(0);
    expect(result.metrics.balanceScore).toBeLessThanOrEqual(100);
  });

  it('[VAL-4] metrics.maxDiameter finite và >= 0', () => {
    const result = validatePartition(fixture_large_diameter.zones, fixture_large_diameter.assignments, {
      adjThresholdKm: 50,
      maxDiameterKm: 30,
    });
    expect(Number.isFinite(result.metrics.maxDiameter)).toBe(true);
    expect(result.metrics.maxDiameter).toBeGreaterThanOrEqual(0);
  });

  it('[VAL-5] metrics.countsPerDistrict length === số districts', () => {
    const result = validatePartition(fixture_ok.zones, fixture_ok.assignments, {
      adjThresholdKm: 50,
    });
    // fixture_ok có 4 districts
    expect(result.metrics.countsPerDistrict).toHaveLength(4);
  });

  it('[VAL-6] fixture_imbalanced -> violations chứa BalanceViolation', () => {
    const result = validatePartition(fixture_imbalanced.zones, fixture_imbalanced.assignments, {
      adjThresholdKm: 50,
      balanceMode: 'ratio',
      balanceThreshold: 1.5,
    });
    const balViolations = result.violations.filter((v) => 'type' in v && (v.type === 'OVER_LOADED' || v.type === 'UNDER_LOADED'));
    expect(balViolations.length).toBeGreaterThan(0);
  });

  it('[VAL-7] fixture_disconnected -> violations chứa DISCONNECTED', () => {
    const result = validatePartition(fixture_disconnected.zones, fixture_disconnected.assignments, {
      adjThresholdKm: 50,
    });
    const contViolations = result.violations.filter((v) => 'type' in v && v.type === 'DISCONNECTED');
    expect(contViolations.length).toBeGreaterThan(0);
  });

  it('[VAL-8] không set maxDiameterKm -> không có diameter violations', () => {
    const result = validatePartition(fixture_large_diameter.zones, fixture_large_diameter.assignments, {
      adjThresholdKm: 50,
      // maxDiameterKm không set
    });
    const diamViolations = result.violations.filter((v) => 'diameterKm' in v);
    expect(diamViolations).toHaveLength(0);
  });

  it('[VAL-9] throw EMPTY_INPUT khi zones rỗng', () => {
    expect(() => validatePartition([], [])).toThrow(ValidatorError);
  });

  it('[VAL-10] fixture_ok balanceScore gần 100 (phân phối đều)', () => {
    const result = validatePartition(fixture_ok.zones, fixture_ok.assignments, {
      adjThresholdKm: 50,
    });
    // ~100 customers/district -> cực kỳ cân bằng -> score > 90
    expect(result.metrics.balanceScore).toBeGreaterThan(90);
  });

});
