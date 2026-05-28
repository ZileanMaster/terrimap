/**
 * DashboardViews.tsx — View components for the main Dashboard panels
 */

import React, { useState, useEffect } from 'react';
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
      <div style={styles.cardGrid}>
        {/* Card 1 */}
        <div style={styles.card}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>📍</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{regions.length}</span>
            <span style={styles.cardLbl}>Khu vực Địa lý</span>
          </div>
        </div>

        {/* Card 2 */}
        <div style={styles.card}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>👥</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{agents.length}</span>
            <span style={styles.cardLbl}>Nhân viên Sales</span>
          </div>
        </div>

        {/* Card 3 */}
        <div style={styles.card}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>🏝️</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{totalIslandZones}</span>
            <span style={styles.cardLbl}>Vùng cô lập (Islands)</span>
          </div>
        </div>

        {/* Card 4 */}
        <div style={styles.card}>
          <div style={{ ...styles.cardBadge, backgroundColor: totalContiguityViolations > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(129, 140, 248, 0.15)', color: totalContiguityViolations > 0 ? '#ef4444' : '#818cf8' }}>⚠️</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{totalContiguityViolations}</span>
            <span style={styles.cardLbl}>Vi phạm liên thông</span>
          </div>
        </div>
      </div>

      {/* District Reports Summary */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>ðŸ“ˆ Báo cáo cụm (tháng {reportPeriod})</h4>
        <div style={styles.cardGrid}>
          <div style={styles.card}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>C</div>
            <div style={styles.cardInfo}>
              <span style={styles.cardVal}>{reportStats.totalCustomers}</span>
              <span style={styles.cardLbl}>KH báo cáo</span>
            </div>
          </div>
          <div style={styles.card}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>O</div>
            <div style={styles.cardInfo}>
              <span style={styles.cardVal}>{reportStats.totalOrders}</span>
              <span style={styles.cardLbl}>Đơn báo cáo</span>
            </div>
          </div>
          <div style={styles.card}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#f59e0b' }}>D</div>
            <div style={styles.cardInfo}>
              <span style={styles.cardVal}>{reportStats.districtCount}</span>
              <span style={styles.cardLbl}>Cụm có dữ liệu</span>
            </div>
          </div>
          <div style={styles.card}>
            <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>U</div>
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

  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('sales');
  const [editRegionId, setEditRegionId] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<number>(500);

  const reloadMembers = async () => {
    if (!supabase || !currentProjectId) {
      // Offline/mock mode fallback
      setMembers(MOCK_MEMBERS);
      return;
    }
    setLoading(true);
    try {
      const { data: rawMembers, error } = await supabase
        .from('project_members')
        .select('*')
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
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      // Query capacity
      const { data: agentsData } = await supabase
        .from('sales_agents')
        .select('id, capacity')
        .eq('project_id', currentProjectId);

      const agentMap = new Map((agentsData ?? []).map((a: any) => [a.id, a.capacity]));

      const merged = rawMembers.map((m: any) => ({
        ...m,
        profile: profileMap.get(m.user_id) || { email: m.user_id, full_name: 'Chưa cập nhật' },
        capacity: agentMap.get(m.user_id) || 500,
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
    setEditCapacity(member.capacity || 500);
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
            capacity: editCapacity,
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
        const { error: saError } = await supabase
          .from('sales_agents')
          .upsert({
            id: member.user_id,
            name: member.profile?.full_name || member.profile?.email?.split('@')[0] || 'Sales Agent',
            active_region: activeRegionName,
            capacity: editCapacity,
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
                <th style={styles.th}>Vai trò (Role)</th>
                <th style={styles.th}>Khu vực phụ trách</th>
                <th style={styles.th}>Sức chứa (Capacity)</th>
                <th style={styles.th} style={{ textAlign: 'right', paddingRight: '20px' }}>Thao tác</th>
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
                    <td style={styles.td}>
                      {isEditing ? (
                        editRole === 'sales' ? (
                          <input
                            type="number"
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(Number(e.target.value))}
                            style={styles.inlineInput}
                          />
                        ) : '—'
                      ) : (
                        m.role === 'sales' ? `${m.capacity} KH` : '—'
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
                  <td colSpan={6} style={styles.tableEmpty}>
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
export function SettingsView() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const locale = useUIStore((s) => s.locale);
  const toggleLocale = useUIStore((s) => s.toggleLocale);

  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const ok = await updateProfile(fullName);
      if (ok) {
        setMsg('✅ Đã cập nhật họ tên thành công!');
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
            <label style={styles.formLabel}>Họ và tên của bạn:</label>
            <input
              type="text"
              placeholder="Nhập họ và tên..."
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={styles.formInput}
              required
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
        <h4 style={styles.sectionTitle}>🌐 Ngôn ngữ (Language)</h4>
        <div style={styles.langWrapper}>
          <span style={styles.langLabel}>Ngôn ngữ hiện tại:</span>
          <button onClick={toggleLocale} style={styles.langBtn}>
            {locale === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
          </button>
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
  cardGrid: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: '220px',
    padding: '20px',
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
  },
  cardBadge: {
    width: '46px',
    height: '46px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardVal: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  cardLbl: {
    fontSize: '12px',
    color: 'var(--color-text-2)',
    marginTop: '2px',
  },
  section: {
    backgroundColor: 'var(--color-surface, #161b22)',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '12px',
    padding: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--color-text)',
    marginBottom: '16px',
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
};
