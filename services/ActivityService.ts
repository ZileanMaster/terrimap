import type { Zone, Activity } from '../types/domain.js';
import { zoneDiameter } from '../lib/geometry.js';
import type { Assignment } from '../lib/partition.js';
import { ServiceError } from './errors.js';

//  Types 

/** Tóm tắt metrics của một district. */
export interface DistrictSummary {
  districtId: number;
  zoneCount: number;
  totalCustomers: number;
  totalOrders: number;
  /** km, từ zoneDiameter(). */
  diameter: number;
  /** 0-100, so với tất cả districts (dựa trên CV). */
  balanceScore: number;
  /** 0-100, balance score cho orders (dựa trên CV). */
  ordersBalanceScore: number;
}

/** Một record hợp lệ đọc từ CSV. */
export interface ActivityRecord {
  zoneId: string;
  customers: number;
  orders: number;
}

//  Helpers 

function _getActivity(zone: Zone, type: Activity['type']): number {
  return zone.activities
    .filter((a) => a.type === type)
    .reduce((s, a) => s + a.value, 0);
}

//  ActivityService 

export class ActivityService {

  /**
   * Cập nhật customers và/hoặc orders của một zone.
   * Trả về array zones mới (immutable - không mutate input).
   *
   * @throws {ServiceError} ZONE_NOT_FOUND | INVALID_INPUT
   */
  updateZoneActivity(
    zoneId: string,
    zones: Zone[],
    data: { customers?: number; orders?: number },
  ): Zone[] {
    const idx = zones.findIndex((z) => z.id === zoneId);
    if (idx === -1) {
      throw new ServiceError({
        code: 'ZONE_NOT_FOUND',
        message: `zoneId "${zoneId}" not found.`,
      });
    }

    // Validate values
    if (data.customers !== undefined) {
      if (!Number.isFinite(data.customers) || data.customers < 0) {
        throw new ServiceError({
          code: 'INVALID_INPUT',
          message: `customers must be a finite non-negative number, got ${data.customers}.`,
        });
      }
    }
    if (data.orders !== undefined) {
      if (!Number.isFinite(data.orders) || data.orders < 0) {
        throw new ServiceError({
          code: 'INVALID_INPUT',
          message: `orders must be a finite non-negative number, got ${data.orders}.`,
        });
      }
    }

    const zone = zones[idx]!;

    // Build updated activities - filter out old CUSTOMER/ORDER, add new
    const keepActivities = zone.activities.filter((a) => {
      if (data.customers !== undefined && a.type === 'CUSTOMER') return false;
      if (data.orders !== undefined && a.type === 'ORDER') return false;
      return true;
    });

    const newActivities: Activity[] = [...keepActivities];
    if (data.customers !== undefined && data.customers > 0) {
      newActivities.push({ id: `cust-${zoneId}`, type: 'CUSTOMER', value: data.customers });
    }
    if (data.orders !== undefined && data.orders > 0) {
      newActivities.push({ id: `ord-${zoneId}`, type: 'ORDER', value: data.orders });
    }

    // Immutable update
    const updatedZone: Zone = { ...zone, activities: newActivities };
    const newZones = [...zones];
    newZones[idx] = updatedZone;
    return newZones;
  }

  /**
   * Tính DistrictSummary cho một district.
   * balanceScore tính dựa trên CV của customers so với tất cả districts.
   *
   * @complexity O(n) - n = zones.length.
   */
  getDistrictSummary(
    districtId: number,
    zones: Zone[],
    assignments: Assignment[],
  ): DistrictSummary {
    // Nhóm zones theo district
    const zoneMap = new Map<string, Zone>(zones.map((z) => [z.id, z]));
    const m = Math.max(...assignments.map((a) => a.districtId)) + 1;
    const groups: Zone[][] = Array.from({ length: m }, () => []);

    for (const a of assignments) {
      const z = zoneMap.get(a.zoneId);
      if (z) groups[a.districtId]!.push(z);
    }

    const targetGroup = groups[districtId] ?? [];

    const totalCustomers = targetGroup.reduce((s, z) => s + _getActivity(z, 'CUSTOMER'), 0);
    const totalOrders = targetGroup.reduce((s, z) => s + _getActivity(z, 'ORDER'), 0);
    const diameter = zoneDiameter(targetGroup);

    // balanceScore: dựa trên CV của customers tất cả districts
    const allCounts = groups.map((g) => g.reduce((s, z) => s + _getActivity(z, 'CUSTOMER'), 0));
    const mean = allCounts.reduce((s, c) => s + c, 0) / (allCounts.length || 1);
    let balanceScore = 100;
    if (mean > 0) {
      const variance = allCounts.reduce((s, c) => s + (c - mean) ** 2, 0) / allCounts.length;
      const cv = Math.sqrt(variance) / mean;
      balanceScore = Math.max(0, Math.min(100, 100 * (1 - cv)));
    }

    // ordersBalanceScore: dựa trên CV của orders tất cả districts
    const allOrderCounts = groups.map((g) => g.reduce((s, z) => s + _getActivity(z, 'ORDER'), 0));
    const orderMean = allOrderCounts.reduce((s, c) => s + c, 0) / (allOrderCounts.length || 1);
    let ordersBalanceScore = 100;
    if (orderMean > 0) {
      const orderVariance = allOrderCounts.reduce((s, c) => s + (c - orderMean) ** 2, 0) / allOrderCounts.length;
      const orderCv = Math.sqrt(orderVariance) / orderMean;
      ordersBalanceScore = Math.max(0, Math.min(100, 100 * (1 - orderCv)));
    }

    return {
      districtId,
      zoneCount: targetGroup.length,
      totalCustomers,
      totalOrders,
      diameter,
      balanceScore,
      ordersBalanceScore,
    };
  }

  /**
   * Parse CSV với header: zone_id,customers,orders.
   * Skip rows có zone_id trống hoặc giá trị không hợp lệ.
   * Log warning (console.warn) cho mỗi row bị skip.
   *
   * @complexity O(n) - n = số rows.
   */
  importActivitiesFromCSV(csv: string): ActivityRecord[] {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    // Bỏ qua header row
    const [_header, ...dataRows] = lines;

    const records: ActivityRecord[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      const parts = row.split(',');
      const rowNum = i + 2; // 1-indexed, +1 for header

      const zoneId = parts[0]?.trim() ?? '';
      const rawCustomers = parts[1]?.trim() ?? '';
      const rawOrders = parts[2]?.trim() ?? '';

      // Validate zone_id
      if (!zoneId) {
        console.warn(`[CSV] Row ${rowNum}: skipped - zone_id is empty.`);
        continue;
      }

      const customers = Number(rawCustomers);
      const orders = Number(rawOrders);

      if (!Number.isFinite(customers) || customers < 0) {
        console.warn(`[CSV] Row ${rowNum} (${zoneId}): skipped - invalid customers "${rawCustomers}".`);
        continue;
      }
      if (!Number.isFinite(orders) || orders < 0) {
        console.warn(`[CSV] Row ${rowNum} (${zoneId}): skipped - invalid orders "${rawOrders}".`);
        continue;
      }

      records.push({ zoneId, customers, orders });
    }

    return records;
  }
}
