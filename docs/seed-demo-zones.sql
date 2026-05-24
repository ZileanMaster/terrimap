-- ============================================================
-- TERRIMAP — Seed Demo: 20 HN + 12 HCM = 32 zones
-- Polygons: RECTANGLE grid — zero overlap, zero gap
--
-- Chạy trong Supabase SQL Editor
-- Project: test-project-terrimap
-- ============================================================

-- Xóa TẤT CẢ dữ liệu cũ trong project (bao gồm z01-z12, hp*, v.v.)
DELETE FROM public.activities WHERE zone_id IN (SELECT id FROM public.zones WHERE project_id = 'test-project-terrimap');
DELETE FROM public.assignments WHERE zone_id IN (SELECT id FROM public.zones WHERE project_id = 'test-project-terrimap');
DELETE FROM public.zones WHERE project_id = 'test-project-terrimap';
DELETE FROM public.sales_agents WHERE project_id = 'test-project-terrimap';
-- Xóa agents legacy (không có project_id) cùng id để tránh trùng
DELETE FROM public.sales_agents WHERE id IN ('sa0','sa1','sa2','sa3','sa4','sa5','sa6','sa7') AND project_id IS NULL;

-- ── SALES AGENTS — sa0-sa4: Hà Nội, sa5-sa7: HCM ──────────
INSERT INTO public.sales_agents (id, name, active_region, capacity, project_id) VALUES
  ('sa0', 'Nguyễn Văn A',  'Hà Nội',      400, 'test-project-terrimap'),
  ('sa1', 'Trần Thị B',    'Hà Nội',      500, 'test-project-terrimap'),
  ('sa2', 'Lê Văn C',      'Hà Nội',      600, 'test-project-terrimap'),
  ('sa3', 'Phạm Thị D',    'Hà Nội',      350, 'test-project-terrimap'),
  ('sa4', 'Hoàng Văn E',   'Hà Nội',      450, 'test-project-terrimap'),
  ('sa5', 'Vũ Thị F',      'Hồ Chí Minh', 550, 'test-project-terrimap'),
  ('sa6', 'Đặng Minh G',   'Hồ Chí Minh', 480, 'test-project-terrimap'),
  ('sa7', 'Bùi Thanh H',   'Hồ Chí Minh', 520, 'test-project-terrimap')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, active_region = EXCLUDED.active_region,
  capacity = EXCLUDED.capacity, project_id = EXCLUDED.project_id;

-- ══════════════════════════════════════════════════════════════
-- HÀ NỘI — 20 zones (5×4 rectangle grid)
-- Grid: lat 21.000→21.048, lng 105.810→105.860
-- Cell: 0.012 lat × 0.010 lng ≈ 1.3km × 1.0km
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.zones (id, name, status, polygon, centroid, region_id, project_id) VALUES
('hn01','Phúc Xá','unassigned',
 '{"type":"Polygon","coordinates":[[[105.81,21.036],[105.82,21.036],[105.82,21.048],[105.81,21.048],[105.81,21.036]]]}',
 '{"lat":21.042,"lng":105.815}','test-region-hn','test-project-terrimap'),
('hn02','Trúc Bạch','unassigned',
 '{"type":"Polygon","coordinates":[[[105.82,21.036],[105.83,21.036],[105.83,21.048],[105.82,21.048],[105.82,21.036]]]}',
 '{"lat":21.042,"lng":105.825}','test-region-hn','test-project-terrimap'),
('hn03','Quán Thánh','unassigned',
 '{"type":"Polygon","coordinates":[[[105.83,21.036],[105.84,21.036],[105.84,21.048],[105.83,21.048],[105.83,21.036]]]}',
 '{"lat":21.042,"lng":105.835}','test-region-hn','test-project-terrimap'),
('hn04','Phú Thượng','unassigned',
 '{"type":"Polygon","coordinates":[[[105.84,21.036],[105.85,21.036],[105.85,21.048],[105.84,21.048],[105.84,21.036]]]}',
 '{"lat":21.042,"lng":105.845}','test-region-hn','test-project-terrimap'),
('hn05','Nhật Tân','unassigned',
 '{"type":"Polygon","coordinates":[[[105.85,21.036],[105.86,21.036],[105.86,21.048],[105.85,21.048],[105.85,21.036]]]}',
 '{"lat":21.042,"lng":105.855}','test-region-hn','test-project-terrimap'),

