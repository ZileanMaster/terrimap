
import { supabase, isOnline } from '../lib/supabase.js'
import { getActiveProjectId } from './db.js'
import type { DistrictReport } from '../../facades/viewmodels.js'

const LS_BASE = 'terrimap_district_reports'

function lsKeyScoped(projectId?: string): string {
  const pid = projectId || getActiveProjectId()
  return pid ? `${LS_BASE}_${pid}` : LS_BASE
}

function nowIso(): string {
  return new Date().toISOString()
}

export function currentPeriod(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function lsRead(projectId?: string): DistrictReport[] {
  try {
    return JSON.parse(localStorage.getItem(lsKeyScoped(projectId)) ?? '[]') as DistrictReport[]
  } catch {
    return []
  }
}

function lsWrite(reports: DistrictReport[], projectId?: string) {
  try {
    localStorage.setItem(lsKeyScoped(projectId), JSON.stringify(reports))
  } catch { /* ignore quota */ }
}

function upsertLocal(next: DistrictReport, projectId?: string) {
  const all = lsRead(projectId)
  const idx = all.findIndex((r) =>
    r.period === next.period
    && r.userId === next.userId
    && r.regionId === next.regionId
    && r.districtId === next.districtId,
  )
  if (idx >= 0) all[idx] = next
  else all.unshift(next)
  // keep at most 500 entries per project to avoid unbounded growth
  if (all.length > 500) all.length = 500
  lsWrite(all, projectId)
}

export async function saveDistrictReport(input: Omit<DistrictReport, 'id' | 'updatedAt'> & { id?: string }): Promise<void> {
  const report: DistrictReport = {
    id: input.id ?? `dr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId: input.projectId,
    regionId: input.regionId,
    districtId: input.districtId,
    userId: input.userId,
    period: input.period,
    customers: Math.max(0, Math.floor(input.customers ?? 0)),
    orders: Math.max(0, Math.floor(input.orders ?? 0)),
    revenue: Math.max(0, Math.floor(input.revenue ?? 0)),
    note: input.note,
    updatedAt: nowIso(),
  }

  upsertLocal(report, report.projectId)

  if (!isOnline()) return

  try {
    const row: Record<string, unknown> = {
      id: report.id,
      project_id: report.projectId ?? getActiveProjectId() ?? null,
      region_id: report.regionId,
      district_id: report.districtId,
      user_id: report.userId,
      period: report.period,
      customers: report.customers,
      orders: report.orders,
      revenue: report.revenue ?? 0,
      note: report.note ?? null,
      updated_at: report.updatedAt,
    }
    void (async () => {
      try {
        const { error } = await supabase!
          .from('district_reports')
          .upsert(row, { onConflict: 'project_id,region_id,district_id,user_id,period' })
        if (error) {
          // Table may not exist or RLS may block: keep local-only behavior.
          const msg = String((error as any)?.message ?? '')
          if (/revenue/i.test(msg) && /column/i.test(msg)) {
            const fallbackRow = { ...row }
            delete (fallbackRow as any).revenue
            const retry = await supabase!
              .from('district_reports')
              .upsert(fallbackRow, { onConflict: 'project_id,region_id,district_id,user_id,period' })
            if (retry.error) {
              console.warn('[DistrictReportsDB] saveDistrictReport supabase error:', retry.error)
            }
          } else {
            console.warn('[DistrictReportsDB] saveDistrictReport supabase error:', error)
          }
        }
      } catch (e) {
        console.warn('[DistrictReportsDB] saveDistrictReport unexpected:', e)
      }
    })()
  } catch (e) {
    console.warn('[DistrictReportsDB] saveDistrictReport unexpected:', e)
  }
}

export async function loadDistrictReports(period: string, projectId?: string): Promise<DistrictReport[]> {
  const local = lsRead(projectId).filter((r) => r.period === period)

  if (!isOnline()) return local

  try {
    let query = supabase!
      .from('district_reports')
      .select('*')
      .eq('period', period)

    const pid = projectId || getActiveProjectId()
    if (pid) query = query.eq('project_id', pid)

    const { data, error } = await query
    if (error || !data) return local

    const remote = (data as any[]).map((r) => ({
      id: r.id as string,
      projectId: (r.project_id ?? undefined) as string | undefined,
      regionId: r.region_id as string,
      districtId: Number(r.district_id),
      userId: r.user_id as string,
      period: r.period as string,
      customers: Number(r.customers ?? 0),
      orders: Number(r.orders ?? 0),
      revenue: Number(r.revenue ?? 0),
      note: (r.note ?? undefined) as string | undefined,
      updatedAt: (r.updated_at ?? nowIso()) as string,
    } satisfies DistrictReport))

    // Merge: local wins for the same key
    const key = (r: DistrictReport) => `${r.period}|${r.userId}|${r.regionId}|${r.districtId}`
    const localKeys = new Set(local.map(key))
    const merged = [...local]
    for (const rr of remote) {
      if (!localKeys.has(key(rr))) merged.push(rr)
    }
    merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return merged
  } catch {
    return local
  }
}
