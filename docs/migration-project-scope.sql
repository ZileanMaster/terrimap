-- ═══════════════════════════════════════════════════════════════
-- Migration: Add project_id + region_id to zones table
-- Required for multi-project scoping and region-based filtering
-- ═══════════════════════════════════════════════════════════════

-- Add columns (nullable for backwards-compatibility with existing data)
ALTER TABLE zones ADD COLUMN IF NOT EXISTS region_id TEXT;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_zones_region' AND table_name = 'zones'
  ) THEN
    ALTER TABLE zones ADD CONSTRAINT fk_zones_region
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_zones_project' AND table_name = 'zones'
  ) THEN
    ALTER TABLE zones ADD CONSTRAINT fk_zones_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Index for fast project-scoped queries
CREATE INDEX IF NOT EXISTS idx_zones_project_id ON zones(project_id);
CREATE INDEX IF NOT EXISTS idx_zones_region_id ON zones(region_id);

-- Also add project_id to activities (via zone, but useful for direct queries)
-- Assignments and agents are project-scoped too
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Add FK for assignments and sales_agents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_assignments_project' AND table_name = 'assignments'
  ) THEN
    ALTER TABLE assignments ADD CONSTRAINT fk_assignments_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_agents_project' AND table_name = 'sales_agents'
  ) THEN
    ALTER TABLE sales_agents ADD CONSTRAINT fk_agents_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_assignments_project_id ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_project_id ON sales_agents(project_id);

-- RLS policies for zones, assignments, agents (project-scoped)
-- Users can only see data for projects they belong to

-- ZONES
DROP POLICY IF EXISTS "zones_select" ON zones;
DROP POLICY IF EXISTS "zones_insert" ON zones;
DROP POLICY IF EXISTS "zones_update" ON zones;
DROP POLICY IF EXISTS "zones_delete" ON zones;

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zones_select" ON zones FOR SELECT USING (
  project_id IS NULL  -- legacy data visible to all
  OR public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "zones_insert" ON zones FOR INSERT WITH CHECK (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "zones_update" ON zones FOR UPDATE USING (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "zones_delete" ON zones FOR DELETE USING (
  public.is_project_owner(project_id, auth.uid())
  OR public.get_member_role(project_id, auth.uid()) IN ('admin', 'coordinator')
);

-- ASSIGNMENTS
DROP POLICY IF EXISTS "assignments_select" ON assignments;
DROP POLICY IF EXISTS "assignments_insert" ON assignments;
DROP POLICY IF EXISTS "assignments_update" ON assignments;
DROP POLICY IF EXISTS "assignments_delete" ON assignments;

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_select" ON assignments FOR SELECT USING (
  project_id IS NULL
  OR public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "assignments_insert" ON assignments FOR INSERT WITH CHECK (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "assignments_update" ON assignments FOR UPDATE USING (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "assignments_delete" ON assignments FOR DELETE USING (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

-- SALES_AGENTS
DROP POLICY IF EXISTS "agents_select" ON sales_agents;
DROP POLICY IF EXISTS "agents_insert" ON sales_agents;
DROP POLICY IF EXISTS "agents_update" ON sales_agents;
DROP POLICY IF EXISTS "agents_delete" ON sales_agents;

ALTER TABLE sales_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_select" ON sales_agents FOR SELECT USING (
  project_id IS NULL
  OR public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "agents_insert" ON sales_agents FOR INSERT WITH CHECK (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "agents_update" ON sales_agents FOR UPDATE USING (
  public.is_project_member(project_id, auth.uid())
  OR public.is_project_owner(project_id, auth.uid())
);

CREATE POLICY "agents_delete" ON sales_agents FOR DELETE USING (
  public.is_project_owner(project_id, auth.uid())
  OR public.get_member_role(project_id, auth.uid()) = 'admin'
);

-- VERIFY
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'zones' AND column_name IN ('region_id', 'project_id');