('hn06','Cống Vị','unassigned',
 '{"type":"Polygon","coordinates":[[[105.81,21.024],[105.82,21.024],[105.82,21.036],[105.81,21.036],[105.81,21.024]]]}',
 '{"lat":21.030,"lng":105.815}','test-region-hn','test-project-terrimap'),
('hn07','Ngọc Hà','unassigned',
 '{"type":"Polygon","coordinates":[[[105.82,21.024],[105.83,21.024],[105.83,21.036],[105.82,21.036],[105.82,21.024]]]}',
 '{"lat":21.030,"lng":105.825}','test-region-hn','test-project-terrimap'),
('hn08','Hàng Bông','unassigned',
 '{"type":"Polygon","coordinates":[[[105.83,21.024],[105.84,21.024],[105.84,21.036],[105.83,21.036],[105.83,21.024]]]}',
 '{"lat":21.030,"lng":105.835}','test-region-hn','test-project-terrimap'),
('hn09','Hàng Bạc','unassigned',
 '{"type":"Polygon","coordinates":[[[105.84,21.024],[105.85,21.024],[105.85,21.036],[105.84,21.036],[105.84,21.024]]]}',
 '{"lat":21.030,"lng":105.845}','test-region-hn','test-project-terrimap'),
('hn10','Đồng Xuân','unassigned',
 '{"type":"Polygon","coordinates":[[[105.85,21.024],[105.86,21.024],[105.86,21.036],[105.85,21.036],[105.85,21.024]]]}',
 '{"lat":21.030,"lng":105.855}','test-region-hn','test-project-terrimap'),

('hn11','Láng Thượng','unassigned',
 '{"type":"Polygon","coordinates":[[[105.81,21.012],[105.82,21.012],[105.82,21.024],[105.81,21.024],[105.81,21.012]]]}',
 '{"lat":21.018,"lng":105.815}','test-region-hn','test-project-terrimap'),
('hn12','Ô Chợ Dừa','unassigned',
 '{"type":"Polygon","coordinates":[[[105.82,21.012],[105.83,21.012],[105.83,21.024],[105.82,21.024],[105.82,21.012]]]}',
 '{"lat":21.018,"lng":105.825}','test-region-hn','test-project-terrimap'),
('hn13','Quang Trung','unassigned',
 '{"type":"Polygon","coordinates":[[[105.83,21.012],[105.84,21.012],[105.84,21.024],[105.83,21.024],[105.83,21.012]]]}',
 '{"lat":21.018,"lng":105.835}','test-region-hn','test-project-terrimap'),
('hn14','Phạm Đình Hổ','unassigned',
 '{"type":"Polygon","coordinates":[[[105.84,21.012],[105.85,21.012],[105.85,21.024],[105.84,21.024],[105.84,21.012]]]}',
 '{"lat":21.018,"lng":105.845}','test-region-hn','test-project-terrimap'),
('hn15','Bạch Mai','unassigned',
 '{"type":"Polygon","coordinates":[[[105.85,21.012],[105.86,21.012],[105.86,21.024],[105.85,21.024],[105.85,21.012]]]}',
 '{"lat":21.018,"lng":105.855}','test-region-hn','test-project-terrimap'),

('hn16','Thanh Xuân Bắc','unassigned',
 '{"type":"Polygon","coordinates":[[[105.81,21.0],[105.82,21.0],[105.82,21.012],[105.81,21.012],[105.81,21.0]]]}',
 '{"lat":21.006,"lng":105.815}','test-region-hn','test-project-terrimap'),
('hn17','Khương Đình','unassigned',
 '{"type":"Polygon","coordinates":[[[105.82,21.0],[105.83,21.0],[105.83,21.012],[105.82,21.012],[105.82,21.0]]]}',
 '{"lat":21.006,"lng":105.825}','test-region-hn','test-project-terrimap'),
('hn18','Khương Thượng','unassigned',
 '{"type":"Polygon","coordinates":[[[105.83,21.0],[105.84,21.0],[105.84,21.012],[105.83,21.012],[105.83,21.0]]]}',
 '{"lat":21.006,"lng":105.835}','test-region-hn','test-project-terrimap'),
('hn19','Phương Liệt','unassigned',
 '{"type":"Polygon","coordinates":[[[105.84,21.0],[105.85,21.0],[105.85,21.012],[105.84,21.012],[105.84,21.0]]]}',
 '{"lat":21.006,"lng":105.845}','test-region-hn','test-project-terrimap'),
