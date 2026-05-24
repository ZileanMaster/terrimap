/**
 * DashboardViews.tsx — View components for the main Dashboard panels
 */

import React, { useState } from 'react';
import { useDataStore } from '../store/dataStore.js';
import { useUIStore } from '../store/uiStore.js';
import { useAuthStore } from '../store/authStore.js';
import MemberManager from '../components/admin/MemberManager.js';
import AgentManager from '../components/agent/AgentManager.js';
import { isOnline } from '../lib/supabase.js';

// ── 1. TỔNG QUAN (OverviewView) ───────────────────────────────────────────────
export function OverviewView() {
  const zones = useDataStore((s) => s.zones);
  const assignments = useDataStore((s) => s.assignments);
  const agents = useDataStore((s) => s.agents);
  const regions = useDataStore((s) => s.regions);

  const assignedCount = assignments.filter((a) => a.districtId >= 0).length;
  const assignmentPercent = zones.length > 0 ? Math.round((assignedCount / zones.length) * 100) : 0;

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>📊 Tổng quan dự án</h3>

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
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>🗺️</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{zones.length}</span>
            <span style={styles.cardLbl}>Tổng số Zone</span>
          </div>
        </div>

        {/* Card 4 */}
        <div style={styles.card}>
          <div style={{ ...styles.cardBadge, backgroundColor: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}>📋</div>
          <div style={styles.cardInfo}>
            <span style={styles.cardVal}>{assignmentPercent}%</span>
            <span style={styles.cardLbl}>Tỷ lệ phân công ({assignedCount}/{zones.length})</span>
          </div>
        </div>
      </div>

      {/* Details Table */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>📍 Danh sách các Khu vực (Regions) đang chạy</h4>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Tên Khu vực</th>
                <th style={styles.th}>Tọa độ Trung tâm</th>
                <th style={styles.th}>Zoom mặc định</th>
                <th style={styles.th}>Số lượng Zones</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => {
                const regionZonesCount = zones.filter((z) => (z as any).regionId === r.id).length;
                return (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}><strong>{r.name}</strong></td>
                    <td style={styles.td}>{r.center.lat.toFixed(4)}, {r.center.lng.toFixed(4)}</td>
                    <td style={styles.td}>{r.zoom}</td>
                    <td style={styles.td}>{regionZonesCount} zones</td>
                  </tr>
                );
              })}
              {regions.length === 0 && (
                <tr>
                  <td colSpan={4} style={styles.tableEmpty}>
                    📭 Chưa cấu hình khu vực nào cho dự án này.
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

// ── 2. QUẢN LÝ KHU VỰC (RegionsView) ─────────────────────────────────────────
export function RegionsView() {
  const regions = useDataStore((s) => s.regions);
  const zones = useDataStore((s) => s.zones);
  const createRegion = (useDataStore.getState() as any).createRegion; // Fallback if exists

  const [name, setName] = useState('');
  const [lat, setLat] = useState('21.03');
  const [lng, setLng] = useState('105.83');
  const [zoom, setZoom] = useState('12');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (createRegion) {
      try {
        await createRegion({
          name,
          center: { lat: parseFloat(lat), lng: parseFloat(lng) },
          zoom: parseInt(zoom),
        });
        setName('');
        alert('✅ Đã tạo khu vực mới thành công!');
      } catch (err: any) {
        alert(`❌ Lỗi: ${err.message}`);
      }
    } else {
      alert('ℹ️ Tính năng tạo khu vực mới yêu cầu kết nối cơ sở dữ liệu Supabase.');
    }
  };

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>📍 Quản lý khu vực</h3>

      <div style={styles.flexLayout}>
        {/* Region List Table */}
        <div style={{ ...styles.cardContainer, flex: 2 }}>
          <h4 style={styles.sectionTitle}>Danh sách Vùng Địa lý</h4>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>Tên Khu vực</th>
                  <th style={styles.th}>Vĩ độ (Lat)</th>
                  <th style={styles.th}>Kinh độ (Lng)</th>
                  <th style={styles.th}>Zoom</th>
                  <th style={styles.th}>Số lượng Zones</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => {
                  const rZones = zones.filter((z) => (z as any).regionId === r.id).length;
                  return (
                    <tr key={r.id} style={styles.tr}>
                      <td style={styles.td}><strong>{r.name}</strong></td>
                      <td style={styles.td}>{r.center.lat.toFixed(4)}</td>
                      <td style={styles.td}>{r.center.lng.toFixed(4)}</td>
                      <td style={styles.td}>{r.zoom}</td>
                      <td style={styles.td}>{rZones} zones</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Creation Form */}
        <div style={{ ...styles.cardContainer, flex: 1, maxHeight: '350px' }}>
          <h4 style={styles.sectionTitle}>➕ Thêm khu vực mới</h4>
          <form onSubmit={handleCreate} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Tên khu vực:</label>
              <input
                type="text"
                placeholder="Ví dụ: Tây Hà Nội"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.formInput}
                required
              />
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Vĩ độ (Lat):</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  style={styles.formInput}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Kinh độ (Lng):</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  style={styles.formInput}
                  required
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Độ phóng (Zoom):</label>
              <input
                type="number"
                min="1"
                max="20"
                value={zoom}
                onChange={(e) => setZoom(e.target.value)}
                style={styles.formInput}
                required
              />
            </div>
            <button type="submit" style={styles.submitBtn}>
              ✓ Lưu khu vực mới
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── 3. QUẢN LÝ USER (UsersView) ──────────────────────────────────────────────
export function UsersView() {
  const agents = useDataStore((s) => s.agents);

  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [agentsModalOpen, setAgentsModalOpen] = useState(false);

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>👥 Quản lý User & Nhân viên</h3>

      <div style={styles.actionsBar}>
        <button onClick={() => setMembersModalOpen(true)} style={styles.actionBtn}>
          👥 Quản lý Thành viên Dự án (Supabase Auth)
        </button>
        <button onClick={() => setAgentsModalOpen(true)} style={{ ...styles.actionBtn, backgroundColor: '#34d399' }}>
          👤 Thêm/Sửa Sales Agents (Database)
        </button>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Danh sách Sales Agents phụ trách</h4>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Tên Sales</th>
                <th style={styles.th}>Khu vực làm việc</th>
                <th style={styles.th}>Sức chứa (Capacity)</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} style={styles.tr}>
                  <td style={styles.td}><code>{a.id}</code></td>
                  <td style={styles.td}><strong>{a.name}</strong></td>
                  <td style={styles.td}>{a.activeRegion}</td>
                  <td style={styles.td}>{a.capacity} KH</td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={4} style={styles.tableEmpty}>
                    📭 Chưa cấu hình nhân viên sales cho dự án này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <MemberManager open={membersModalOpen} onClose={() => setMembersModalOpen(false)} />
      <AgentManager open={agentsModalOpen} onClose={() => setAgentsModalOpen(false)} />
    </div>
  );
}

// ── 4. CÀI ĐẶT HỆ THỐNG (SettingsView) ─────────────────────────────────────────
export function SettingsView() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const locale = useUIStore((s) => s.locale);
  const toggleLocale = useUIStore((s) => s.toggleLocale);

  return (
    <div style={styles.viewContainer}>
      <h3 style={styles.viewHeader}>⚙️ Cài đặt hệ thống</h3>

      <div style={styles.cardContainer}>
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
  flexLayout: {
    display: 'flex',
    gap: '20px',
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
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
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
  },
  actionsBar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '10px',
  },
  actionBtn: {
    padding: '12px 20px',
    backgroundColor: 'var(--color-accent, #1f6feb)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
