-- ═══════════════════════════════════════════════════════════════
-- TERRIMAP - Unified Database Initialization Script
-- Chạy script này trên Supabase SQL Editor cho dự án mới.
-- ═══════════════════════════════════════════════════════════════

--  1. CẤU TRÚC BẢNG (TABLES) 

-- Bảng profiles (Tài khoản người dùng)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bảng projects (Dự án phân chia vùng)
CREATE TABLE IF NOT EXISTS public.projects (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bảng regions (Các khu vực địa lý lớn)
CREATE TABLE IF NOT EXISTS public.regions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  coordinator_id  TEXT,
  center          JSONB NOT NULL DEFAULT '{"lat":0,"lng":0}',
  zoom            INT NOT NULL DEFAULT 12,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id      TEXT REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Bảng project_members (Thành viên trong dự án - RBAC)
CREATE TABLE IF NOT EXISTS public.project_members (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id  TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'coordinator', 'sales')),
  region_id   TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Bảng zones (Các vùng bán hàng cơ bản)
CREATE TABLE IF NOT EXISTS public.zones (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'unassigned',
  polygon     JSONB NOT NULL,
  centroid    JSONB NOT NULL,
  region_id   TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  project_id  TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bảng sales_agents (Nhân viên bán hàng)
CREATE TABLE IF NOT EXISTS public.sales_agents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  active_region TEXT NOT NULL,
  capacity      INT NOT NULL,
  region_id     TEXT REFERENCES public.regions(id) ON DELETE SET NULL,
  project_id    TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bảng activities (Hoạt động trong zone: CUSTOMER, ORDER, REVENUE)
CREATE TABLE IF NOT EXISTS public.activities (
  id          TEXT PRIMARY KEY,
  zone_id     TEXT NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('CUSTOMER', 'ORDER', 'REVENUE')),
  value       NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bảng assignments (Giao nhiệm vụ zone cho agent trong project)
CREATE TABLE IF NOT EXISTS public.assignments (
  zone_id        TEXT PRIMARY KEY REFERENCES public.zones(id) ON DELETE CASCADE,
  district_id    INT NOT NULL,
  sales_agent_id TEXT NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  project_id     TEXT REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Bảng snapshots (Lịch sử phân vùng của dự án)
CREATE TABLE IF NOT EXISTS public.snapshots (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL DEFAULT 'Untitled',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  period      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id  TEXT REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Bảng zone_monthly_metrics (Chỉ số thực tế theo tháng của từng zone)
CREATE TABLE IF NOT EXISTS public.zone_monthly_metrics (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  zone_id     TEXT NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  period      TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value       NUMERIC NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zone_id, period, metric_type)
);

-- Bảng partition_feedback (Đánh giá phân vùng của Sales)
CREATE TABLE IF NOT EXISTS public.partition_feedback (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  snapshot_id TEXT NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  rating      INT NOT NULL CHECK (rating IN (1, -1)),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id, agent_id)
);

--  2. CHỈ MỤC (INDEXES) 

CREATE INDEX IF NOT EXISTS idx_zones_project_id ON public.zones(project_id);
CREATE INDEX IF NOT EXISTS idx_zones_region_id ON public.zones(region_id);
CREATE INDEX IF NOT EXISTS idx_agents_project_id ON public.sales_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_project_id ON public.assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_project_id ON public.snapshots(project_id);

--  3. HÀM VÀ TRÌNH KÍCH HOẠT (TRIGGERS / FUNCTIONS) 

-- Trigger tự động tạo profile khi đăng ký tài khoản (Auth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Hàm bảo mật kiểm tra thành viên dự án (Bypass RLS tránh vòng lặp)
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;

-- Hàm bảo mật kiểm tra chủ sở hữu dự án (Bypass RLS tránh vòng lặp)
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND owner_id = p_user_id
  );
$$;

-- Hàm lấy vai trò thành viên trong dự án (Bypass RLS tránh vòng lặp)
CREATE OR REPLACE FUNCTION public.get_member_role(p_project_id TEXT, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- Hàm tìm kiếm profile theo email (Để mời thành viên)
CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(lookup_email TEXT)
RETURNS TABLE(id UUID, email TEXT, full_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  WHERE p.email = lookup_email
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(TEXT) TO authenticated;

--  4. CHÍNH SÁCH BẢO MẬT (RLS POLICIES) 

-- Bật Row Level Security cho tất cả các bảng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_monthly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partition_feedback ENABLE ROW LEVEL SECURITY;

-- Cấu hình chính sách cho profiles
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "service_insert_profile" ON public.profiles FOR INSERT WITH CHECK (true);

-- Cấu hình chính sách cho projects
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (owner_id = auth.uid() OR public.is_project_member(id, auth.uid()));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (owner_id = auth.uid());

-- Cấu hình chính sách cho project_members
CREATE POLICY "pm_select" ON public.project_members FOR SELECT USING (public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "pm_insert" ON public.project_members FOR INSERT WITH CHECK (public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) IN ('admin', 'coordinator'));
CREATE POLICY "pm_update" ON public.project_members FOR UPDATE USING (public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) = 'admin');
CREATE POLICY "pm_delete" ON public.project_members FOR DELETE USING (public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) = 'admin');

-- Cấu hình chính sách cho regions (Công khai)
CREATE POLICY "regions_all" ON public.regions FOR ALL USING (true) WITH CHECK (true);

-- Cấu hình chính sách cho zones
CREATE POLICY "zones_select" ON public.zones FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_insert" ON public.zones FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_update" ON public.zones FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_delete" ON public.zones FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) IN ('admin', 'coordinator'));

-- Cấu hình chính sách cho sales_agents
CREATE POLICY "agents_select" ON public.sales_agents FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_insert" ON public.sales_agents FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_update" ON public.sales_agents FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_delete" ON public.sales_agents FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) = 'admin');

-- Cấu hình chính sách cho activities (Công khai/Kế thừa từ zone RLS)
CREATE POLICY "activities_all" ON public.activities FOR ALL USING (true) WITH CHECK (true);

-- Cấu hình chính sách cho assignments
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_update" ON public.assignments FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_delete" ON public.assignments FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));