('hn20','Tương Mai','unassigned',
 '{"type":"Polygon","coordinates":[[[105.85,21.0],[105.86,21.0],[105.86,21.012],[105.85,21.012],[105.85,21.0]]]}',
 '{"lat":21.006,"lng":105.855}','test-region-hn','test-project-terrimap')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,polygon=EXCLUDED.polygon,centroid=EXCLUDED.centroid,
  region_id=EXCLUDED.region_id,project_id=EXCLUDED.project_id;

-- ══════════════════════════════════════════════════════════════
-- TP.HCM — 12 zones (4×3 rectangle grid)
-- Grid: lat 10.775→10.811, lng 106.675→106.715
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.zones (id, name, status, polygon, centroid, region_id, project_id) VALUES
('sg01','Phú Nhuận P1','unassigned',
 '{"type":"Polygon","coordinates":[[[106.675,10.799],[106.685,10.799],[106.685,10.811],[106.675,10.811],[106.675,10.799]]]}',
 '{"lat":10.805,"lng":106.68}','test-region-hcm','test-project-terrimap'),
('sg02','Phú Nhuận P2','unassigned',
 '{"type":"Polygon","coordinates":[[[106.685,10.799],[106.695,10.799],[106.695,10.811],[106.685,10.811],[106.685,10.799]]]}',
 '{"lat":10.805,"lng":106.69}','test-region-hcm','test-project-terrimap'),
('sg03','Phú Nhuận P3','unassigned',
 '{"type":"Polygon","coordinates":[[[106.695,10.799],[106.705,10.799],[106.705,10.811],[106.695,10.811],[106.695,10.799]]]}',
 '{"lat":10.805,"lng":106.70}','test-region-hcm','test-project-terrimap'),
('sg04','Bình Thạnh P1','unassigned',
 '{"type":"Polygon","coordinates":[[[106.705,10.799],[106.715,10.799],[106.715,10.811],[106.705,10.811],[106.705,10.799]]]}',
 '{"lat":10.805,"lng":106.71}','test-region-hcm','test-project-terrimap'),

('sg05','Quận 3 P6','unassigned',
 '{"type":"Polygon","coordinates":[[[106.675,10.787],[106.685,10.787],[106.685,10.799],[106.675,10.799],[106.675,10.787]]]}',
 '{"lat":10.793,"lng":106.68}','test-region-hcm','test-project-terrimap'),
('sg06','Quận 3 P9','unassigned',
 '{"type":"Polygon","coordinates":[[[106.685,10.787],[106.695,10.787],[106.695,10.799],[106.685,10.799],[106.685,10.787]]]}',
 '{"lat":10.793,"lng":106.69}','test-region-hcm','test-project-terrimap'),
('sg07','Quận 3 P12','unassigned',
 '{"type":"Polygon","coordinates":[[[106.695,10.787],[106.705,10.787],[106.705,10.799],[106.695,10.799],[106.695,10.787]]]}',
 '{"lat":10.793,"lng":106.70}','test-region-hcm','test-project-terrimap'),
('sg08','Bình Thạnh P2','unassigned',
 '{"type":"Polygon","coordinates":[[[106.705,10.787],[106.715,10.787],[106.715,10.799],[106.705,10.799],[106.705,10.787]]]}',
 '{"lat":10.793,"lng":106.71}','test-region-hcm','test-project-terrimap'),

('sg09','Bến Nghé','unassigned',
 '{"type":"Polygon","coordinates":[[[106.675,10.775],[106.685,10.775],[106.685,10.787],[106.675,10.787],[106.675,10.775]]]}',
 '{"lat":10.781,"lng":106.68}','test-region-hcm','test-project-terrimap'),
('sg10','Bến Thành','unassigned',
 '{"type":"Polygon","coordinates":[[[106.685,10.775],[106.695,10.775],[106.695,10.787],[106.685,10.787],[106.685,10.775]]]}',
 '{"lat":10.781,"lng":106.69}','test-region-hcm','test-project-terrimap'),
('sg11','Đa Kao','unassigned',
 '{"type":"Polygon","coordinates":[[[106.695,10.775],[106.705,10.775],[106.705,10.787],[106.695,10.787],[106.695,10.775]]]}',
 '{"lat":10.781,"lng":106.70}','test-region-hcm','test-project-terrimap'),
