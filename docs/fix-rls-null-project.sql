-- Cập nhật chính sách Row Level Security (RLS) để hỗ trợ các hàng không có project_id (NULL) cho người dùng đã đăng nhập

-- ZONES
DROP POLICY IF EXISTS "zones_insert" ON public.zones;
DROP POLICY IF EXISTS "zones_update" ON public.zones;
DROP POLICY IF EXISTS "zones_delete" ON public.zones;

CREATE POLICY "zones_insert" ON public.zones FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_update" ON public.zones FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_delete" ON public.zones FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) IN ('admin', 'coordinator'));

-- SALES_AGENTS
DROP POLICY IF EXISTS "agents_insert" ON public.sales_agents;
DROP POLICY IF EXISTS "agents_update" ON public.sales_agents;
DROP POLICY IF EXISTS "agents_delete" ON public.sales_agents;

CREATE POLICY "agents_insert" ON public.sales_agents FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_update" ON public.sales_agents FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_delete" ON public.sales_agents FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) = 'admin');

-- ASSIGNMENTS
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_delete" ON public.assignments;

CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_update" ON public.assignments FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_delete" ON public.assignments FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));

-- SNAPSHOTS
DROP POLICY IF EXISTS "snapshots_insert" ON public.snapshots;
DROP POLICY IF EXISTS "snapshots_update" ON public.snapshots;
DROP POLICY IF EXISTS "snapshots_delete" ON public.snapshots;

CREATE POLICY "snapshots_insert" ON public.snapshots FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_update" ON public.snapshots FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_delete" ON public.snapshots FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));

-- PROJECTS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;
DROP POLICY IF EXISTS "members_read_project" ON public.projects;
DROP POLICY IF EXISTS "anyone_create_project" ON public.projects;
DROP POLICY IF EXISTS "owner_manage_project" ON public.projects;
DROP POLICY IF EXISTS "owner_delete_project" ON public.projects;

CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (owner_id = auth.uid() OR public.is_project_member(id, auth.uid()));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (owner_id = auth.uid());

-- PROJECT_MEMBERS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_select" ON public.project_members;
DROP POLICY IF EXISTS "pm_insert" ON public.project_members;
DROP POLICY IF EXISTS "pm_update" ON public.project_members;
DROP POLICY IF EXISTS "pm_delete" ON public.project_members;
DROP POLICY IF EXISTS "members_read_members" ON public.project_members;
DROP POLICY IF EXISTS "admin_coord_invite" ON public.project_members;
DROP POLICY IF EXISTS "admin_update_members" ON public.project_members;
DROP POLICY IF EXISTS "admin_delete_members" ON public.project_members;

CREATE POLICY "pm_select" ON public.project_members FOR SELECT USING (user_id = auth.uid() OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "pm_insert" ON public.project_members FOR INSERT WITH CHECK (public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) IN ('admin', 'coordinator'));
CREATE POLICY "pm_update" ON public.project_members FOR UPDATE USING (public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) = 'admin');
CREATE POLICY "pm_delete" ON public.project_members FOR DELETE USING (public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) = 'admin');