-- Cấu hình chính sách cho snapshots
CREATE POLICY "snapshots_select" ON public.snapshots FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_insert" ON public.snapshots FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_update" ON public.snapshots FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_delete" ON public.snapshots FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));

-- Cấu hình chính sách cho zone_monthly_metrics
CREATE POLICY "metrics_all" ON public.zone_monthly_metrics FOR ALL USING (true) WITH CHECK (true);

-- Cấu hình chính sách cho partition_feedback
CREATE POLICY "feedback_all" ON public.partition_feedback FOR ALL USING (true) WITH CHECK (true);


--  5. NẠP DỮ LIỆU SEED (SEED DATA) 

-- Seed regions
INSERT INTO public.regions (id, name, center, zoom) VALUES
  ('region-hn',  'Hà Nội',           '{"lat":21.03,"lng":105.83}', 12),
  ('region-hcm', 'TP. Hồ Chí Minh',  '{"lat":10.82,"lng":106.63}', 12),
  ('region-hue', 'Huế',              '{"lat":16.46,"lng":107.59}', 13)
ON CONFLICT (id) DO NOTHING;

-- Seed sales_agents (sa0-sa4: HN, sa5-sa7: HCM)
INSERT INTO public.sales_agents (id, name, active_region, capacity, region_id) VALUES
  ('sa0', 'Nguyễn Văn A',  'Hà Nội',      400, 'region-hn'),
  ('sa1', 'Trần Thị B',    'Hà Nội',      500, 'region-hn'),
  ('sa2', 'Lê Văn C',      'Hà Nội',      600, 'region-hn'),
  ('sa3', 'Phạm Thị D',    'Hà Nội',      350, 'region-hn'),
  ('sa4', 'Hoàng Văn E',   'Hà Nội',      450, 'region-hn'),
  ('sa5', 'Vũ Thị F',      'Hồ Chí Minh', 550, 'region-hcm'),
  ('sa6', 'Đặng Minh G',   'Hồ Chí Minh', 480, 'region-hcm'),
  ('sa7', 'Bùi Thanh H',   'Hồ Chí Minh', 520, 'region-hcm')
