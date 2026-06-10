-- ═══════════════════════════════════════════════════════════════
-- DEFINITIVE FIX: Break ALL circular RLS references
-- Root cause: projects ↔ project_members cross-referencing
-- Solution: Eliminate ALL cross-table references in RLS
-- ═══════════════════════════════════════════════════════════════

-- ══════════════════════════════════
-- 1. PROJECTS - Only use own columns, NO subquery to project_members
-- ══════════════════════════════════
DROP POLICY IF EXISTS "members_read_project" ON projects;
DROP POLICY IF EXISTS "anyone_create_project" ON projects;
DROP POLICY IF EXISTS "owner_manage_project" ON projects;
DROP POLICY IF EXISTS "owner_delete_project" ON projects;

-- READ: Owner can read + anyone who is a member
-- Use a security-definer function to bypass RLS on project_members
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

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR public.is_project_member(id, auth.uid())
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- ══════════════════════════════════
-- 2. PROJECT_MEMBERS - Use security-definer function for role check
-- ══════════════════════════════════
DROP POLICY IF EXISTS "members_read_members" ON project_members;
DROP POLICY IF EXISTS "admin_coord_invite" ON project_members;
DROP POLICY IF EXISTS "admin_update_members" ON project_members;
DROP POLICY IF EXISTS "admin_delete_members" ON project_members;

-- Helper: check if user is project owner (no RLS involved)
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

-- Helper: check user role in project (bypasses RLS)
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

-- READ: Own rows + owner can see all
CREATE POLICY "pm_select" ON project_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_project_owner(project_id, auth.uid())
  );

-- INSERT: Owner or admin/coordinator can invite
CREATE POLICY "pm_insert" ON project_members
  FOR INSERT WITH CHECK (
    public.is_project_owner(project_id, auth.uid())
    OR public.get_member_role(project_id, auth.uid()) IN ('admin', 'coordinator')
  );

-- UPDATE: Owner or admin
CREATE POLICY "pm_update" ON project_members
  FOR UPDATE USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.get_member_role(project_id, auth.uid()) = 'admin'
  );

-- DELETE: Owner or admin
CREATE POLICY "pm_delete" ON project_members
  FOR DELETE USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.get_member_role(project_id, auth.uid()) = 'admin'
  );

-- ══════════════════════════════════
-- 3. PROFILES - Keep simple, no cross-table
-- ══════════════════════════════════
-- (Already safe - uses auth.uid() = id)

-- VERIFY
SELECT policyname, tablename, cmd FROM pg_policies 
WHERE tablename IN ('project_members', 'projects')
ORDER BY tablename, cmd;
