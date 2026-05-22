-- ═══════════════════════════════════════════════════════════════
-- Migration: Add project_id to snapshots table
-- Ensures snapshots are scoped per project
-- ═══════════════════════════════════════════════════════════════

-- Add project_id column
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Add foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_snapshots_project' AND table_name = 'snapshots'
  ) THEN
    ALTER TABLE snapshots ADD CONSTRAINT fk_snapshots_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Index for fast project-scoped queries
CREATE INDEX IF NOT EXISTS idx_snapshots_project_id ON snapshots(project_id);

-- RLS policies
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots_select" ON snapshots;
DROP POLICY IF EXISTS "snapshots_insert" ON snapshots;
DROP POLICY IF EXISTS "snapshots_update" ON snapshots;
DROP POLICY IF EXISTS "snapshots_delete" ON snapshots;

CREATE POLICY "snapshots_select" ON snapshots FOR SELECT USING (
  project_id IS NULL
  OR public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "snapshots_insert" ON snapshots FOR INSERT WITH CHECK (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "snapshots_update" ON snapshots FOR UPDATE USING (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "snapshots_delete" ON snapshots FOR DELETE USING (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

-- VERIFY
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'snapshots' AND column_name = 'project_id';