ON CONFLICT (id) DO NOTHING;

-- Seed zones
INSERT INTO public.zones (id, name, status, polygon, centroid, region_id) VALUES
  ('z01', 'Tây Hồ', 'unassigned', '{"type":"Polygon","coordinates":[[[105.72,21.08],[105.75999999999999,21.08],[105.75999999999999,21.11],[105.8,21.115],[105.8,21.15],[105.75999999999999,21.154999999999998],[105.72,21.15],[105.72,21.115],[105.72,21.08]]]}'::jsonb, '{"lat":21.119,"lng":105.755}'::jsonb, 'region-hn'),
  ('z02', 'Cầu Giấy', 'unassigned', '{"type":"Polygon","coordinates":[[[105.72,21.01],[105.75999999999999,21.015],[105.8,21.01],[105.8,21.08],[105.75999999999999,21.08],[105.72,21.08],[105.72,21.01]]]}'::jsonb, '{"lat":21.046,"lng":105.76}'::jsonb, 'region-hn'),
  ('z03', 'Nam Từ Liêm', 'unassigned', '{"type":"Polygon","coordinates":[[[105.72,20.94],[105.75999999999999,20.94],[105.8,20.945],[105.8,21.01],[105.75999999999999,21.015],[105.72,21.01],[105.72,20.94]]]}'::jsonb, '{"lat":20.977,"lng":105.76}'::jsonb, 'region-hn'),
  ('z04', 'Long Biên', 'unassigned', '{"type":"Polygon","coordinates":[[[105.88,21.08],[105.91999999999999,21.08],[105.96,21.09],[105.96,21.115],[105.96,21.15],[105.91999999999999,21.145],[105.88,21.15],[105.88,21.08]]]}'::jsonb, '{"lat":21.116,"lng":105.926}'::jsonb, 'region-hn'),
  ('z05', 'Ba Đình', 'unassigned', '{"type":"Polygon","coordinates":[[[105.8,21.01],[105.84,21.01],[105.88,21.01],[105.88,21.045],[105.88,21.08],[105.8,21.08],[105.8,21.05],[105.8,21.01]]]}'::jsonb, '{"lat":21.041,"lng":105.84}'::jsonb, 'region-hn'),
  ('z06', 'Đống Đa', 'unassigned', '{"type":"Polygon","coordinates":[[[105.8,21.115],[105.75999999999999,21.11],[105.75999999999999,21.08],[105.8,21.08],[105.88,21.08],[105.88,21.15],[105.8,21.15],[105.8,21.115]]]}'::jsonb, '{"lat":21.109,"lng":105.811}'::jsonb, 'region-hn'),
  ('z07', 'Hai Bà Trưng', 'unassigned', '{"type":"Polygon","coordinates":[[[105.88,21.01],[105.91999999999999,21.005000000000003],[105.96,21.01],[105.96,21.09],[105.91999999999999,21.08],[105.88,21.08],[105.88,21.045],[105.88,21.01]]]}'::jsonb, '{"lat":21.046,"lng":105.914}'::jsonb, 'region-hn'),
  ('z08', 'Hoàng Mai', 'unassigned', '{"type":"Polygon","coordinates":[[[105.88,20.94],[105.91999999999999,20.945],[105.96,20.94],[105.96,21.01],[105.91999999999999,21.005000000000003],[105.88,21.01],[105.88,20.975],[105.88,20.94]]]}'::jsonb, '{"lat":20.975,"lng":105.914}'::jsonb, 'region-hn'),
  ('z09', 'Thanh Xuân', 'unassigned', '{"type":"Polygon","coordinates":[[[105.8,20.945],[105.84,20.94],[105.88,20.94],[105.88,20.975],[105.88,21.01],[105.84,21.01],[105.8,21.01],[105.8,20.945]]]}'::jsonb, '{"lat":20.976,"lng":105.846}'::jsonb, 'region-hn'),
  ('z10', 'Hà Đông', 'unassigned', '{"type":"Polygon","coordinates":[[[105.8,20.87],[105.84,20.87],[105.88,20.875],[105.88,20.94],[105.84,20.94],[105.8,20.945],[105.8,20.87]]]}'::jsonb, '{"lat":20.907,"lng":105.84}'::jsonb, 'region-hn'),
  ('z11', 'Thanh Trì', 'unassigned', '{"type":"Polygon","coordinates":[[[105.88,20.875],[105.91999999999999,20.87],[105.96,20.87],[105.96,20.905],[105.96,20.94],[105.91999999999999,20.945],[105.88,20.94],[105.88,20.875]]]}'::jsonb, '{"lat":20.906,"lng":105.926}'::jsonb, 'region-hn'),
  ('z12', 'Hoài Đức', 'unassigned', '{"type":"Polygon","coordinates":[[[105.72,20.87],[105.75999999999999,20.875],[105.8,20.87],[105.8,20.945],[105.75999999999999,20.94],[105.72,20.94],[105.72,20.87]]]}'::jsonb, '{"lat":20.907,"lng":105.76}'::jsonb, 'region-hn'),
  ('hcm01', 'Tân Bình', 'unassigned', '{"type":"Polygon","coordinates":[[[106.62,10.84],[106.65,10.84],[106.68,10.84],[106.68,10.86],[106.68,10.88],[106.65,10.885000000000002],[106.62,10.88],[106.62,10.86],[106.62,10.84]]]}'::jsonb, '{"lat":10.861,"lng":106.65}'::jsonb, 'region-hcm'),
  ('hcm02', 'Tân Phú', 'unassigned', '{"type":"Polygon","coordinates":[[[106.68,10.84],[106.71000000000001,10.84],[106.74,10.84],[106.74,10.88],[106.71000000000001,10.88],[106.68,10.88],[106.68,10.86],[106.68,10.84]]]}'::jsonb, '{"lat":10.86,"lng":106.706}'::jsonb, 'region-hcm'),
  ('hcm03', 'Quận 12', 'unassigned', '{"type":"Polygon","coordinates":[[[106.74,10.84],[106.77,10.84],[106.8,10.845],[106.8,10.86],[106.8,10.88],[106.77,10.875],[106.74,10.88],[106.74,10.84]]]}'::jsonb, '{"lat":10.86,"lng":106.774}'::jsonb, 'region-hcm'),
  ('hcm04', 'Gò Vấp', 'unassigned', '{"type":"Polygon","coordinates":[[[106.62,10.8],[106.65,10.805000000000001],[106.68,10.8],[106.68,10.84],[106.65,10.84],[106.62,10.84],[106.62,10.8]]]}'::jsonb, '{"lat":10.821,"lng":106.65}'::jsonb, 'region-hcm'),
  ('hcm05', 'Phú Nhuận', 'unassigned', '{"type":"Polygon","coordinates":[[[106.68,10.8],[106.71000000000001,10.8],[106.74,10.8],[106.74,10.82],[106.74,10.84],[106.71000000000001,10.84],[106.68,10.84],[106.68,10.8]]]}'::jsonb, '{"lat":10.82,"lng":106.714}'::jsonb, 'region-hcm'),
  ('hcm06', 'Bình Thạnh', 'unassigned', '{"type":"Polygon","coordinates":[[[106.74,10.8],[106.77,10.795],[106.8,10.8],[106.8,10.845],[106.77,10.84],[106.74,10.84],[106.74,10.82],[106.74,10.8]]]}'::jsonb, '{"lat":10.82,"lng":106.766}'::jsonb, 'region-hcm'),
  ('hcm07', 'Bình Tân', 'unassigned', '{"type":"Polygon","coordinates":[[[106.62,10.76],[106.65,10.76],[106.68,10.765],[106.68,10.8],[106.65,10.805000000000001],[106.62,10.8],[106.62,10.76]]]}'::jsonb, '{"lat":10.782,"lng":106.65}'::jsonb, 'region-hcm'),
  ('hcm08', 'Quận 1', 'unassigned', '{"type":"Polygon","coordinates":[[[106.68,10.765],[106.71000000000001,10.76],[106.74,10.76],[106.74,10.780000000000001],[106.74,10.8],[106.71000000000001,10.8],[106.68,10.8],[106.68,10.765]]]}'::jsonb, '{"lat":10.781,"lng":106.714}'::jsonb, 'region-hcm'),
  ('hcm09', 'Quận 3', 'unassigned', '{"type":"Polygon","coordinates":[[[106.74,10.76],[106.77,10.765],[106.8,10.76],[106.8,10.8],[106.77,10.795],[106.74,10.8],[106.74,10.780000000000001],[106.74,10.76]]]}'::jsonb, '{"lat":10.78,"lng":106.766}'::jsonb, 'region-hcm'),
  ('hcm10', 'Quận 7', 'unassigned', '{"type":"Polygon","coordinates":[[[106.62,10.72],[106.65,10.725000000000001],[106.68,10.72],[106.68,10.765],[106.65,10.76],[106.62,10.76],[106.62,10.72]]]}'::jsonb, '{"lat":10.742,"lng":106.65}'::jsonb, 'region-hcm'),
  ('hcm11', 'Thủ Đức', 'unassigned', '{"type":"Polygon","coordinates":[[[106.68,10.72],[106.71000000000001,10.72],[106.74,10.725000000000001],[106.74,10.76],[106.71000000000001,10.76],[106.68,10.765],[106.68,10.72]]]}'::jsonb, '{"lat":10.742,"lng":106.71}'::jsonb, 'region-hcm'),
  ('hcm12', 'Quận 2', 'unassigned', '{"type":"Polygon","coordinates":[[[106.74,10.725000000000001],[106.77,10.72],[106.8,10.72],[106.8,10.74],[106.8,10.76],[106.77,10.765],[106.74,10.76],[106.74,10.725000000000001]]]}'::jsonb, '{"lat":10.741,"lng":106.774}'::jsonb, 'region-hcm'),
  ('hue01', 'Kim Long', 'unassigned', '{"type":"Polygon","coordinates":[[[107.54,16.465],[107.555,16.465],[107.57,16.465],[107.57,16.4825],[107.57,16.5],[107.555,16.502],[107.54,16.5],[107.54,16.4825],[107.54,16.465]]]}'::jsonb, '{"lat":16.483,"lng":107.555}'::jsonb, 'region-hue'),
  ('hue02', 'Phú Hội', 'unassigned', '{"type":"Polygon","coordinates":[[[107.57,16.465],[107.585,16.465],[107.6,16.465],[107.6,16.5],[107.585,16.5],[107.57,16.5],[107.57,16.4825],[107.57,16.465]]]}'::jsonb, '{"lat":16.482,"lng":107.583}'::jsonb, 'region-hue'),
  ('hue03', 'Vĩnh Ninh', 'unassigned', '{"type":"Polygon","coordinates":[[[107.6,16.465],[107.615,16.465],[107.63,16.465],[107.63,16.4825],[107.63,16.5],[107.615,16.498],[107.6,16.5],[107.6,16.465]]]}'::jsonb, '{"lat":16.482,"lng":107.617}'::jsonb, 'region-hue'),
  ('hue04', 'Phú Thuận', 'unassigned', '{"type":"Polygon","coordinates":[[[107.63,16.465],[107.645,16.465],[107.66,16.468],[107.66,16.4825],[107.66,16.5],[107.645,16.5],[107.63,16.5],[107.63,16.4825],[107.63,16.465]]]}'::jsonb, '{"lat":16.483,"lng":107.645}'::jsonb, 'region-hue'),
  ('hue05', 'Tây Lộc', 'unassigned', '{"type":"Polygon","coordinates":[[[107.54,16.43],[107.555,16.432],[107.57,16.43],[107.57,16.465],[107.555,16.465],[107.54,16.465],[107.54,16.43]]]}'::jsonb, '{"lat":16.448,"lng":107.555}'::jsonb, 'region-hue'),
  ('hue06', 'Thuận Hoà', 'unassigned', '{"type":"Polygon","coordinates":[[[107.57,16.43],[107.585,16.43],[107.6,16.432],[107.6,16.465],[107.585,16.465],[107.57,16.465],[107.57,16.43]]]}'::jsonb, '{"lat":16.448,"lng":107.585}'::jsonb, 'region-hue'),
  ('hue07', 'Phú Hoà', 'unassigned', '{"type":"Polygon","coordinates":[[[107.6,16.432],[107.615,16.43],[107.63,16.43],[107.63,16.465],[107.615,16.465],[107.6,16.465],[107.6,16.432]]]}'::jsonb, '{"lat":16.448,"lng":107.615}'::jsonb, 'region-hue'),
  ('hue08', 'An Cựu', 'unassigned', '{"type":"Polygon","coordinates":[[[107.63,16.43],[107.645,16.432],[107.66,16.43],[107.66,16.468],[107.645,16.465],[107.63,16.465],[107.63,16.43]]]}'::jsonb, '{"lat":16.448,"lng":107.645}'::jsonb, 'region-hue')
