-- ═══════════════════════════════════════════════════════════════
-- TERRIMAP — HOTFIX: Ensure regions exists + recreate auth trigger
-- Chạy trên Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Tạo bảng regions nếu chưa có (migration-full.sql có thể chưa chạy)
CREATE TABLE IF NOT EXISTS regions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  coordinator_id  TEXT,
  center          JSONB NOT NULL DEFAULT '{"lat":0,"lng":0}',
  zoom            INT NOT NULL DEFAULT 12,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON regions;
CREATE POLICY "Allow all for anon" ON regions FOR ALL USING (true) WITH CHECK (true);

-- 2. Seed 3 regions
INSERT INTO regions (id, name, center, zoom) VALUES
  ('region-hn',  'Hà Nội',           '{"lat":21.03,"lng":105.83}', 12),
  ('region-hcm', 'TP. Hồ Chí Minh',  '{"lat":10.82,"lng":106.63}', 12),
  ('region-hue', 'Huế',              '{"lat":16.46,"lng":107.59}', 13)
ON CONFLICT (id) DO NOTHING;

-- 3. Tạo bảng snapshots nếu chưa có
CREATE TABLE IF NOT EXISTS snapshots (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL DEFAULT 'Untitled',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  period      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS data   JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON snapshots;
CREATE POLICY "Allow all for anon" ON snapshots FOR ALL USING (true) WITH CHECK (true);

-- 4. Tạo bảng zone_monthly_metrics
CREATE TABLE IF NOT EXISTS zone_monthly_metrics (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  zone_id     TEXT NOT NULL,
  period      TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value       NUMERIC NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zone_id, period, metric_type)
);
ALTER TABLE zone_monthly_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON zone_monthly_metrics;
CREATE POLICY "Allow all for anon" ON zone_monthly_metrics FOR ALL USING (true) WITH CHECK (true);

-- 5. Tạo bảng partition_feedback
CREATE TABLE IF NOT EXISTS partition_feedback (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  snapshot_id TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  rating      INT NOT NULL CHECK (rating IN (1, -1)),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id, agent_id)
);
ALTER TABLE partition_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON partition_feedback;
CREATE POLICY "Allow all for anon" ON partition_feedback FOR ALL USING (true) WITH CHECK (true);

-- 6. Thêm region_id FK cho zones (nếu chưa có)
ALTER TABLE zones ADD COLUMN IF NOT EXISTS region_id TEXT REFERENCES regions(id);

-- 7. Gán region cho zones hiện có
UPDATE zones SET region_id = 'region-hn' WHERE region_id IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- AUTH & RBAC (Đảm bảo profiles, projects, project_members)
-- ═══════════════════════════════════════════════════════════════

-- 8. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "service_insert_profile" ON profiles;
CREATE POLICY "service_insert_profile" ON profiles FOR INSERT WITH CHECK (true);

-- 9. Projects
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id    UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 10. Project Members (RBAC)
CREATE TABLE IF NOT EXISTS project_members (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'sales'
              CHECK (role IN ('admin', 'coordinator', 'sales')),
  region_id   TEXT REFERENCES regions(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- 11. Link zones + regions to project
ALTER TABLE zones   ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id);
ALTER TABLE regions ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER — Auto-create profile on signup
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

-- Projects
DROP POLICY IF EXISTS "members_read_project" ON projects;
CREATE POLICY "members_read_project" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "anyone_create_project" ON projects;
CREATE POLICY "anyone_create_project" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_manage_project" ON projects;
CREATE POLICY "owner_manage_project" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_delete_project" ON projects;
CREATE POLICY "owner_delete_project" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- Project Members
DROP POLICY IF EXISTS "members_read_members" ON project_members;
CREATE POLICY "members_read_members" ON project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_coord_invite" ON project_members;
CREATE POLICY "admin_coord_invite" ON project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_update_members" ON project_members;
CREATE POLICY "admin_update_members" ON project_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_delete_members" ON project_members;
CREATE POLICY "admin_delete_members" ON project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members_read_project_profiles" ON profiles;
CREATE POLICY "members_read_project_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm1
      JOIN project_members pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid()
        AND pm2.user_id = profiles.id
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- CLEANUP: Remove failed auth users (from previous signup attempts)
-- ═══════════════════════════════════════════════════════════════
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM profiles);

-- VERIFY
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
