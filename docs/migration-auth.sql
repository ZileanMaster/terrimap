-- ═══════════════════════════════════════════════════════════════
-- TERRIMAP — Auth & Project RBAC Migration
-- Run trên Supabase SQL Editor SAU migration-full.sql
-- Project: bsodtlrpulpmlyrcfdap
-- ═══════════════════════════════════════════════════════════════

-- 1. Profiles — auto-created on signup
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow insert for the trigger (SECURITY DEFINER handles this)
CREATE POLICY "service_insert_profile" ON profiles
  FOR INSERT WITH CHECK (true);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id    UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 3. Project Members (RBAC)
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

-- 4. Link zones + regions to project
ALTER TABLE zones   ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id);
ALTER TABLE regions ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Auto-create profile on signup
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

-- Drop trigger if exists then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

-- Projects: members can read their projects
CREATE POLICY "members_read_project" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

-- Projects: anyone can create (they become owner)
CREATE POLICY "anyone_create_project" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Projects: owner can update/delete
CREATE POLICY "owner_manage_project" ON projects
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "owner_delete_project" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- Project Members: members can read all members in their project
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

-- Project Members: admin + coordinator can invite
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

-- Project Members: admin can update roles
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

-- Project Members: admin can remove members
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

-- Allow members to read profiles of other members in their project
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
-- VERIFY
-- ═══════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
-- Expected: profiles, projects, project_members (+ existing tables)