ON CONFLICT (id) DO NOTHING;

-- Seed activities
INSERT INTO public.activities (id, zone_id, type, value) VALUES
  ('a01a', 'z01', 'CUSTOMER', 120),
  ('a01b', 'z01', 'ORDER', 85),
  ('a02a', 'z02', 'CUSTOMER', 200),
  ('a02b', 'z02', 'ORDER', 140),
  ('a02c', 'z02', 'REVENUE', 5000),
  ('a03a', 'z03', 'CUSTOMER', 90),
  ('a03b', 'z03', 'ORDER', 60),
  ('a04a', 'z04', 'CUSTOMER', 310),
  ('a04b', 'z04', 'ORDER', 210),
  ('a05a', 'z05', 'CUSTOMER', 180),
  ('a05b', 'z05', 'ORDER', 130),
  ('a06a', 'z06', 'CUSTOMER', 75),
  ('a06b', 'z06', 'ORDER', 45),
  ('a07a', 'z07', 'CUSTOMER', 250),
  ('a07b', 'z07', 'ORDER', 170),
  ('a08a', 'z08', 'CUSTOMER', 290),
  ('a08b', 'z08', 'ORDER', 200),
  ('a08c', 'z08', 'REVENUE', 7500),
  ('a09a', 'z09', 'CUSTOMER', 220),
  ('a09b', 'z09', 'ORDER', 150),
  ('a10a', 'z10', 'CUSTOMER', 160),
  ('a10b', 'z10', 'ORDER', 110),
  ('a11a', 'z11', 'CUSTOMER', 130),
  ('a11b', 'z11', 'ORDER', 90),
  ('a12a', 'z12', 'CUSTOMER', 95),
  ('a12b', 'z12', 'ORDER', 65),
  ('ahcm01a', 'hcm01', 'CUSTOMER', 180),
  ('ahcm01b', 'hcm01', 'ORDER', 120),
  ('ahcm02a', 'hcm02', 'CUSTOMER', 150),
  ('ahcm02b', 'hcm02', 'ORDER', 95),
  ('ahcm03a', 'hcm03', 'CUSTOMER', 130),
  ('ahcm03b', 'hcm03', 'ORDER', 80),
  ('ahcm04a', 'hcm04', 'CUSTOMER', 260),
  ('ahcm04b', 'hcm04', 'ORDER', 175),
  ('ahcm05a', 'hcm05', 'CUSTOMER', 200),
  ('ahcm05b', 'hcm05', 'ORDER', 140),
  ('ahcm06a', 'hcm06', 'CUSTOMER', 280),
  ('ahcm06b', 'hcm06', 'ORDER', 190),
  ('ahcm07a', 'hcm07', 'CUSTOMER', 170),
  ('ahcm07b', 'hcm07', 'ORDER', 110),
  ('ahcm08a', 'hcm08', 'CUSTOMER', 350),
  ('ahcm08b', 'hcm08', 'ORDER', 250),
  ('ahcm08c', 'hcm08', 'REVENUE', 12000),
  ('ahcm09a', 'hcm09', 'CUSTOMER', 220),
  ('ahcm09b', 'hcm09', 'ORDER', 155),
  ('ahcm10a', 'hcm10', 'CUSTOMER', 300),
  ('ahcm10b', 'hcm10', 'ORDER', 210),
  ('ahcm11a', 'hcm11', 'CUSTOMER', 240),
  ('ahcm11b', 'hcm11', 'ORDER', 165),
  ('ahcm12a', 'hcm12', 'CUSTOMER', 190),
  ('ahcm12b', 'hcm12', 'ORDER', 130),
  ('ahue01a', 'hue01', 'CUSTOMER', 80),
  ('ahue01b', 'hue01', 'ORDER', 55),
  ('ahue02a', 'hue02', 'CUSTOMER', 120),
  ('ahue02b', 'hue02', 'ORDER', 85),
  ('ahue03a', 'hue03', 'CUSTOMER', 95),
  ('ahue03b', 'hue03', 'ORDER', 65),
  ('ahue04a', 'hue04', 'CUSTOMER', 70),
  ('ahue04b', 'hue04', 'ORDER', 45),
  ('ahue05a', 'hue05', 'CUSTOMER', 110),
  ('ahue05b', 'hue05', 'ORDER', 75),
  ('ahue06a', 'hue06', 'CUSTOMER', 140),
  ('ahue06b', 'hue06', 'ORDER', 100),
  ('ahue07a', 'hue07', 'CUSTOMER', 90),
  ('ahue07b', 'hue07', 'ORDER', 60),
  ('ahue08a', 'hue08', 'CUSTOMER', 160),
  ('ahue08b', 'hue08', 'ORDER', 115)
