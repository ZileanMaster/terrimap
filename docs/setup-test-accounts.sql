-- ============================================================
-- TERRIMAP — Setup đầy đủ tài khoản test + dữ liệu mẫu
--
-- Chạy SAU KHI đã tạo 3 users trong Supabase Dashboard:
--   admin.test@terrimap.vn  / Test@2025!
--   coord.test@terrimap.vn  / Test@2025!
--   sales.test@terrimap.vn  / Test@2025!
-- ============================================================

DO $$
DECLARE
  v_admin_id   UUID;
  v_coord_id   UUID;
  v_sales_id   UUID;
  v_project_id TEXT := 'test-project-terrimap';
  v_region_hn  TEXT := 'test-region-hn';
  v_region_hcm TEXT := 'test-region-hcm';
BEGIN

  -- ── 1. Lấy user IDs từ auth ──────────────────────────────────
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin.test@terrimap.vn';
  SELECT id INTO v_coord_id FROM auth.users WHERE email = 'coord.test@terrimap.vn';
  SELECT id INTO v_sales_id FROM auth.users WHERE email = 'sales.test@terrimap.vn';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy user admin.test@terrimap.vn — hãy tạo user trong Auth Dashboard trước!';
  END IF;
  IF v_coord_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy user coord.test@terrimap.vn — hãy tạo user trong Auth Dashboard trước!';
  END IF;
  IF v_sales_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy user sales.test@terrimap.vn — hãy tạo user trong Auth Dashboard trước!';
  END IF;

  -- ── 2. Tạo profiles ──────────────────────────────────────────
  INSERT INTO public.profiles (id, email, full_name)
  VALUES
    (v_admin_id, 'admin.test@terrimap.vn',  'Admin Terrimap'),
    (v_coord_id, 'coord.test@terrimap.vn',  'Điều Phối Test'),
    (v_sales_id, 'sales.test@terrimap.vn',  'Nhân Viên Test')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email     = EXCLUDED.email;

  -- ── 3. Tạo project test ───────────────────────────────────────
  INSERT INTO public.projects (id, name, description, owner_id)
  VALUES (
    v_project_id,
    'Dự án Test - TerriMap',
    'Dự án dùng để kiểm thử tất cả chức năng hệ thống',
    v_admin_id
  ) ON CONFLICT (id) DO NOTHING;

  -- ── 4. Tạo regions ────────────────────────────────────────────
  INSERT INTO public.regions (id, name, center, zoom, project_id)
  VALUES
    (v_region_hn,  'Hà Nội',       '{"lat":21.0285,"lng":105.8542}', 11, v_project_id),
    (v_region_hcm, 'Hồ Chí Minh',  '{"lat":10.7769,"lng":106.7009}', 11, v_project_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 5. Thêm thành viên vào project ───────────────────────────
  INSERT INTO public.project_members (project_id, user_id, role, region_id)
  VALUES
    (v_project_id, v_admin_id, 'admin',       NULL),           -- Admin: toàn quyền
    (v_project_id, v_coord_id, 'coordinator', v_region_hn),    -- Coordinator: phụ trách HN
    (v_project_id, v_sales_id, 'sales',       v_region_hcm)    -- Sales: phụ trách HCM
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role      = EXCLUDED.role,
    region_id = EXCLUDED.region_id;

  -- ── 6. Tạo sales agents mẫu ──────────────────────────────────
  INSERT INTO public.sales_agents (id, name, active_region, capacity, region_id, project_id)
  VALUES
    ('agent-test-01', 'Nguyễn Văn A',  'Hà Nội',       150, v_region_hn,  v_project_id),
    ('agent-test-02', 'Trần Thị B',    'Hà Nội',       120, v_region_hn,  v_project_id),
    ('agent-test-03', 'Lê Văn C',      'Hà Nội',       130, v_region_hn,  v_project_id),
    ('agent-test-04', 'Phạm Thị D',    'Hồ Chí Minh',  160, v_region_hcm, v_project_id),
    ('agent-test-05', 'Hoàng Văn E',   'Hồ Chí Minh',  140, v_region_hcm, v_project_id),
    ('agent-test-06', 'Ngô Thị F',     'Hồ Chí Minh',  110, v_region_hcm, v_project_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 7. Tạo zones mẫu (Hà Nội) ────────────────────────────────
  INSERT INTO public.zones (id, name, status, polygon, centroid, region_id, project_id)
  VALUES
    ('test-z01', 'Hoàn Kiếm',   'unassigned',
      '{"type":"Polygon","coordinates":[[[105.843,21.020],[105.860,21.020],[105.860,21.040],[105.843,21.040],[105.843,21.020]]]}',
      '{"lat":21.030,"lng":105.851}', v_region_hn, v_project_id),
    ('test-z02', 'Đống Đa',     'unassigned',
      '{"type":"Polygon","coordinates":[[[105.820,21.020],[105.843,21.020],[105.843,21.045],[105.820,21.045],[105.820,21.020]]]}',
      '{"lat":21.032,"lng":105.831}', v_region_hn, v_project_id),
    ('test-z03', 'Ba Đình',     'unassigned',
      '{"type":"Polygon","coordinates":[[[105.820,21.045],[105.843,21.045],[105.843,21.065],[105.820,21.065],[105.820,21.045]]]}',
      '{"lat":21.055,"lng":105.831}', v_region_hn, v_project_id),
    ('test-z04', 'Tây Hồ',      'unassigned',
      '{"type":"Polygon","coordinates":[[[105.800,21.065],[105.830,21.065],[105.830,21.090],[105.800,21.090],[105.800,21.065]]]}',
      '{"lat":21.077,"lng":105.815}', v_region_hn, v_project_id),
    ('test-z05', 'Cầu Giấy',    'unassigned',
      '{"type":"Polygon","coordinates":[[[105.780,21.020],[105.820,21.020],[105.820,21.045],[105.780,21.045],[105.780,21.020]]]}',
      '{"lat":21.032,"lng":105.800}', v_region_hn, v_project_id),
    ('test-z06', 'Thanh Xuân',  'unassigned',
      '{"type":"Polygon","coordinates":[[[105.820,20.990],[105.860,20.990],[105.860,21.020],[105.820,21.020],[105.820,20.990]]]}',
      '{"lat":21.005,"lng":105.840}', v_region_hn, v_project_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 8. Tạo activities mẫu ─────────────────────────────────────
  INSERT INTO public.activities (id, zone_id, type, value)
  VALUES
    ('tact-01a', 'test-z01', 'CUSTOMER', 245),
    ('tact-01b', 'test-z01', 'ORDER',    180),
    ('tact-01c', 'test-z01', 'REVENUE',  9800),
    ('tact-02a', 'test-z02', 'CUSTOMER', 312),
    ('tact-02b', 'test-z02', 'ORDER',    220),
    ('tact-03a', 'test-z03', 'CUSTOMER', 198),
    ('tact-03b', 'test-z03', 'ORDER',    145),
    ('tact-04a', 'test-z04', 'CUSTOMER', 167),
    ('tact-04b', 'test-z04', 'ORDER',    120),
    ('tact-05a', 'test-z05', 'CUSTOMER', 289),
    ('tact-05b', 'test-z05', 'ORDER',    200),
    ('tact-05c', 'test-z05', 'REVENUE',  12500),
    ('tact-06a', 'test-z06', 'CUSTOMER', 221),
    ('tact-06b', 'test-z06', 'ORDER',    160)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ Setup hoàn tất!';
  RAISE NOTICE '   Admin:       admin.test@terrimap.vn / Test@2025!';
  RAISE NOTICE '   Coordinator: coord.test@terrimap.vn / Test@2025!';
  RAISE NOTICE '   Sales:       sales.test@terrimap.vn / Test@2025!';
  RAISE NOTICE '   Project ID:  %', v_project_id;

END $$;

-- ── Kiểm tra kết quả ─────────────────────────────────────────────
SELECT
  pm.role,
  p.email,
  p.full_name,
  r.name AS region
FROM public.project_members pm
JOIN public.profiles p ON p.id = pm.user_id
LEFT JOIN public.regions r ON r.id = pm.region_id
WHERE pm.project_id = 'test-project-terrimap'
ORDER BY pm.role;