('sg12','Tân Định','unassigned',
 '{"type":"Polygon","coordinates":[[[106.705,10.775],[106.715,10.775],[106.715,10.787],[106.705,10.787],[106.705,10.775]]]}',
 '{"lat":10.781,"lng":106.71}','test-region-hcm','test-project-terrimap')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,polygon=EXCLUDED.polygon,centroid=EXCLUDED.centroid,
  region_id=EXCLUDED.region_id,project_id=EXCLUDED.project_id;

-- ── ACTIVITIES ───────────────────────────────────────────────
INSERT INTO public.activities (id, zone_id, type, value) VALUES
('hn01-c','hn01','CUSTOMER',85), ('hn01-o','hn01','ORDER',55),
('hn02-c','hn02','CUSTOMER',120),('hn02-o','hn02','ORDER',80),
('hn03-c','hn03','CUSTOMER',95), ('hn03-o','hn03','ORDER',65),
('hn04-c','hn04','CUSTOMER',110),('hn04-o','hn04','ORDER',75),
('hn05-c','hn05','CUSTOMER',70), ('hn05-o','hn05','ORDER',45),
('hn06-c','hn06','CUSTOMER',140),('hn06-o','hn06','ORDER',95),
('hn07-c','hn07','CUSTOMER',180),('hn07-o','hn07','ORDER',125),
('hn08-c','hn08','CUSTOMER',310),('hn08-o','hn08','ORDER',220),
('hn09-c','hn09','CUSTOMER',290),('hn09-o','hn09','ORDER',200),
('hn10-c','hn10','CUSTOMER',250),('hn10-o','hn10','ORDER',170),
('hn11-c','hn11','CUSTOMER',160),('hn11-o','hn11','ORDER',110),
('hn12-c','hn12','CUSTOMER',200),('hn12-o','hn12','ORDER',140),
('hn13-c','hn13','CUSTOMER',175),('hn13-o','hn13','ORDER',120),
('hn14-c','hn14','CUSTOMER',220),('hn14-o','hn14','ORDER',155),
('hn15-c','hn15','CUSTOMER',260),('hn15-o','hn15','ORDER',180),
('hn16-c','hn16','CUSTOMER',130),('hn16-o','hn16','ORDER',90),
('hn17-c','hn17','CUSTOMER',150),('hn17-o','hn17','ORDER',100),
('hn18-c','hn18','CUSTOMER',115),('hn18-o','hn18','ORDER',75),
('hn19-c','hn19','CUSTOMER',190),('hn19-o','hn19','ORDER',130),
('hn20-c','hn20','CUSTOMER',210),('hn20-o','hn20','ORDER',145),
('sg01-c','sg01','CUSTOMER',145),('sg01-o','sg01','ORDER',100),
('sg02-c','sg02','CUSTOMER',170),('sg02-o','sg02','ORDER',115),
('sg03-c','sg03','CUSTOMER',130),('sg03-o','sg03','ORDER',85),
('sg04-c','sg04','CUSTOMER',195),('sg04-o','sg04','ORDER',135),
('sg05-c','sg05','CUSTOMER',220),('sg05-o','sg05','ORDER',155),
('sg06-c','sg06','CUSTOMER',280),('sg06-o','sg06','ORDER',195),
('sg07-c','sg07','CUSTOMER',240),('sg07-o','sg07','ORDER',165),
('sg08-c','sg08','CUSTOMER',160),('sg08-o','sg08','ORDER',110),
('sg09-c','sg09','CUSTOMER',350),('sg09-o','sg09','ORDER',250),
('sg10-c','sg10','CUSTOMER',400),('sg10-o','sg10','ORDER',280),
('sg11-c','sg11','CUSTOMER',310),('sg11-o','sg11','ORDER',215),
('sg12-c','sg12','CUSTOMER',270),('sg12-o','sg12','ORDER',185)
ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type, value=EXCLUDED.value;

-- ── VERIFY ───────────────────────────────────────────────────
SELECT 'Zones' AS item, COUNT(*) AS count
FROM public.zones WHERE project_id='test-project-terrimap' AND (id LIKE 'hn%' OR id LIKE 'sg%')
UNION ALL
SELECT 'Activities', COUNT(*) FROM public.activities WHERE zone_id LIKE 'hn%' OR zone_id LIKE 'sg%'
UNION ALL
SELECT 'Agents', COUNT(*) FROM public.sales_agents WHERE project_id='test-project-terrimap';
-- Expected: Zones=32, Activities=64, Agents=6
