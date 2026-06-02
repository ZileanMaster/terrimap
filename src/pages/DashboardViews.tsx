/**
 * DashboardViews.tsx — View components for the main Dashboard panels
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useDataStore } from '../store/dataStore.js';
import { useUIStore } from '../store/uiStore.js';
import { useAuthStore } from '../store/authStore.js';
import { isOnline, supabase } from '../lib/supabase.js';
import { loadSnapshots } from '../services/db.js';
import { buildAdjacencyMatrix, findPolygonTopologyViolations } from '../../lib/geometry.js';
import { loadDistrictReports, currentPeriod as currentReportPeriod } from '../services/districtReportsDb.js';

// Clean email-based mock members for offline mode
const MOCK_MEMBERS = [
  {
    id: 'm1',
    user_id: 'admin_test',
    role: 'admin',
    region_id: null,
    profile: { email: 'admin.test@terrimap.vn', full_name: 'Admin Terrimap' },
    capacity: 0,
  },
  {
    id: 'm2',
    user_id: 'coord_test',
    role: 'coordinator',
    region_id: 'region-hn',
    profile: { email: 'coord.test@terrimap.vn', full_name: 'Điều Phối Test' },
    capacity: 0,
  },
  {
    id: 'm3',
    user_id: 'sales_test',
    role: 'sales',
    region_id: 'region-hn',
    profile: { email: 'sales.test@terrimap.vn', full_name: 'Nhân Viên Test' },
    capacity: 450,
  },
  {
    id: 'm4',
    user_id: 'sales_hn_1',
    role: 'sales',
    region_id: 'region-hn',
    profile: { email: 'sales_hn_1@terrimap.vn', full_name: 'Nguyễn Văn A' },
    capacity: 400,
  },
  {
    id: 'm5',
    user_id: 'sales_hn_2',
    role: 'sales',
    region_id: 'region-hn',
    profile: { email: 'sales_hn_2@terrimap.vn', full_name: 'Trần Thị B' },
    capacity: 500,
  },
  {
    id: 'm6',
    user_id: 'sales_hn_3',
    role: 'sales',
    region_id: 'region-hn',
    profile: { email: 'sales_hn_3@terrimap.vn', full_name: 'Lê Văn C' },
    capacity: 600,
  },
  {
    id: 'm7',
    user_id: 'sales_hcm_1',
    role: 'sales',
    region_id: 'region-hcm',
    profile: { email: 'sales_hcm_1@terrimap.vn', full_name: 'Vũ Thị F' },
    capacity: 550,
  },
  {
    id: 'm8',
    user_id: 'sales_hcm_2',
    role: 'sales',
    region_id: 'region-hcm',
    profile: { email: 'sales_hcm_2@terrimap.vn', full_name: 'Đặng Minh G' },
    capacity: 480,
  },
];

// ── 1. TỔNG QUAN (OverviewView) ───────────────────────────────────────────────
export function OverviewView() {
  const zones = useDataStore((s) => s.zones);
  const assignments = useDataStore((s) => s.assignments);
  const agents = useDataStore((s) => s.agents);
  const regions = useDataStore((s) => s.regions);
  const currentProjectId = useAuthStore((s) => s.currentProjectId);

  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loadingSnaps, setLoadingSnaps] = useState(false);
  const [districtReports, setDistrictReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const reportPeriod = currentReportPeriod();

  useEffect(() => {
    setLoadingSnaps(true);
    loadSnapshots()
      .then((data) => setSnapshots(data || []))
      .catch(console.error)
      .finally(() => setLoadingSnaps(false));
  }, []);

  useEffect(() => {
    setLoadingReports(true);
    loadDistrictReports(reportPeriod, currentProjectId ?? undefined)
      .then((rs) => setDistrictReports(rs as any))
      .catch(() => setDistrictReports([]))
      .finally(() => setLoadingReports(false));
  }, [reportPeriod, currentProjectId]);

  const assignedCount = assignments.filter((a) => a.salesAgentId).length;
  const assignmentPercent = zones.length > 0 ? Math.round((assignedCount / zones.length) * 100) : 0;

  const reportStats = useMemo(() => {
    const totalCustomers = districtReports.reduce((s, r) => s + (Number(r.customers) || 0), 0);
    const totalOrders = districtReports.reduce((s, r) => s + (Number(r.orders) || 0), 0);
    const districtKey = (r: any) => `${r.regionId || r.region_id || ''}|${r.districtId || r.district_id || ''}`
    const districts = new Set(districtReports.map(districtKey));
    const users = new Set(districtReports.map((r: any) => String(r.userId || r.user_id || '')));
    return {
      totalCustomers,
      totalOrders,
      reportCount: districtReports.length,
      districtCount: districts.size,
      userCount: users.size,
    };
  }, [districtReports]);

  // Compute total violations and islands across all regions
  let totalContiguityViolations = 0;
  let totalIslandZones = 0;
  let totalTopologyErrors = 0;

  const regionStatsList = regions.map((r) => {
    const regionZones = zones.filter((z) => (z as any).regionId === r.id);
    const regionZonesCount = regionZones.length;

    const regionAssignments = assignments.filter((a) =>
      regionZones.some((z) => z.id === a.zoneId)
    );
    const regionAssignedCount = regionAssignments.filter((a) => a.salesAgentId).length;

    // Contiguity & Island zones
    const adj = buildAdjacencyMatrix(regionZones, 50);
    const topologyErrors = findPolygonTopologyViolations(regionZones).length;
    totalTopologyErrors += topologyErrors;
    const islandCount = regionZones.filter((z) => (adj[z.id] ?? []).length === 0).length;
    totalIslandZones += islandCount;

    // Match agents to this region by name or ID
    const agentsInRegion = agents.filter((a) => {
      const regId = (a as any).regionId || (a as any).region_id;
      return a.activeRegion === r.name || a.activeRegion === r.id || regId === r.id;
    });

    let regionContiguityViolations = 0;
    let overloadedCount = 0;
    let underloadedCount = 0;
    let totalDeviationSum = 0;
    let agentsWithWorkloadCount = 0;

    const zoneMap = new Map(regionZones.map((z) => [z.id, z]));

    agentsInRegion.forEach((agent) => {
      const agentZoneIds = regionAssignments.filter((a) => a.salesAgentId === agent.id).map((a) => a.zoneId);

      if (agentZoneIds.length > 0) {
        agentsWithWorkloadCount++;

        // Contiguity check via BFS
        if (agentZoneIds.length > 1) {
          const zoneIdsSet = new Set(agentZoneIds);
          const [start] = zoneIdsSet;
          const visited = new Set<string>([start!]);
          const queue: string[] = [start!];
          while (queue.length > 0) {
            const cur = queue.shift()!;
            for (const nb of adj[cur] ?? []) {
              if (zoneIdsSet.has(nb) && !visited.has(nb)) {
                visited.add(nb);
                queue.push(nb);
              }
            }
          }
          if (visited.size !== zoneIdsSet.size) {
            regionContiguityViolations++;
            totalContiguityViolations++;
          }
        }

        // Calculate workload (sum of customers)
        const workload = agentZoneIds.reduce((sum, zId) => {
          const z = zoneMap.get(zId);
          if (!z) return sum;
          return sum + z.activities.filter((act) => act.type === 'CUSTOMER').reduce((s, act) => s + act.value, 0);
        }, 0);

        if (workload > agent.capacity) {
          overloadedCount++;
        } else if (workload < agent.capacity * 0.7) {
          underloadedCount++;
        }

        const deviation = Math.abs(workload - agent.capacity) / agent.capacity;
        totalDeviationSum += deviation;
      }
    });

    const avgDeviation = agentsWithWorkloadCount > 0
      ? Math.round((totalDeviationSum / agentsWithWorkloadCount) * 1000) / 10
      : 0;

    return {
      regionId: r.id,
      regionName: r.name,
      zonesCount: regionZonesCount,
      assignedCount: regionAssignedCount,
      islandCount,
      topologyErrors,
      contiguityViolations: regionContiguityViolations,
      overloadedCount,
      underloadedCount,
      avgDeviation,
    };
  });

  return (
    <div style={styles.viewContainer}>
      <div style={styles.workflowHero}>
        <div>
          <span style={styles.workflowKicker}>Workflow readiness</span>
          <h3 style={styles.viewHeader}>Tổng quan dự án</h3>
          <p style={styles.workflowText}>
            TerriMap sẵn sàng chạy phân chia khi khu vực có zones, sales, topology hợp lệ và graph liên thông.
          </p>
        </div>
        <div style={styles.workflowSteps}>
          <span style={regions.length > 0 ? styles.stepOk : styles.stepWarn}>1. Khu vực</span>
          <span style={zones.length > 0 ? styles.stepOk : styles.stepWarn}>2. Zones</span>
          <span style={agents.length > 1 ? styles.stepOk : styles.stepWarn}>3. Sales</span>
          <span style={totalTopologyErrors === 0 ? styles.stepOk : styles.stepWarn}>4. Topology</span>
          <span style={totalContiguityViolations === 0 ? styles.stepOk : styles.stepWarn}>5. Liên thông</span>
        </div>
      </div>

      {/* Metric Cards Deck */}
      <div style={styles.summaryGrid}>
        {/* Card 1 */}
        <div style={{ ...styles.card, ...styles.cardWide }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>R</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{regions.length}</span>
            <span style={styles.cardLbl}>Khu vực Địa lý</span>
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ ...styles.card, ...styles.cardWide }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>S</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{agents.length}</span>
            <span style={styles.cardLbl}>Nhân viên Sales</span>
          </div>
        </div>

        {/* Card 3 */}
        <div style={{ ...styles.card, ...styles.cardNarrow }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>I</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{totalIslandZones}</span>
            <span style={styles.cardLbl}>Vùng cô lập (Islands)</span>
          </div>
        </div>

        {/* Card 4 */}
        <div style={{ ...styles.card, ...styles.cardNarrow }}>
          <div style={{ ...styles.cardBadge, backgroundColor: totalContiguityViolations > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(129, 140, 248, 0.12)', color: totalContiguityViolations > 0 ? '#ef4444' : '#818cf8' }}>C</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{totalContiguityViolations}</span>
            <span style={styles.cardLbl}>Vi phạm liên thông</span>
          </div>
        </div>
      </div>

      {/* District Reports Summary */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h4 style={styles.sectionTitle}>Báo cáo cụm</h4>
            <div style={styles.sectionMeta}>Tháng {reportPeriod} · tổng hợp dữ liệu nhập theo cụm, user và khu vực</div>
          </div>
          <div style={styles.sectionPill}>{reportStats.reportCount} dòng báo cáo</div>
        </div>
        <div style={styles.reportGrid}>
          <div style={{ ...styles.card, ...styles.reportCard, ...styles.cardWide }}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>K</div>
            <div style={styles.cardInfo}>
              <span style={styles.cardVal}>{reportStats.totalCustomers}</span>
              <span style={styles.cardLbl}>KH báo cáo</span>
            </div>
          </div>
          <div style={{ ...styles.card, ...styles.reportCard, ...styles.cardWide }}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>O</div>
            <div style={styles.cardInfo}>
              <span style={styles.cardVal}>{reportStats.totalOrders}</span>
              <span style={styles.cardLbl}>Đơn báo cáo</span>
            </div>
          </div>
          <div style={{ ...styles.card, ...styles.reportCard, ...styles.cardNarrow }}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#f59e0b' }}>D</div>
            <div style={styles.cardInfo}>
              <span style={styles.cardVal}>{reportStats.districtCount}</span>
              <span style={styles.cardLbl}>Cụm có dữ liệu</span>
            </div>
          </div>
          <div style={{ ...styles.card, ...styles.reportCard, ...styles.cardNarrow }}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>U</div>
            <div style={styles.cardInfo}>
              <span style={styles.cardVal}>{reportStats.userCount}</span>
              <span style={styles.cardLbl}>Người đã nhập</span>
            </div>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Khu vực</th>
                <th style={styles.th}>Cụm</th>
                <th style={styles.th}>Khách hàng</th>
                <th style={styles.th}>Đơn hàng</th>
                <th style={styles.th}>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {loadingReports && (
                <tr><td colSpan={5} style={styles.tableEmpty}>Đang tải báo cáo...</td></tr>
              )}
              {!loadingReports && districtReports.slice(0, 8).map((r: any) => {
                const rid = r.regionId ?? r.region_id
                const regionName = regions.find((rr) => rr.id === rid)?.name ?? String(rid ?? '')
                return (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}><strong>{regionName || '-'}</strong></td>
                    <td style={styles.td}>C{r.districtId ?? r.district_id}</td>
                    <td style={styles.td}>{Number(r.customers ?? 0)}</td>
                    <td style={styles.td}>{Number(r.orders ?? 0)}</td>
                    <td style={styles.td}>{new Date(r.updatedAt ?? r.updated_at ?? Date.now()).toLocaleString('vi-VN')}</td>
                  </tr>
                )
              })}
              {!loadingReports && districtReports.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.tableEmpty}>
                    Chưa có báo cáo cụm nào trong tháng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Region Status Details */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>📍 Tình trạng Sức khỏe của các Khu vực</h4>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Tên Khu vực</th>
                <th style={styles.th}>Quy mô Zones</th>
                <th style={styles.th}>Tỷ lệ Phân công</th>
                <th style={styles.th}>Liên thông địa lý</th>
                <th style={styles.th}>Cân bằng tải (Lệch TB)</th>
                <th style={styles.th}>Over / Underloaded</th>
              </tr>
            </thead>
            <tbody>
              {regionStatsList.map((stat) => (
                <tr key={stat.regionId} style={styles.tr}>
                  <td style={styles.td}><strong>{stat.regionName}</strong></td>
                  <td style={styles.td}>{stat.zonesCount} zones ({stat.islandCount} cô lập)</td>
                  <td style={styles.td}>
                    {stat.assignedCount}/{stat.zonesCount} ({stat.zonesCount > 0 ? Math.round((stat.assignedCount / stat.zonesCount) * 100) : 0}%)
                  </td>
                  <td style={styles.td}>
                    {stat.contiguityViolations > 0 ? (
                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                        🔴 {stat.contiguityViolations} vi phạm
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>🟢 Đảm bảo</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    ±{stat.avgDeviation}%
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: stat.overloadedCount > 0 ? '#ef4444' : 'inherit', fontWeight: stat.overloadedCount > 0 ? 'bold' : 'normal' }}>
                      {stat.overloadedCount} Quá tải
                    </span>
                    {' / '}
                    <span style={{ color: stat.underloadedCount > 0 ? '#fbbf24' : 'inherit', fontWeight: stat.underloadedCount > 0 ? 'bold' : 'normal' }}>
                      {stat.underloadedCount} Thiếu tải
                    </span>
                  </td>
                </tr>
              ))}
              {regionStatsList.length === 0 && (
                <tr>
                  <td colSpan={6} style={styles.tableEmpty}>
                    📭 Chưa cấu hình khu vực nào cho dự án này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshots Table */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>📸 Các Snapshots Phân vùng Lưu Gần đây</h4>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Label Snapshot</th>
                <th style={styles.th}>Chu kỳ (Period)</th>
                <th style={styles.th}>Thời gian Tạo</th>
                <th style={styles.th}>Quy mô</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.slice(0, 5).map((s: any) => (
                <tr key={s.id} style={styles.tr}>
                  <td style={styles.td}><code>{s.label}</code></td>
                  <td style={styles.td}>{s.period || 'Mặc định'}</td>
                  <td style={styles.td}>{new Date(s.created_at || s.timestamp).toLocaleString('vi-VN')}</td>
                  <td style={styles.td}>{(s.data?.zones || s.zones || []).length} zones</td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr>
                  <td colSpan={4} style={styles.tableEmpty}>
                    {loadingSnaps ? '⏳ Đang tải snapshots...' : '📭 Chưa có snapshot phân vùng nào được tạo.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 2. QUẢN LÝ USER (UsersView) ──────────────────────────────────────────────
export function UsersView() {
  const currentProjectId = useAuthStore((s) => s.currentProjectId);
  const regions = useDataStore((s) => s.regions);

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const formatDob = (dob?: string | null) => {
    if (!dob) return '—';
    const s = String(dob).slice(0, 10); // YYYY-MM-DD
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  };

  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('sales');
  const [editRegionId, setEditRegionId] = useState<string>('');

  const reloadMembers = async () => {
    if (!supabase || !currentProjectId) {
      // In online mode, data must be project-scoped. No demo fallback here.
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const { data: rawMembers, error } = await supabase
        .from('project_members')
        .select('id,user_id,role,region_id,joined_at')
        .eq('project_id', currentProjectId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('[UsersView] load project members error:', error.message);
        return;
      }
      if (!rawMembers || rawMembers.length === 0) {
        setMembers([]);
        return;
      }

        const userIds = rawMembers.map((m: any) => m.user_id);
        const profilesRes = await supabase
          .from('profiles')
          .select('id, email, full_name, date_of_birth, phone')
          .in('id', userIds);
        const profiles = profilesRes.data;
        if (profilesRes.error) {
          console.error('[UsersView] load profiles error:', profilesRes.error.message);
        }

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        const merged = rawMembers.map((m: any) => ({
          ...m,
          profile: profileMap.get(m.user_id) || { email: m.user_id, full_name: 'Chưa cập nhật' },
          // Keep capacity in memory for existing flows (algorithms), but don't show/edit it here.
          capacity: m.capacity ?? 500,
        }));

      setMembers(merged);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadMembers();
  }, [currentProjectId]);

  const handleStartEdit = (member: any) => {
    setEditingId(member.id);
    setEditRole(member.role);
    setEditRegionId(member.region_id || '');
  };

  const handleSaveEdit = async (member: any) => {
    if (!supabase || !currentProjectId) {
      // Offline edit fallback
      const updated = members.map((m) => {
        if (m.id === member.id) {
          return {
            ...m,
            role: editRole,
            region_id: editRegionId || null,
          };
        }
        return m;
      });
      setMembers(updated);
      setEditingId(null);
      return;
    }

    try {
      // 1. Update project_members table
      const { error: pmError } = await supabase
        .from('project_members')
        .update({
          role: editRole,
          region_id: (editRole === 'coordinator' || editRole === 'sales') && editRegionId ? editRegionId : null,
        })
        .eq('id', member.id);

      if (pmError) {
        alert(`❌ Lỗi cập nhật quyền: ${pmError.message}`);
        return;
      }

      // 2. If role is sales, upsert sales_agents
        if (editRole === 'sales') {
          const region = regions.find((r) => r.id === editRegionId);
          const activeRegionName = region ? region.name : '';
          const capacity = Number(member.capacity) || 500;
          const { error: saError } = await supabase
            .from('sales_agents')
            .upsert({
              id: member.user_id,
              name: member.profile?.full_name || member.profile?.email?.split('@')[0] || 'Sales Agent',
              active_region: activeRegionName,
              capacity,
              region_id: editRegionId || null,
              project_id: currentProjectId,
            });
          if (saError) console.error('[UsersView] upsert agent error:', saError);
        } else {
        // If changing FROM sales agent, delete agent profile and assignments
        if (member.role === 'sales') {
          await supabase.from('assignments').delete().eq('sales_agent_id', member.user_id);
          await supabase.from('sales_agents').delete().eq('id', member.user_id);
        }
      }

      // Refresh global store & local members
      await useDataStore.getState().init(currentProjectId);
      await reloadMembers();
      setEditingId(null);
    } catch (e: any) {
      alert(`❌ Lỗi: ${e.message}`);
    }
  };

  const handleDeleteMember = async (member: any) => {
    if (member.role === 'admin' && members.filter((m) => m.role === 'admin').length <= 1) {
      alert('⚠️ Không thể xóa Quản trị viên duy nhất của dự án.');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa thành viên "${member.profile?.full_name || member.profile?.email}" khỏi dự án?`)) {
      return;
    }

    if (!supabase || !currentProjectId) {
      // Offline delete fallback
      setMembers(members.filter((m) => m.id !== member.id));
      return;
    }

    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', member.id);

      if (error) {
        alert(`❌ Lỗi xóa thành viên: ${error.message}`);
        return;
      }

      // If was sales, delete agent profile
      if (member.role === 'sales') {
        await supabase.from('assignments').delete().eq('sales_agent_id', member.user_id);
        await supabase.from('sales_agents').delete().eq('id', member.user_id);
      }

      await useDataStore.getState().init(currentProjectId);
      await reloadMembers();
    } catch (e: any) {
      alert(`❌ Lỗi: ${e.message}`);
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    coordinator: 'Điều phối viên',
    sales: 'Nhân viên Sales',
  };

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>👥 Quản lý Thành viên Dự án</h3>

      <div style={styles.section}>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>Email Tài khoản</th>
                  <th style={styles.th}>Họ và Tên</th>
                  <th style={styles.th}>Ngày sinh</th>
                  <th style={styles.th}>SĐT</th>
                  <th style={styles.th}>Vai trò (Role)</th>
                  <th style={styles.th}>Khu vực phụ trách</th>
                  <th style={{ ...styles.th, textAlign: 'right', paddingRight: '20px' }}>Thao tác</th>
                </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isEditing = editingId === m.id;
                const regionName = regions.find((r) => r.id === m.region_id)?.name || 'Chưa gán';

                return (
                  <tr key={m.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{m.profile?.email || m.user_id}</strong>
                      </td>
                      <td style={styles.td}>{m.profile?.full_name}</td>
                      <td style={styles.td}>{formatDob(m.profile?.date_of_birth)}</td>
                      <td style={styles.td}>{m.profile?.phone || '—'}</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          style={styles.inlineSelect}
                        >
                          <option value="admin">Quản trị viên</option>
                          <option value="coordinator">Điều phối viên</option>
                          <option value="sales">Nhân viên Sales</option>
                        </select>
                      ) : (
                        <span style={{
                          ...styles.roleBadge,
                          background: m.role === 'admin' ? 'rgba(99,102,241,0.15)' : m.role === 'coordinator' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                          color: m.role === 'admin' ? '#818cf8' : m.role === 'coordinator' ? '#34d399' : '#fbbf24',
                        }}>
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {isEditing ? (
                        (editRole === 'coordinator' || editRole === 'sales') ? (
                          <select
                            value={editRegionId}
                            onChange={(e) => setEditRegionId(e.target.value)}
                            style={styles.inlineSelect}
                          >
                            <option value="">-- Chưa gán --</option>
                            {regions.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        ) : '—'
                      ) : (
                        m.role === 'admin' ? 'Tất cả' : regionName
                      )}
                    </td>
                      <td style={{ ...styles.td, textAlign: 'right', paddingRight: '20px' }}>
                        {isEditing ? (
                          <div style={styles.btnGroup}>
                          <button onClick={() => handleSaveEdit(m)} style={styles.inlineSaveBtn}>
                            ✓ Lưu
                          </button>
                          <button onClick={() => setEditingId(null)} style={styles.inlineCancelBtn}>
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div style={styles.btnGroup}>
                          <button onClick={() => handleStartEdit(m)} style={styles.inlineEditBtn}>
                            Sửa
                          </button>
                          <button onClick={() => handleDeleteMember(m)} style={styles.inlineDeleteBtn}>
                            Xóa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
                {members.length === 0 && (
                  <tr>
                      <td colSpan={7} style={styles.tableEmpty}>
                        {loading ? '⏳ Đang tải thành viên...' : '📭 Dự án hiện chưa có thành viên nào.'}
                      </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 3. CÀI ĐẶT HỆ THỐNG (SettingsView) ─────────────────────────────────────────
// ── 3. VẬN HÀNH (OperationsView) ────────────────────────────────────────────────
// Focus: reporting workflow + completeness + exports.
export function OperationsView() {
  const regions = useDataStore((s) => s.regions);
  const zones = useDataStore((s) => s.zones);
  const assignments = useDataStore((s) => s.assignments);
  const currentProjectId = useAuthStore((s) => s.currentProjectId);
  const currentRegionId = useDataStore((s) => s.currentRegionId);

  const [period, setPeriod] = useState(currentReportPeriod());
  const [loading, setLoading] = useState(false);
  const [districtReports, setDistrictReports] = useState<any[]>([]);
  const [regionFilter, setRegionFilter] = useState<string>('__all__');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadDistrictReports(period, currentProjectId ?? undefined)
      .then((rs) => { if (mounted) setDistrictReports(rs as any); })
      .catch(() => { if (mounted) setDistrictReports([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [period, currentProjectId]);

  const expectedDistrictsByRegion = useMemo(() => {
    const m = new Map<string, Set<number>>();
    const zoneRegion = new Map<string, string | null>();
    for (const z of zones) zoneRegion.set(z.id, (z as any).regionId ?? (z as any).region_id ?? null);
    for (const a of assignments) {
      const rid = zoneRegion.get(a.zoneId) ?? currentRegionId ?? null;
      if (!rid) continue;
      if (!m.has(rid)) m.set(rid, new Set());
      m.get(rid)!.add(a.districtId);
    }
    return m;
  }, [zones, assignments, currentRegionId]);

  const regionOptions = useMemo(() => {
    const ids = Array.from(expectedDistrictsByRegion.keys());
    const list = ids.map((id) => ({ id, name: regions.find((r) => r.id === id)?.name ?? id }));
    list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return list;
  }, [expectedDistrictsByRegion, regions]);

  const rows = useMemo(() => {
    const norm = (r: any) => ({
      id: String(r.id),
      regionId: String(r.regionId ?? r.region_id ?? ''),
      districtId: Number(r.districtId ?? r.district_id ?? -1),
      userId: String(r.userId ?? r.user_id ?? ''),
      customers: Number(r.customers ?? 0),
      orders: Number(r.orders ?? 0),
      note: r.note ?? '',
      updatedAt: String(r.updatedAt ?? r.updated_at ?? ''),
    });

    let list = (districtReports ?? []).map(norm);
    if (regionFilter !== '__all__') list = list.filter((r) => r.regionId === regionFilter);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        String(r.regionId).toLowerCase().includes(q)
        || `c${r.districtId}`.includes(q)
        || String(r.userId).toLowerCase().includes(q)
        || String(r.note ?? '').toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return list;
  }, [districtReports, regionFilter, query]);

  const completion = useMemo(() => {
    const districtKey = (rid: string, did: number) => `${rid}|${did}`;
    const byRegion = new Map<string, { expected: number; submitted: number; missing: number }>();
    const submitted = new Set(rows.map((r) => districtKey(r.regionId, r.districtId)));

    for (const [rid, set] of expectedDistrictsByRegion.entries()) {
      const expected = set.size;
      let submittedCount = 0;
      for (const did of set) if (submitted.has(districtKey(rid, did))) submittedCount += 1;
      byRegion.set(rid, { expected, submitted: submittedCount, missing: Math.max(0, expected - submittedCount) });
    }

    const total = Array.from(byRegion.values()).reduce((acc, r) => ({
      expected: acc.expected + r.expected,
      submitted: acc.submitted + r.submitted,
      missing: acc.missing + r.missing,
    }), { expected: 0, submitted: 0, missing: 0 });

    return { byRegion, total };
  }, [rows, expectedDistrictsByRegion]);

  const downloadCsv = () => {
    const escape = (v: any) => {
      const s = String(v ?? '');
      if (/[\",\\n]/.test(s)) return `\"${s.replace(/\"/g, '\"\"')}\"`;
      return s;
    };
    const header = ['period', 'region_id', 'district_id', 'user_id', 'customers', 'orders', 'note', 'updated_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([period, r.regionId, r.districtId, r.userId, r.customers, r.orders, r.note, r.updatedAt].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrimap_district_reports_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>🧭 Vận hành</h3>

      <div style={{ ...styles.section, padding: 12 }}>
        <div style={styles.opsTopRow}>
          <div style={styles.opsFilters}>
            <label style={styles.opsLabel}>
              <span style={styles.opsLabelTxt}>Tháng</span>
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={styles.opsInput} />
            </label>
            <label style={styles.opsLabel}>
              <span style={styles.opsLabelTxt}>Khu vực</span>
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={styles.opsInput}>
                <option value="__all__">Tất cả</option>
                {regionOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label style={{ ...styles.opsLabel, flex: 1, minWidth: 180 }}>
              <span style={styles.opsLabelTxt}>Tìm</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cụm / user / ghi chú..." style={styles.opsInput} />
            </label>
          </div>
          <div style={styles.opsActions}>
            <button style={styles.opsBtn} onClick={downloadCsv} disabled={rows.length === 0}>Tải CSV</button>
          </div>
        </div>

        <div style={styles.opsKpis}>
          <div style={styles.opsKpiCard}>
            <div style={styles.opsKpiValue}>{completion.total.submitted}/{completion.total.expected}</div>
            <div style={styles.opsKpiLabel}>Cụm đã có báo cáo</div>
          </div>
          <div style={styles.opsKpiCard}>
            <div style={styles.opsKpiValue}>{completion.total.missing}</div>
            <div style={styles.opsKpiLabel}>Cụm thiếu báo cáo</div>
          </div>
          <div style={styles.opsKpiCard}>
            <div style={styles.opsKpiValue}>{rows.reduce((s, r) => s + (Number(r.customers) || 0), 0)}</div>
            <div style={styles.opsKpiLabel}>Tổng khách hàng</div>
          </div>
          <div style={styles.opsKpiCard}>
            <div style={styles.opsKpiValue}>{rows.reduce((s, r) => s + (Number(r.orders) || 0), 0)}</div>
            <div style={styles.opsKpiLabel}>Tổng đơn hàng</div>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Khu vực</th>
                <th style={styles.th}>Cụm</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>Khách hàng</th>
                <th style={styles.th}>Đơn hàng</th>
                <th style={styles.th}>Ghi chú</th>
                <th style={styles.th}>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={7} style={styles.tableEmpty}>Đang tải...</td></tr>)}
              {!loading && rows.slice(0, 200).map((r) => {
                const regionName = regions.find((rr) => rr.id === r.regionId)?.name ?? r.regionId
                return (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}><strong>{regionName || '-'}</strong></td>
                    <td style={styles.td}>C{r.districtId}</td>
                    <td style={styles.td}>{r.userId}</td>
                    <td style={styles.td}>{r.customers}</td>
                    <td style={styles.td}>{r.orders}</td>
                    <td style={styles.td}>{String(r.note || '—')}</td>
                    <td style={styles.td}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString('vi-VN') : '—'}</td>
                  </tr>
                )
              })}
              {!loading && rows.length === 0 && (<tr><td colSpan={7} style={styles.tableEmpty}>Chưa có báo cáo trong kỳ này.</td></tr>)}
              {!loading && rows.length > 200 && (<tr><td colSpan={7} style={styles.tableEmpty}>Đang hiển thị 200 dòng đầu tiên (lọc thêm để xem chi tiết).</td></tr>)}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12 }}>
          <h4 style={{ ...styles.sectionTitle, marginBottom: 8 }}>✅ Tỷ lệ hoàn thành theo khu vực</h4>
          <div style={styles.opsRegionGrid}>
            {regionOptions.map((r) => {
              const stat = completion.byRegion.get(r.id) ?? { expected: 0, submitted: 0, missing: 0 }
              const pct = stat.expected > 0 ? Math.round((stat.submitted / stat.expected) * 100) : 0
              return (
                <div key={r.id} style={styles.opsRegionCard}>
                  <div style={styles.opsRegionName}>{r.name}</div>
                  <div style={styles.opsRegionMeta}>{stat.submitted}/{stat.expected} ({pct}%) · thiếu {stat.missing}</div>
                  <div style={styles.opsBar}><div style={{ ...styles.opsBarFill, width: `${pct}%` }} /></div>
                </div>
              )
            })}
            {regionOptions.length === 0 && (<div style={styles.tableEmpty}>Chưa có khu vực hoặc chưa có cụm kỳ vọng để thống kê.</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState(''); // YYYY-MM-DD
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setDob(profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '');
    setPhone(profile?.phone ?? '');
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const ok = await updateProfile({ full_name: fullName, date_of_birth: dob ? dob : null, phone: phone ? phone : null });
      if (ok) {
        setMsg('✅ Đã cập nhật thông tin cá nhân!');
        // Update dataStore user names if online
        const currentProjectId = useAuthStore.getState().currentProjectId;
        if (supabase && currentProjectId) {
          useDataStore.getState().init(currentProjectId).catch(console.error);
        }
      } else {
        setMsg('❌ Cập nhật thất bại. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setMsg(`❌ Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>⚙️ Cài đặt hệ thống</h3>

      <div style={styles.cardContainer}>
          <h4 style={styles.sectionTitle}>👤 Thông tin cá nhân</h4>
          <form onSubmit={handleSaveProfile} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Email tài khoản:</label>
              <input
                type="email"
                value={profile?.email ?? ''}
                disabled
                style={{ ...styles.formInput, opacity: 0.85, cursor: 'not-allowed' }}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Họ và tên của bạn:</label>
              <input
                type="text"
                placeholder="Nhập họ và tên..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={styles.formInput}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Ngày sinh:</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                style={styles.formInput}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>SĐT:</label>
              <input
                type="tel"
                placeholder="Nhập số điện thoại..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={styles.formInput}
              />
            </div>
            <button type="submit" style={styles.submitBtn} disabled={saving}>
              {saving ? '⏳ Đang lưu...' : '💾 Lưu thông tin cá nhân'}
            </button>
          {msg && <div style={{ fontSize: '13px', marginTop: '8px', color: msg.startsWith('✅') ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{msg}</div>}
        </form>
      </div>

      <div style={{ ...styles.cardContainer, marginTop: '20px' }}>
        <h4 style={styles.sectionTitle}>🎨 Chủ đề hiển thị (Theme)</h4>
        <div style={styles.themeOptions}>
          {(['light', 'dark', 'system'] as const).map((t) => {
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  ...styles.themeBtn,
                  borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                  backgroundColor: active ? 'var(--color-accent-light)' : 'transparent',
                  color: active ? 'var(--color-text)' : 'var(--color-text-2)',
                }}
              >
                {t === 'light' ? '☀️ Sáng' : t === 'dark' ? '🌙 Tối' : '💻 Hệ thống'}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...styles.cardContainer, marginTop: '20px' }}>
        <h4 style={styles.sectionTitle}>🌐 Tiếng Việt cố định</h4>
        <div style={styles.langWrapper}>
          <span style={styles.langLabel}>Dự án chỉ dùng tiếng Việt, không còn tuỳ chọn đổi ngôn ngữ.</span>
        </div>
      </div>
    </div>
  );
}

// ── THỜI TRANG STYLE ────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  viewContainer: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    minHeight: '100%',
  },
  viewHeader: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'var(--color-text)',
    marginBottom: '10px',
  },
  workflowHero: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    padding: '4px 0 2px',
  },
  workflowKicker: {
    fontSize: '12px',
    fontWeight: 800,
    color: 'var(--color-text-2)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  workflowText: {
    maxWidth: '680px',
    color: 'var(--color-text-2)',
    marginTop: '-4px',
  },
  workflowSteps: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  stepOk: {
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
    color: '#047857',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 800,
  },
  stepWarn: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 800,
  },
  summaryGrid: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  card: {
    minWidth: '0',
    padding: '18px 18px 16px',
    backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
  },
  cardWide: {
    flex: '2 1 320px',
  },
  cardNarrow: {
    flex: '1 1 200px',
  },
  cardBadge: {
    width: '46px',
    height: '46px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 900,
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardVal: {
    fontSize: '24px',
    fontWeight: 800,
    color: 'var(--color-text)',
    lineHeight: 1,
  },
  cardLbl: {
    fontSize: '12px',
    color: 'var(--color-text-2)',
    marginTop: '4px',
  },
  section: {
    backgroundColor: 'color-mix(in srgb, var(--color-surface) 94%, transparent)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '20px',
    padding: '20px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 900,
    color: 'var(--color-text)',
    letterSpacing: '-0.01em',
    marginBottom: '4px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px',
  },
  sectionMeta: {
    marginTop: '6px',
    fontSize: '12px',
    color: 'var(--color-text-2)',
    maxWidth: '60ch',
  },
  sectionPill: {
    flexShrink: 0,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-2)',
    padding: '7px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  reportGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  },
  reportCard: {
    padding: '18px 16px',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  tableHeaderRow: {
    borderBottom: '2px solid var(--color-border, #30363d)',
  },
  th: {
    padding: '10px',
    fontWeight: 'bold',
    color: 'var(--color-text-2)',
  },
  tr: {
    borderBottom: '1px solid var(--color-border, #30363d)',
    transition: 'background-color 100ms ease',
  },
  td: {
    padding: '12px 10px',
    color: 'var(--color-text)',
  },
  tableEmpty: {
    textAlign: 'center',
    padding: '20px',
    color: 'var(--color-text-3)',
  },
  cardContainer: {
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '12px',
    padding: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '480px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '12px',
    color: 'var(--color-text-2)',
  },
  formInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-2, #1f2937)',
    border: '1px solid var(--color-border, #30363d)',
    color: 'var(--color-text)',
    fontSize: '13px',
    outline: 'none',
  },
  submitBtn: {
    marginTop: '6px',
    padding: '10px',
    backgroundColor: 'var(--color-accent, #1f6feb)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '13px',
    width: 'fit-content',
  },
  roleBadge: {
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  btnGroup: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'flex-end',
  },
  inlineEditBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-accent)',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  inlineDeleteBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#ef4444',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  inlineSaveBtn: {
    padding: '4px 10px',
    backgroundColor: '#10b981',
    border: 'none',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  inlineCancelBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  inlineSelect: {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontSize: '12px',
  },
  inlineInput: {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontSize: '12px',
    width: '80px',
  },
  themeOptions: {
    display: 'flex',
    gap: '12px',
  },
  themeBtn: {
    flex: 1,
    padding: '12px',
    border: '1.5px solid',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
    transition: 'all 150ms ease',
    maxWidth: '120px',
  },
  langWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  langLabel: {
    fontSize: '13px',
    color: 'var(--color-text-2)',
  },
  langBtn: {
    padding: '8px 16px',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },

  // Operations view
  opsTopRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  opsFilters: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 280,
  },
  opsActions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  opsLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 140,
  },
  opsLabelTxt: {
    fontSize: 12,
    color: 'var(--color-text-2)',
    fontWeight: 800,
  },
  opsInput: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    fontSize: 13,
    fontWeight: 700,
    height: 36,
  },
  opsBtn: {
    padding: '9px 12px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    height: 36,
  },
  opsKpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    margin: '14px 0 14px',
  },
  opsKpiCard: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    borderRadius: 10,
    padding: '12px 12px',
    minWidth: 0,
  },
  opsKpiValue: {
    fontSize: 18,
    fontWeight: 900,
    color: 'var(--color-text)',
    lineHeight: 1.1,
  },
  opsKpiLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text-2)',
  },
  opsRegionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  opsRegionCard: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    borderRadius: 10,
    padding: '10px 12px',
    minWidth: 0,
  },
  opsRegionName: {
    fontSize: 13,
    fontWeight: 900,
    color: 'var(--color-text)',
  },
  opsRegionMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--color-text-2)',
  },
  opsBar: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'rgba(148,163,184,0.35)',
  },
  opsBarFill: {
    height: '100%',
    background: '#22c55e',
    borderRadius: 999,
  },
};
