import React, { useState, useEffect, useMemo } from 'react';
import { useDataStore } from '../store/dataStore.js';
import { useUIStore } from '../store/uiStore.js';
import { useAuthStore } from '../store/authStore.js';
import { isOnline, supabase } from '../lib/supabase.js';
import { loadDistrictReports, currentPeriod as currentReportPeriod } from '../services/districtReportsDb.js';
import type { DistrictReport } from '../../facades/viewmodels.js';


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

//  1. TỔNG QUAN (OverviewView) 
export function OverviewView() {
  const zones = useDataStore((s) => s.zones);
  const agents = useDataStore((s) => s.agents);
  const regions = useDataStore((s) => s.regions);
  const currentRegionId = useDataStore((s) => s.currentRegionId);
  const setCurrentRegion = useDataStore((s) => s.setCurrentRegion);
  const currentProjectId = useAuthStore((s) => s.currentProjectId);
  const loadMembers = useAuthStore((s) => s.loadMembers);

  const [districtReports, setDistrictReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const reportPeriod = currentReportPeriod();

  useEffect(() => {
    setLoadingReports(true);
    loadDistrictReports(reportPeriod, currentProjectId ?? undefined)
      .then((rs) => setDistrictReports(rs as any))
      .catch(() => setDistrictReports([]))
      .finally(() => setLoadingReports(false));
  }, [reportPeriod, currentProjectId]);

  const regionOptions = useMemo(
    () => regions.map((region) => ({ id: region.id, name: region.name })).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [regions],
  );
  const regionOptionIds = useMemo(() => new Set(regionOptions.map((region) => region.id)), [regionOptions]);

  const selectedRegion = currentRegionId
    ? regions.find((region) => region.id === currentRegionId) ?? null
    : null;
  const selectedRegionLabel = selectedRegion?.name ?? 'Tất cả khu vực';
  const filteredReports = useMemo(
    () => currentRegionId
      ? districtReports.filter((report: any) => (report.regionId ?? report.region_id) === currentRegionId)
      : districtReports,
    [currentRegionId, districtReports],
  );

  const reportStats = useMemo(() => {
    const totalCustomers = filteredReports.reduce((s, r) => s + (Number(r.customers) || 0), 0);
    const totalOrders = filteredReports.reduce((s, r) => s + (Number(r.orders) || 0), 0);
    const totalRevenue = filteredReports.reduce((s, r) => s + (Number((r as any).revenue) || 0), 0);
    const districtKey = (r: any) => `${r.regionId || r.region_id || ''}|${r.districtId || r.district_id || ''}`;
    const districts = new Set(filteredReports.map(districtKey));
    const users = new Set(filteredReports.map((r: any) => String(r.userId || r.user_id || '')));
    const avgCustomers = filteredReports.length > 0 ? totalCustomers / filteredReports.length : 0;
    return {
      totalCustomers,
      totalOrders,
      totalRevenue,
      avgCustomers,
      reportCount: filteredReports.length,
      districtCount: districts.size,
      userCount: users.size,
    };
  }, [filteredReports]);

  const businessRegionStats = useMemo(() => {
    const visibleRegions = currentRegionId
      ? regions.filter((region) => region.id === currentRegionId)
      : regions;

    return visibleRegions.map((region) => {
      const regionZones = zones.filter((zone) => (zone as any).regionId === region.id);
      const regionReports = districtReports.filter((report: any) => (report.regionId ?? report.region_id) === region.id);
      const customers = regionReports.reduce((sum: number, report: any) => sum + (Number(report.customers) || 0), 0);
      const orders = regionReports.reduce((sum: number, report: any) => sum + (Number(report.orders) || 0), 0);
      const revenue = regionReports.reduce((sum: number, report: any) => sum + (Number(report.revenue) || 0), 0);
      const reportedDistricts = new Set(regionReports.map((report: any) => String(report.districtId ?? report.district_id ?? '')));
      const activeUsers = new Set(regionReports.map((report: any) => String(report.userId ?? report.user_id ?? '')));
      const coveragePercent = regionZones.length > 0 ? Math.round((reportedDistricts.size / regionZones.length) * 100) : 0;

      return {
        regionId: region.id,
        regionName: region.name,
        customers,
        orders,
        revenue,
        reportCount: regionReports.length,
        reportedDistricts: reportedDistricts.size,
        coveragePercent,
        activeUsers: activeUsers.size,
      };
    }).sort((a, b) => (b.revenue * 0.001 + b.orders * 2 + b.customers) - (a.revenue * 0.001 + a.orders * 2 + a.customers)).slice(0, 4);
  }, [currentRegionId, districtReports, regions, zones]);

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>Tổng quan dự án</h3>
      <div style={styles.overviewRegionBar}>
        <span style={styles.overviewRegionLabel}>Khu vực đang xem</span>
        <select
          value={currentRegionId && regionOptionIds.has(currentRegionId) ? currentRegionId : '__all__'}
          onChange={(e) => setCurrentRegion(e.target.value === '__all__' ? null : e.target.value)}
          style={styles.overviewRegionSelect}
        >
          <option value="__all__">Tất cả khu vực</option>
          {regionOptions.map((region) => (
            <option key={region.id} value={region.id}>{region.name}</option>
          ))}
        </select>
        <span style={styles.overviewRegionHint}>
          {selectedRegion ? `Đang xem báo cáo của ${selectedRegionLabel}` : 'Đang xem toàn bộ khu vực của dự án'}
        </span>
      </div>

      <div style={styles.summaryGrid}>
        <div style={{ ...styles.card, ...styles.cardWide }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>R</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{regions.length}</span>
            <span style={styles.cardLbl}>Khu vực địa lý</span>
          </div>
        </div>

        <div style={{ ...styles.card, ...styles.cardWide }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>S</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{agents.length}</span>
            <span style={styles.cardLbl}>Nhân sự</span>
          </div>
        </div>

        <div style={{ ...styles.card, ...styles.cardNarrow }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>K</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{reportStats.totalCustomers}</span>
            <span style={styles.cardLbl}>Khách hàng báo cáo</span>
          </div>
        </div>

        <div style={{ ...styles.card, ...styles.cardNarrow }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(129, 140, 248, 0.12)', color: '#818cf8' }}>O</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{reportStats.totalOrders}</span>
            <span style={styles.cardLbl}>Đơn hàng báo cáo</span>
          </div>
        </div>

        <div style={{ ...styles.card, ...styles.cardNarrow }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(244, 114, 182, 0.12)', color: '#f472b6' }}>TB</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{reportStats.avgCustomers.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</span>
            <span style={styles.cardLbl}>Khách hàng trung bình / báo cáo</span>
          </div>
        </div>

        <div style={{ ...styles.card, ...styles.cardNarrow }}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>DT</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{reportStats.totalRevenue.toLocaleString('vi-VN')}</span>
            <span style={styles.cardLbl}>Doanh thu báo cáo</span>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h4 style={styles.sectionTitle}>📍 Hiệu quả kinh doanh theo khu vực</h4>
            <div style={styles.sectionMeta}>Tháng {reportPeriod} · {selectedRegion ? `khu vực ${selectedRegionLabel}` : 'tổng hợp theo toàn bộ khu vực của dự án'}</div>
          </div>
          <div style={styles.sectionPill}>{reportStats.reportCount} dòng báo cáo</div>
        </div>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Khu vực</th>
                <th style={styles.th}>Khách hàng</th>
                <th style={styles.th}>Đơn hàng</th>
                <th style={styles.th}>Doanh thu</th>
                <th style={styles.th}>Số báo cáo</th>
                <th style={styles.th}>Độ phủ báo cáo</th>
                <th style={styles.th}>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {loadingReports && (
                <tr><td colSpan={7} style={styles.tableEmpty}>Đang tải dữ liệu kinh doanh...</td></tr>
              )}
              {!loadingReports && businessRegionStats.map((stat) => (
                <tr key={stat.regionId} style={styles.tr}>
                  <td style={styles.td}><strong>{stat.regionName}</strong></td>
                  <td style={styles.td}>{stat.customers.toLocaleString('vi-VN')}</td>
                  <td style={styles.td}>{stat.orders.toLocaleString('vi-VN')}</td>
                  <td style={styles.td}>{(stat.revenue ?? 0).toLocaleString('vi-VN')}</td>
                  <td style={styles.td}>{stat.reportCount}</td>
                  <td style={styles.td}>{stat.coveragePercent}%</td>
                  <td style={styles.td}>
                    {stat.reportCount === 0
                      ? 'Chưa có dữ liệu'
                      : stat.coveragePercent >= 80
                        ? 'Phủ báo cáo tốt'
                        : 'Cần cải thiện độ phủ'}
                  </td>
                </tr>
              ))}
              {!loadingReports && businessRegionStats.length === 0 && (
                <tr>
                  <td colSpan={7} style={styles.tableEmpty}>
                    📭 {selectedRegion ? `Khu vực ${selectedRegionLabel} chưa có dữ liệu kinh doanh.` : 'Chưa có dữ liệu kinh doanh theo khu vực.'}
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
//  2. QUẢN LÝ USER (UsersView) 
export function UsersView() {
  const currentProjectId = useAuthStore((s) => s.currentProjectId);
  const loadMembers = useAuthStore((s) => s.loadMembers);
  const blockMember = useAuthStore((s) => s.blockMember);
  const unblockMember = useAuthStore((s) => s.unblockMember);
  const regions = useDataStore((s) => s.regions);

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const formatDob = (dob?: string | null) => {
    if (!dob) return '-';
    const s = String(dob).slice(0, 10); // YYYY-MM-DD
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  };

  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('sales');
  const [editRegionId, setEditRegionId] = useState<string>('');

  const activeMembers = useMemo(
    () => members.filter((member) => member.status !== 'blocked'),
    [members],
  );
  const blockedMembers = useMemo(
    () => members.filter((member) => member.status === 'blocked'),
    [members],
  );

  const reloadMembers = async () => {
    if (!supabase || !currentProjectId) {

      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const rawMembers = await loadMembers(true);

      if (!rawMembers || rawMembers.length === 0) {
        setMembers([]);
        return;
      }

      const merged = rawMembers.map((m: any) => ({
        ...m,
        profile: m.profile || { email: m.user_id, full_name: 'Chưa cập nhật' },

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
    if (member.status === 'blocked') {
      alert('Vui lòng bỏ chặn thành viên trước khi chỉnh sửa.')
      return;
    }
    setEditingId(member.id);
    setEditRole(member.role);
    setEditRegionId(member.region_id || '');
  };

  const handleSaveEdit = async (member: any) => {
    if (member.status === 'blocked') {
      alert('Vui lòng bỏ chặn thành viên trước khi lưu chỉnh sửa.')
      return;
    }
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

        if (member.role === 'sales') {
          await supabase.from('assignments').delete().eq('sales_agent_id', member.user_id);
          await supabase.from('sales_agents').delete().eq('id', member.user_id);
        }
      }


      await useDataStore.getState().init(currentProjectId);
      await reloadMembers();
      setEditingId(null);
    } catch (e: any) {
      alert(`❌ Lỗi: ${e.message}`);
    }
  };

  const handleDeleteMember = async (member: any) => {
    if (member.role === 'admin' && activeMembers.filter((m) => m.role === 'admin').length <= 1) {
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

  const handleToggleRestriction = async (member: any) => {
    if (member.status === 'blocked') {
      if (!window.confirm(`Bỏ chặn "${member.profile?.full_name || member.profile?.email}"?`)) return;
      const ok = await unblockMember(member.id);
      if (ok) await reloadMembers();
      return;
    }

    if (member.role === 'admin' && activeMembers.filter((m) => m.role === 'admin').length <= 1) {
      alert('⚠️ Không thể hạn chế quản trị viên duy nhất của dự án.');
      return;
    }

    const reason = window.prompt(`Lý do hạn chế "${member.profile?.full_name || member.profile?.email}" (không bắt buộc):`, '') ?? '';
    if (!window.confirm(`Hạn chế "${member.profile?.full_name || member.profile?.email}" khỏi dự án này?`)) return;
    const ok = await blockMember(member.id, reason);
    if (ok) await reloadMembers();
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Quản trị viên',
    coordinator: 'Điều phối viên',
    sales: 'Nhân sự',
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
              {activeMembers.map((m) => {
                const isEditing = editingId === m.id;
                const regionName = regions.find((r) => r.id === m.region_id)?.name || 'Chưa gán';

                return (
                  <tr key={m.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{m.profile?.email || m.user_id}</strong>
                      </td>
                      <td style={styles.td}>{m.profile?.full_name}</td>
                      <td style={styles.td}>{formatDob(m.profile?.date_of_birth)}</td>
                      <td style={styles.td}>{m.profile?.phone || '-'}</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            style={styles.inlineSelect}
                          >
                            <option value="admin">Quản trị viên</option>
                            <option value="coordinator">Điều phối viên</option>
                            <option value="sales">Nhân sự</option>
                          </select>
                        ) : (
                          <span style={{
                            ...styles.roleBadge,
                            background: m.role === 'admin'
                              ? 'rgba(99,102,241,0.15)'
                              : m.role === 'coordinator'
                                ? 'rgba(52,211,153,0.15)'
                                : 'rgba(251,191,36,0.15)',
                            color: m.role === 'admin'
                              ? '#818cf8'
                              : m.role === 'coordinator'
                                ? '#34d399'
                                : '#fbbf24',
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
                        ) : '-'
                      ) : (
                        m.role === 'admin' ? 'Tất cả' : regionName
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', paddingRight: '20px' }}>
                      {isEditing ? (
                        <div style={styles.btnGroup}>
                          <button onClick={() => handleSaveEdit(m)} style={styles.inlineSaveBtn}>
                            {'Lưu'}
                          </button>
                          <button onClick={() => setEditingId(null)} style={styles.inlineCancelBtn}>
                            {'Huỷ'}
                          </button>
                        </div>
                      ) : (
                        <div style={styles.btnGroup}>
                          <button onClick={() => handleStartEdit(m)} style={styles.inlineEditBtn}>
                            {'Sửa'}
                          </button>
                          <button onClick={() => handleToggleRestriction(m)} style={styles.inlineBlockBtn}>
                            {'Hạn chế'}
                          </button>
                          <button onClick={() => handleDeleteMember(m)} style={styles.inlineDeleteBtn}>
                            {'Xoá'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
                {activeMembers.length === 0 && (
                  <tr>
                      <td colSpan={7} style={styles.tableEmpty}>
                        {loading ? '⏳ Đang tải thành viên...' : '📭 Dự án hiện chưa có thành viên đang hoạt động nào.'}
                      </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.blockedHeader}>
          <div style={styles.blockedTitleRow}>
            <h4 style={styles.blockedTitle}>Danh sách bị hạn chế</h4>
            <span style={styles.blockedCountBadge}>{blockedMembers.length}</span>
          </div>
          <span style={styles.blockedNote}>Các tài khoản này sẽ tách riêng khỏi danh sách đang hoạt động.</span>
        </div>
        {blockedMembers.length === 0 ? (
          <div style={styles.blockedEmpty}>Chưa có thành viên nào bị hạn chế.</div>
        ) : (
          <div style={styles.blockedGrid}>
            {blockedMembers.map((member) => {
              const regionName = regions.find((r) => r.id === member.region_id)?.name || 'Chưa gán';
              return (
                <div key={member.id} style={styles.blockedCard}>
                  <div style={styles.blockedTopRow}>
                    <div>
                      <div style={styles.blockedName}>{member.profile?.full_name || member.profile?.email || member.user_id}</div>
                      <div style={styles.blockedEmail}>{member.profile?.email || member.user_id}</div>
                    </div>
                    <span style={styles.blockedBadge}>🚫 Hạn chế</span>
                  </div>
                  <div style={styles.blockedMetaRow}>
                    <span>Vai trò: {ROLE_LABELS[member.role] || member.role}</span>
                    <span>Khu vực: {member.role === 'admin' ? 'Tất cả' : regionName}</span>
                  </div>
                  <div style={styles.blockedActionRow}>
                    <button
                      onClick={async () => {
                        const ok = await unblockMember(member.id);
                        if (ok) await reloadMembers();
                      }}
                      style={styles.inlineRecoverBtn}
                    >
                      Bỏ hạn chế
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member)}
                      style={styles.inlineDeleteBtn}
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

//  3. CÀI ĐẶT HỆ THỐNG (SettingsView) 
//  3. VẬN HÀNH (OperationsView) 
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
    const list = regions.map((region) => ({ id: region.id, name: region.name }));
    list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return list;
  }, [regions]);

  const selectedRegionLabel = useMemo(() => {
    if (regionFilter === '__all__') return 'Tất cả khu vực';
    return regionOptions.find((region) => region.id === regionFilter)?.name ?? 'Khu vực đã chọn';
  }, [regionFilter, regionOptions]);

  const rows = useMemo(() => {
    const norm = (r: any) => ({
      id: String(r.id),
      regionId: String(r.regionId ?? r.region_id ?? ''),
      districtId: Number(r.districtId ?? r.district_id ?? -1),
      userId: String(r.userId ?? r.user_id ?? ''),
      customers: Number(r.customers ?? 0),
      orders: Number(r.orders ?? 0),
      revenue: Number(r.revenue ?? 0),
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

    for (const region of regions) {
      byRegion.set(region.id, { expected: 0, submitted: 0, missing: 0 });
    }

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
  }, [rows, expectedDistrictsByRegion, regions]);

  useEffect(() => {
    if (currentProjectId !== 'test-project-terrimap') return;
    if (loading) return;
    if (districtReports.length > 0) return;
    if (period !== currentReportPeriod()) return;
    if (regionOptions.length === 0) return;

    const storageKey = `terrimap_district_reports_${currentProjectId}`;
    const seedFlagKey = `terrimap_demo_reports_seeded_${currentProjectId}_${period}`;
    if (localStorage.getItem(seedFlagKey) === '1') return;

    const existingRaw = localStorage.getItem(storageKey) ?? '[]';
    let existing: DistrictReport[] = [];
    try {
      existing = JSON.parse(existingRaw) as DistrictReport[];
    } catch {
      existing = [];
    }

    const regionUsers: Record<string, string> = {
      'test-region-hn': 'coord.test@terrimap.vn',
      'test-region-hcm': 'sales.test@terrimap.vn',
    };
    const fallbackDistricts: Record<string, number[]> = {
      'test-region-hn': [0, 5, 10],
      'test-region-hcm': [0, 1, 2],
    };
    const notes = [
      'Demo: chốt đơn với khách hàng mới',
      'Demo: cập nhật chăm sóc khách hàng',
      'Demo: tăng số đơn trong kỳ',
      'Demo: báo cáo cho buổi trình bày',
      'Demo: đã hoàn tất xác nhận dữ liệu',
    ];

    const seeded: DistrictReport[] = [];
    let noteIndex = 0;
    for (const region of regionOptions) {
      const districtIds = Array.from(expectedDistrictsByRegion.get(region.id) ?? fallbackDistricts[region.id] ?? [])
        .slice(0, 3)
        .sort((a, b) => a - b);
      const userId = regionUsers[region.id] ?? 'demo@terrimap.vn';

      for (const districtId of districtIds) {
        const customers = 24 + ((districtId * 7 + region.name.length) % 31);
        const orders = Math.max(1, Math.round(customers * (0.22 + ((districtId + region.name.length) % 3) * 0.04)));
        const revenue = customers * 75000 + orders * 150000;
        seeded.push({
          id: `demo-dr-${currentProjectId}-${region.id}-${districtId}-${period}-${userId.replace(/[^a-z0-9]+/gi, '').slice(0, 12)}`,
          projectId: currentProjectId ?? undefined,
          regionId: region.id,
          districtId,
          userId,
          period,
          customers,
          orders,
          revenue,
          note: notes[noteIndex % notes.length],
          updatedAt: new Date().toISOString(),
        });
        noteIndex += 1;
      }
    }

    if (seeded.length === 0) return;

    const mergeKey = (r: DistrictReport) => `${r.period}|${r.userId}|${r.regionId}|${r.districtId}`;
    const mergedMap = new Map<string, DistrictReport>();
    for (const report of existing) mergedMap.set(mergeKey(report), report);
    for (const report of seeded) mergedMap.set(mergeKey(report), report);
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    localStorage.setItem(storageKey, JSON.stringify(merged));
    localStorage.setItem(seedFlagKey, '1');
    setDistrictReports(merged);
  }, [currentProjectId, districtReports.length, expectedDistrictsByRegion, loading, period, regionOptions]);

  const downloadCsv = () => {
    const escape = (v: any) => {
      const s = String(v ?? '');
      if (/[\",\\n]/.test(s)) return `\"${s.replace(/\"/g, '\"\"')}\"`;
      return s;
    };
    const header = ['period', 'region_id', 'district_id', 'user_id', 'customers', 'orders', 'revenue', 'note', 'updated_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([period, r.regionId, r.districtId, r.userId, r.customers, r.orders, r.revenue, r.note, r.updatedAt].map(escape).join(','));
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
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
            fontSize: 13,
          }}
        >
          <strong>Vận hành</strong> dùng để theo dõi dữ liệu báo cáo theo tháng và theo khu vực. Bấm vào từng nút khu vực để lọc nhanh, xem ngay bảng dữ liệu và tỷ lệ hoàn thành tương ứng.
        </div>

        <div style={styles.opsTopRow}>
          <div style={styles.opsFilters}>
            <label style={styles.opsLabel}>
              <span style={styles.opsLabelTxt}>Tháng</span>
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={styles.opsInput} />
            </label>
            <div style={styles.opsRegionGroup}>
              <span style={styles.opsLabelTxt}>Khu vực</span>
              <div style={styles.opsRegionChips} role="tablist" aria-label="Lọc khu vực">
                <button
                  type="button"
                  onClick={() => setRegionFilter('__all__')}
                  style={{
                    ...styles.opsRegionChip,
                    ...(regionFilter === '__all__' ? styles.opsRegionChipActive : null),
                  }}
                >
                  Tất cả khu vực
                </button>
                {regionOptions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRegionFilter(r.id)}
                    style={{
                      ...styles.opsRegionChip,
                      ...(regionFilter === r.id ? styles.opsRegionChipActive : null),
                    }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ ...styles.opsLabel, flex: 1, minWidth: 180 }}>
              <span style={styles.opsLabelTxt}>Tìm</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cụm / người dùng / ghi chú..." style={styles.opsInput} />
            </label>
          </div>
          <div style={styles.opsActions}>
            <button style={styles.opsBtn} onClick={downloadCsv} disabled={rows.length === 0}>Tải CSV</button>
          </div>
        </div>

        <div style={{ marginTop: 10, marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: 13 }}>
          Đang xem: <strong>{selectedRegionLabel}</strong> · {rows.length} dòng báo cáo · {completion.total.submitted}/{completion.total.expected} cụm đã có báo cáo
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
          <div style={styles.opsKpiCard}>
            <div style={styles.opsKpiValue}>{rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0).toLocaleString('vi-VN')}</div>
            <div style={styles.opsKpiLabel}>Tổng doanh thu</div>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Khu vực</th>
                <th style={styles.th}>Cụm</th>
                <th style={styles.th}>Người dùng</th>
                <th style={styles.th}>Khách hàng</th>
                <th style={styles.th}>Đơn hàng</th>
                <th style={styles.th}>Doanh thu</th>
                <th style={styles.th}>Ghi chú</th>
                <th style={styles.th}>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={8} style={styles.tableEmpty}>Đang tải dữ liệu...</td></tr>)}
              {!loading && rows.slice(0, 200).map((r) => {
                const regionName = regions.find((rr) => rr.id === r.regionId)?.name ?? r.regionId
                return (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}><strong>{regionName || '-'}</strong></td>
                    <td style={styles.td}>Cụm {r.districtId}</td>
                    <td style={styles.td}>{r.userId}</td>
                    <td style={styles.td}>{r.customers}</td>
                    <td style={styles.td}>{r.orders}</td>
                    <td style={styles.td}>{Number(r.revenue || 0).toLocaleString('vi-VN')}</td>
                    <td style={styles.td}>{String(r.note || '-')}</td>
                    <td style={styles.td}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString('vi-VN') : '-'}</td>
                  </tr>
                )
              })}
              {!loading && rows.length === 0 && (<tr><td colSpan={8} style={styles.tableEmpty}>Chưa có báo cáo trong kỳ này.</td></tr>)}
              {!loading && rows.length > 200 && (<tr><td colSpan={8} style={styles.tableEmpty}>Đang hiển thị 200 dòng đầu tiên (lọc thêm để xem chi tiết).</td></tr>)}
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

    </div>
  );
}

//  THỜI TRANG STYLE 
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
  overviewRegionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '18px',
    padding: '12px 14px',
    border: '1px solid var(--color-border, #30363d)',
    borderRadius: '16px',
    background: 'color-mix(in srgb, var(--color-surface) 94%, transparent)',
  },
  overviewRegionLabel: {
    fontSize: '12px',
    fontWeight: 800,
    color: 'var(--color-text-2)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  overviewRegionSelect: {
    minWidth: '220px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontWeight: 800,
    outline: 'none',
  },
  overviewRegionHint: {
    color: 'var(--color-text-2)',
    fontSize: '13px',
    fontWeight: 600,
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
  blockedHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  blockedTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  blockedTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  blockedCountBadge: {
    minWidth: '28px',
    height: '28px',
    padding: '0 8px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(59,130,246,0.12)',
    color: '#2563eb',
    fontSize: '12px',
    fontWeight: 800,
  },
  blockedNote: {
    color: 'var(--color-text-2)',
    fontSize: '13px',
    fontWeight: 600,
  },
  blockedEmpty: {
    padding: '16px',
    borderRadius: '14px',
    border: '1px dashed var(--color-border)',
    color: 'var(--color-text-2)',
    background: 'var(--color-surface)',
  },
  blockedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '12px',
  },
  blockedCard: {
    padding: '14px',
    borderRadius: '16px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
  },
  blockedTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '10px',
  },
  blockedName: {
    fontSize: '15px',
    fontWeight: 800,
    color: 'var(--color-text)',
  },
  blockedEmail: {
    fontSize: '12px',
    color: 'var(--color-text-2)',
    marginTop: '4px',
    wordBreak: 'break-word',
  },
  blockedBadge: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(148,163,184,0.16)',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  blockedMetaRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: 'var(--color-text-2)',
    fontSize: '13px',
    marginBottom: '12px',
  },
  blockedActionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
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
  inlineBlockBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    color: '#d97706',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  inlineRecoverBtn: {
    padding: '4px 10px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    color: '#10b981',
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
  opsRegionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  opsRegionChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  opsRegionChip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-2)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    height: 36,
  },
  opsRegionChipActive: {
    background: 'var(--color-accent)',
    color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 8px 20px rgba(37, 99, 235, 0.18)',
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
