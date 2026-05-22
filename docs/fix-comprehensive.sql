-- TERRIMAP - Comprehensive Fix: Profile + RLS Policies
-- Chay toan bo script nay trong Supabase SQL Editor.

-- 1. HAM HELPER SECURITY DEFINER (phai chay truoc RLS)

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id TEXT, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id TEXT, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND owner_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_member_role(p_project_id TEXT, p_user_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT role FROM public.project_members WHERE project_id = p_project_id AND user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(lookup_email TEXT)
RETURNS TABLE(id UUID, email TEXT, full_name TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT p.id, p.email, p.full_name FROM public.profiles p WHERE p.email = lookup_email LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(TEXT) TO authenticated;

-- 2. TRIGGER TU DONG TAO PROFILE KHI DANG KY

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. BO SUNG PROFILE CHO USER DA TON TAI NHUNG CHUA CO PROFILE

INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles p
SET full_name = split_part(p.email, '@', 1)
WHERE p.full_name = '' OR p.full_name IS NULL;

-- 4. RLS POLICIES CHO PROFILES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "service_insert_profile" ON public.profiles;
DROP POLICY IF EXISTS "members_read_project_profiles" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "service_insert_profile" ON public.profiles FOR INSERT WITH CHECK (true);

-- 5. RLS POLICIES CHO PROJECTS

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

-- 6. RLS POLICIES CHO PROJECT_MEMBERS

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

-- 7. RLS POLICIES CHO ZONES

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zones_select" ON public.zones;
DROP POLICY IF EXISTS "zones_insert" ON public.zones;
DROP POLICY IF EXISTS "zones_update" ON public.zones;
DROP POLICY IF EXISTS "zones_delete" ON public.zones;
DROP POLICY IF EXISTS "Allow all for anon" ON public.zones;
CREATE POLICY "zones_select" ON public.zones FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_insert" ON public.zones FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_update" ON public.zones FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "zones_delete" ON public.zones FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) IN ('admin', 'coordinator'));

-- 8. RLS POLICIES CHO SALES_AGENTS

ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agents_select" ON public.sales_agents;
DROP POLICY IF EXISTS "agents_insert" ON public.sales_agents;
DROP POLICY IF EXISTS "agents_update" ON public.sales_agents;
DROP POLICY IF EXISTS "agents_delete" ON public.sales_agents;
DROP POLICY IF EXISTS "Allow all for anon" ON public.sales_agents;
CREATE POLICY "agents_select" ON public.sales_agents FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_insert" ON public.sales_agents FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_update" ON public.sales_agents FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "agents_delete" ON public.sales_agents FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_owner(project_id, auth.uid()) OR public.get_member_role(project_id, auth.uid()) = 'admin');

-- 9. RLS POLICIES CHO ASSIGNMENTS

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_delete" ON public.assignments;
DROP POLICY IF EXISTS "Allow all for anon" ON public.assignments;
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_update" ON public.assignments FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "assignments_delete" ON public.assignments FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));

-- 10. RLS POLICIES CHO SNAPSHOTS

ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "snapshots_select" ON public.snapshots;
DROP POLICY IF EXISTS "snapshots_insert" ON public.snapshots;
DROP POLICY IF EXISTS "snapshots_update" ON public.snapshots;
DROP POLICY IF EXISTS "snapshots_delete" ON public.snapshots;
DROP POLICY IF EXISTS "Allow all for anon" ON public.snapshots;
CREATE POLICY "snapshots_select" ON public.snapshots FOR SELECT USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_insert" ON public.snapshots FOR INSERT WITH CHECK ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_update" ON public.snapshots FOR UPDATE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));
CREATE POLICY "snapshots_delete" ON public.snapshots FOR DELETE USING ((project_id IS NULL AND auth.uid() IS NOT NULL) OR public.is_project_member(project_id, auth.uid()) OR public.is_project_owner(project_id, auth.uid()));

-- 11. RLS POLICIES CHO CAC BANG CON LAI

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "regions_all" ON public.regions;
DROP POLICY IF EXISTS "Allow all for anon" ON public.regions;
CREATE POLICY "regions_all" ON public.regions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_all" ON public.activities;
DROP POLICY IF EXISTS "Allow all for anon" ON public.activities;
CREATE POLICY "activities_all" ON public.activities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.zone_monthly_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metrics_all" ON public.zone_monthly_metrics;
DROP POLICY IF EXISTS "Allow all for anon" ON public.zone_monthly_metrics;
CREATE POLICY "metrics_all" ON public.zone_monthly_metrics FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partition_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_all" ON public.partition_feedback;
DROP POLICY IF EXISTS "Allow all for anon" ON public.partition_feedback;
CREATE POLICY "feedback_all" ON public.partition_feedback FOR ALL USING (true) WITH CHECK (true);

-- 12. KIEM TRA KET QUA

SELECT id, email, full_name FROM public.profiles LIMIT 10;
SELECT policyname, tablename, cmd FROM pg_policies WHERE tablename IN ('profiles', 'projects', 'project_members') ORDER BY tablename, cmd;
