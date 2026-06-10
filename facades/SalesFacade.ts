import type { Zone, SalesAgent, Activity } from '../types/domain.js';
import type { Assignment } from '../lib/partition.js';
import type { ActivityService } from '../services/ActivityService.js';
import { PermissionError } from './errors.js';
import type {
  MyDistrict,
  Customer,
  OrderForecast,
} from './viewmodels.js';

export class SalesFacade {
  private readonly _role = 'sales' as const;

  /** districtId = vị trí của salesId trong mảng salesAgents. */
  private readonly _districtId: number;

  constructor(
    private readonly salesId: string,
    private readonly activitySvc: ActivityService,
    private readonly zones: Zone[],
    private readonly assignments: Assignment[],
    private readonly salesAgents: SalesAgent[],
  ) {
    const idx = salesAgents.findIndex((sa) => sa.id === salesId);
    if (idx === -1) {
      if (salesAgents.length > 0) {
        throw new PermissionError({
          code: 'NOT_AUTHENTICATED',
          role: this._role,
          method: 'constructor',
          message: `salesId "${salesId}" not found.`,
        });
      }
    }
    this._districtId = idx >= 0 ? idx : -1;
  }

  //  getMyDistrict 

  /**
   * @throws {PermissionError} DISTRICT_NOT_FOUND nếu không có zones được gán
   */
  getMyDistrict(): MyDistrict {
    const myZoneIds = new Set(
      this.assignments
        .filter((a) => a.districtId === this._districtId)
        .map((a) => a.zoneId),
    );

    const myZones = this.zones.filter((z) => myZoneIds.has(z.id));

    if (myZones.length === 0) {
      throw new PermissionError({
        code: 'DISTRICT_NOT_FOUND',
        role: this._role,
        method: 'getMyDistrict',
        message: `No zones assigned to district ${this._districtId} (salesId "${this.salesId}").`,
      });
    }

    const summary = this.activitySvc.getDistrictSummary(
      this._districtId,
      this.zones,
      this.assignments,
    );

    return { zones: myZones, summary };
  }

  //  getMyCustomers 

  getMyCustomers(): Customer[] {
    const myZoneIds = new Set(
      this.assignments
        .filter((a) => a.districtId === this._districtId)
        .map((a) => a.zoneId),
    );

    const myZones = this.zones.filter((z) => myZoneIds.has(z.id));

    return myZones.map((z) => {
      const customerActivities = z.activities.filter((a) => a.type === 'CUSTOMER');
      const count = customerActivities.reduce((s, a) => s + a.value, 0);
      const loc = customerActivities.find((a) => a.location !== undefined)?.location;

      return {
        zoneId: z.id,
        zoneName: z.name,
        count,
        ...(loc !== undefined && { location: { lat: loc.lat, lng: loc.lng } }),
      } satisfies Customer;
    });
  }

  //  getMyOrderForecast 

  getMyOrderForecast(): OrderForecast {
    const myZoneIds = new Set(
      this.assignments
        .filter((a) => a.districtId === this._districtId)
        .map((a) => a.zoneId),
    );

    const myZones = this.zones.filter((z) => myZoneIds.has(z.id));

    const currentOrders = myZones.reduce((total, z) => {
      return (
        total +
        z.activities
          .filter((a) => a.type === 'ORDER')
          .reduce((s, a) => s + a.value, 0)
      );
    }, 0);

    return {
      districtId: this._districtId,
      currentOrders,
      forecastedOrders: Math.round(currentOrders * 1.05),
      forecastedAt: new Date().toISOString(),
    };
  }

  // Lưu ý: không có runAlgorithm / createVersion / assignZone
  // SalesFacade chỉ đọc - các method đó không tồn tại trên class này.
  // Test kiểm tra: `(sales as any).method === undefined`
}