ON CONFLICT (id) DO NOTHING;

-- Seed assignments
INSERT INTO public.assignments (zone_id, district_id, sales_agent_id) VALUES
  ('z01', 0, 'sa0'),
  ('z02', 0, 'sa0'),
  ('z03', 0, 'sa0'),
  ('z04', 1, 'sa1'),
  ('z05', 1, 'sa1'),
  ('z06', 1, 'sa1'),
  ('z07', 2, 'sa2'),
  ('z08', 2, 'sa2'),
  ('z09', 2, 'sa2'),
  ('z10', 3, 'sa3'),
  ('z11', 3, 'sa3'),
  ('z12', 3, 'sa3'),
  ('hcm01', 0, 'sa-hcm0'),
  ('hcm02', 0, 'sa-hcm0'),
  ('hcm03', 0, 'sa-hcm0'),
  ('hcm04', 0, 'sa-hcm0'),
  ('hcm05', 1, 'sa-hcm1'),
  ('hcm06', 1, 'sa-hcm1'),
  ('hcm07', 1, 'sa-hcm1'),
  ('hcm08', 1, 'sa-hcm1'),
  ('hcm09', 2, 'sa-hcm2'),
  ('hcm10', 2, 'sa-hcm2'),
  ('hcm11', 2, 'sa-hcm2'),
  ('hcm12', 2, 'sa-hcm2'),
  ('hue01', 0, 'sa-hue0'),
  ('hue02', 0, 'sa-hue0'),
  ('hue03', 0, 'sa-hue0'),
  ('hue04', 0, 'sa-hue0'),
  ('hue05', 1, 'sa-hue1'),
  ('hue06', 1, 'sa-hue1'),
  ('hue07', 1, 'sa-hue1'),
  ('hue08', 1, 'sa-hue1')
ON CONFLICT (zone_id) DO NOTHING;

-- Cleanup potential auth user mismatches (safety step)
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles);
