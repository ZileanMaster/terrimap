/**
 * src/services/metricsDb.ts — Monthly metrics persistence
 *
 * Lưu/load chỉ số theo tháng (YYYY-MM) cho từng zone.
 * Offline fallback: localStorage key 'terrimap_monthly_metrics'.
 * Online: Supabase table zone_monthly_metrics.
 *
 * SQL cần chạy trên Supabase (nếu chưa có):
 * ```sql
 * CREATE TABLE IF NOT EXISTS zone_monthly_metrics (
 *   id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
 *   zone_id     TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
 *   period      TEXT NOT NULL,        -- format: '2026-04'
 *   metric_type TEXT NOT NULL,        -- 'CUSTOMER','ORDER','REVENUE','FAMILIARITY'
 *   value       NUMERIC NOT NULL DEFAULT 0,
 *   updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   UNIQUE(zone_id, period, metric_type)
 * );
 * ALTER TABLE zone_monthly_metrics ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow all for anon" ON zone_monthly_metrics
 *   FOR ALL USING (true) WITH CHECK (true);
 * ```
 */

import { supabase, isOnline } from '../lib/supabase.js'
import { getActiveProjectId } from './db.js'

export interface MonthlyMetric {
  type:  string   // 'CUSTOMER' | 'ORDER' | 'REVENUE' | 'FAMILIARITY'
  value: number
}

/** Map<zoneId, MonthlyMetric[]> */
export type MetricsMap = Map<string, MonthlyMetric[]>

const LS_BASE = 'terrimap_monthly_metrics'

/** Get project-scoped localStorage key */
function lsKeyScoped(): string {
  const pid = getActiveProjectId()
  return pid ? `${LS_BASE}_${pid}` : LS_BASE
}

// ── localStorage helpers ────────────────────────────────────────────────────

function lsGet(): Record<string, Record<string, MonthlyMetric[]>> {
  try {
    return JSON.parse(localStorage.getItem(lsKeyScoped()) ?? '{}')
  } catch {
    return {}
  }
}

function lsSet(data: Record<string, Record<string, MonthlyMetric[]>>) {
  try {
    localStorage.setItem(lsKeyScoped(), JSON.stringify(data))
  } catch { /* quota exceeded — ignore */ }
}

// ── Save ───────────────────────────────────────────────────────────────────

/**
 * Save monthly metrics for one zone.
 * `period` format: '2026-04'
 */
export async function saveMonthlyMetrics(
  zoneId:  string,
  period:  string,
  metrics: MonthlyMetric[],
): Promise<void> {
  // Always save to localStorage first
  const all = lsGet()
  if (!all[period]) all[period] = {}
  all[period]![zoneId] = metrics
  lsSet(all)

  if (!isOnline()) return

  // Upsert each metric row to Supabase
  try {
    const rows = metrics.map((m) => ({
      zone_id:     zoneId,
      period,
      metric_type: m.type,
      value:       m.value,
      updated_at:  new Date().toISOString(),
    }))
    const { error } = await supabase!
      .from('zone_monthly_metrics')
      .upsert(rows, { onConflict: 'zone_id,period,metric_type' })
    if (error) console.error('[MetricsDB] saveMonthlyMetrics error:', error)
  } catch (e) {
    console.error('[MetricsDB] saveMonthlyMetrics unexpected:', e)
  }
}

// ── Load ───────────────────────────────────────────────────────────────────

/**
 * Load monthly metrics for all zones in a period.
 * Optionally filter by regionId (requires zones to have regionId).
 * Returns Map<zoneId, MonthlyMetric[]>
 */
export async function loadMonthlyMetrics(
  period:   string,
  zoneIds?: string[],  // filter to specific zones (e.g. region's zones)
): Promise<MetricsMap> {
  // Always try localStorage first
  const all     = lsGet()
  const local   = all[period] ?? {}
  const localMap = new Map<string, MonthlyMetric[]>()
  for (const [zid, mets] of Object.entries(local)) {
    if (!zoneIds || zoneIds.includes(zid)) {
      localMap.set(zid, mets)
    }
  }

  if (!isOnline()) return localMap

  // Merge with Supabase
  try {
    let query = supabase!
      .from('zone_monthly_metrics')
      .select('zone_id, metric_type, value')
      .eq('period', period)

    if (zoneIds && zoneIds.length > 0) {
      query = query.in('zone_id', zoneIds)
    }

    const { data, error } = await query
    if (error || !data) return localMap

    // Build map from remote data (remote fills gaps not in local)
    const remoteMap = new Map<string, MonthlyMetric[]>()
    for (const row of data) {
      const list = remoteMap.get(row.zone_id) ?? []
      list.push({ type: row.metric_type, value: row.value })
      remoteMap.set(row.zone_id, list)
    }

    // Merge: local wins on conflict
    for (const [zid, mets] of remoteMap.entries()) {
      if (!localMap.has(zid)) localMap.set(zid, mets)
    }
    return localMap
  } catch {
    return localMap
  }
}

/**
 * Get all periods that have saved metrics (from localStorage).
 * Returns sorted descending: ['2026-04', '2026-03', ...]
 */
export function getAvailablePeriods(): string[] {
  const all = lsGet()
  return Object.keys(all).sort((a, b) => b.localeCompare(a))
}
