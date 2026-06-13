-- TERRIMAP - Project member blocklist / restriction migration
-- Run in Supabase SQL Editor after the base auth migration.

-- 1) Extend project_members with restriction state
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_status_check'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_status_check
      CHECK (status IN ('active', 'blocked'));
  END IF;
END $$;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Helper functions to avoid RLS recursion in policies
CREATE OR REPLACE FUNCTION public.is_project_owner(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project_id
      AND p.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_project_member(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project_id
      AND pm.user_id = auth.uid()
      AND COALESCE(pm.status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_project_admin(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project_id
      AND pm.user_id = auth.uid()
      AND COALESCE(pm.status, 'active') = 'active'
      AND pm.role = 'admin'
  );
$$;

-- 2) Projects are visible only to active members or owners
DROP POLICY IF EXISTS "members_read_project" ON public.projects;
CREATE POLICY "members_read_project" ON public.projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR public.is_active_project_member(id)
  );

-- 3) Members table: active members and owners can read all rows for their project
DROP POLICY IF EXISTS "members_read_members" ON public.project_members;
DROP POLICY IF EXISTS "admin_coord_invite" ON public.project_members;
DROP POLICY IF EXISTS "admin_update_members" ON public.project_members;
DROP POLICY IF EXISTS "admin_delete_members" ON public.project_members;

CREATE POLICY "members_read_members" ON public.project_members
  FOR SELECT USING (
    public.is_active_project_member(project_id)
    OR public.is_project_owner(project_id)
  );

CREATE POLICY "admin_coord_invite" ON public.project_members
  FOR INSERT WITH CHECK (
    public.is_active_project_admin(project_id)
    OR public.is_project_owner(project_id)
  );

CREATE POLICY "admin_update_members" ON public.project_members
  FOR UPDATE USING (
    public.is_active_project_admin(project_id)
    OR public.is_project_owner(project_id)
  );

CREATE POLICY "admin_delete_members" ON public.project_members
  FOR DELETE USING (
    public.is_active_project_admin(project_id)
    OR public.is_project_owner(project_id)
  );
