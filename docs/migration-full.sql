-- ═══════════════════════════════════════════════════════════════
-- TERRIMAP — Full Migration (Phase 1 + 2 + 3)
-- Chạy TOÀN BỘ block này 1 lần trên Supabase SQL Editor
-- Project: bsodtlrpulpmlyrcfdap
-- Date: 2026-04-22
-- ═══════════════════════════════════════════════════════════════

-- 1. Regions table
-- NOTE: coordinator_id không có REFERENCES để tránh circular dependency khi seed
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

-- 2. Snapshots table — đảm bảo có column data + period
CREATE TABLE IF NOT EXISTS snapshots (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL DEFAULT 'Untitled',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  period      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Nếu table đã tồn tại nhưng thiếu columns:
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS data   JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON snapshots;
CREATE POLICY "Allow all for anon" ON snapshots FOR ALL USING (true) WITH CHECK (true);

-- 3. Monthly metrics
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

-- 4. Partition feedback
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

-- 5. Alter existing tables — thêm region_id
ALTER TABLE zones       ADD COLUMN IF NOT EXISTS region_id TEXT REFERENCES regions(id);
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS region_id TEXT REFERENCES regions(id);

-- 6. Seed regions
INSERT INTO regions (id, name, center, zoom) VALUES
  ('region-hn',  'Hà Nội',           '{"lat":21.03,"lng":105.83}', 12),
  ('region-hcm', 'TP. Hồ Chí Minh',  '{"lat":10.82,"lng":106.63}', 12),
  ('region-hue', 'Huế',              '{"lat":16.46,"lng":107.59}', 13)
ON CONFLICT (id) DO NOTHING;

-- 7. Gán region_id cho 12 zones hiện có (tất cả thuộc HN)
UPDATE zones SET region_id = 'region-hn' WHERE region_id IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- VERIFY QUERIES (chạy sau migration để kiểm tra)
-- ═══════════════════════════════════════════════════════════════
-- SELECT id, name FROM regions;                   -- expect 3 rows
-- SELECT count(*) FROM zones WHERE region_id IS NOT NULL;  -- expect 12
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
