-- District reports: user-entered KPIs per cluster (district) per month.
-- Run this in Supabase SQL Editor for the TerriMap project.

CREATE TABLE IF NOT EXISTS public.district_reports (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id  TEXT NULL,
  region_id   TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  district_id INT  NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period      TEXT NOT NULL, -- 'YYYY-MM'
  customers   INT  NOT NULL DEFAULT 0,
  orders      INT  NOT NULL DEFAULT 0,
  note        TEXT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, region_id, district_id, user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_district_reports_project_period ON public.district_reports(project_id, period);
CREATE INDEX IF NOT EXISTS idx_district_reports_region_period  ON public.district_reports(region_id, period);

ALTER TABLE public.district_reports ENABLE ROW LEVEL SECURITY;

-- Read: project members (or legacy NULL project) can read.
DROP POLICY IF EXISTS "district_reports_select" ON public.district_reports;
CREATE POLICY "district_reports_select" ON public.district_reports
  FOR SELECT
  USING (
    project_id IS NULL
    OR public.is_project_member(project_id, auth.uid())
    OR public.is_project_owner(project_id, auth.uid())
  );

-- Write: user can only write their own rows (user_id = auth.uid()) AND must be a project member.
-- Optionally, add stronger checks (e.g., only if user is assigned to that district) later.
DROP POLICY IF EXISTS "district_reports_insert" ON public.district_reports;
CREATE POLICY "district_reports_insert" ON public.district_reports
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR public.is_project_member(project_id, auth.uid())
      OR public.is_project_owner(project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "district_reports_update" ON public.district_reports;
CREATE POLICY "district_reports_update" ON public.district_reports
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR public.is_project_member(project_id, auth.uid())
      OR public.is_project_owner(project_id, auth.uid())
    )
  );

