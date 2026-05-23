-- ============================================================
-- FIX: Cập nhật center coordinates của tất cả regions
-- đang bị lưu sai tọa độ Đà Nẵng (16.047, 108.206)
--
-- Chạy script này trong Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Bước 1: Kiểm tra regions hiện tại (xem trước khi update)
SELECT id, name, center, zoom FROM public.regions ORDER BY name;

-- Bước 2: Update center theo tên tỉnh (34 tỉnh sau sáp nhập 01/07/2025)
-- Script dùng ILIKE để match tên không phân biệt hoa/thường và dấu

UPDATE public.regions SET center = '{"lat":21.0285,"lng":105.8542}'::jsonb, zoom = 11 WHERE name ILIKE '%hà nội%' OR name ILIKE '%ha noi%';
UPDATE public.regions SET center = '{"lat":20.8449,"lng":106.6881}'::jsonb, zoom = 12 WHERE name ILIKE '%hải phòng%' OR name ILIKE '%hai phong%';
UPDATE public.regions SET center = '{"lat":21.0064,"lng":107.2925}'::jsonb, zoom = 11 WHERE name ILIKE '%quảng ninh%' OR name ILIKE '%quang ninh%';
UPDATE public.regions SET center = '{"lat":22.6666,"lng":106.2638}'::jsonb, zoom = 11 WHERE name ILIKE '%cao bằng%' OR name ILIKE '%cao bang%';
UPDATE public.regions SET center = '{"lat":21.8537,"lng":106.7614}'::jsonb, zoom = 11 WHERE name ILIKE '%lạng sơn%' OR name ILIKE '%lang son%';
UPDATE public.regions SET center = '{"lat":21.3860,"lng":103.0177}'::jsonb, zoom = 11 WHERE name ILIKE '%điện biên%' OR name ILIKE '%dien bien%';
UPDATE public.regions SET center = '{"lat":21.3256,"lng":103.9140}'::jsonb, zoom = 11 WHERE name ILIKE '%sơn la%' OR name ILIKE '%son la%';
UPDATE public.regions SET center = '{"lat":22.3964,"lng":103.4580}'::jsonb, zoom = 11 WHERE name ILIKE '%lai châu%' OR name ILIKE '%lai chau%';
UPDATE public.regions SET center = '{"lat":22.4856,"lng":103.9754}'::jsonb, zoom = 11 WHERE name ILIKE '%lào cai%' OR name ILIKE '%lao cai%';
UPDATE public.regions SET center = '{"lat":21.7767,"lng":105.2280}'::jsonb, zoom = 11 WHERE name ILIKE '%tuyên quang%' OR name ILIKE '%tuyen quang%';
UPDATE public.regions SET center = '{"lat":21.5942,"lng":105.8480}'::jsonb, zoom = 11 WHERE name ILIKE '%thái nguyên%' OR name ILIKE '%thai nguyen%';
UPDATE public.regions SET center = '{"lat":21.3450,"lng":105.2415}'::jsonb, zoom = 11 WHERE name ILIKE '%phú thọ%' OR name ILIKE '%phu tho%';
UPDATE public.regions SET center = '{"lat":21.1861,"lng":106.0763}'::jsonb, zoom = 12 WHERE name ILIKE '%bắc ninh%' OR name ILIKE '%bac ninh%';
UPDATE public.regions SET center = '{"lat":20.2506,"lng":105.9745}'::jsonb, zoom = 12 WHERE name ILIKE '%ninh bình%' OR name ILIKE '%ninh binh%';
UPDATE public.regions SET center = '{"lat":19.8079,"lng":105.7851}'::jsonb, zoom = 11 WHERE name ILIKE '%thanh hóa%' OR name ILIKE '%thanh hoa%';
UPDATE public.regions SET center = '{"lat":19.2342,"lng":104.9200}'::jsonb, zoom = 11 WHERE name ILIKE '%nghệ an%' OR name ILIKE '%nghe an%';
UPDATE public.regions SET center = '{"lat":18.3559,"lng":105.8877}'::jsonb, zoom = 11 WHERE name ILIKE '%hà tĩnh%' OR name ILIKE '%ha tinh%';
UPDATE public.regions SET center = '{"lat":17.4689,"lng":106.6219}'::jsonb, zoom = 11 WHERE name ILIKE '%quảng bình%' OR name ILIKE '%quang binh%';
UPDATE public.regions SET center = '{"lat":16.4637,"lng":107.5909}'::jsonb, zoom = 12 WHERE name ILIKE '%huế%' OR name ILIKE '%hue%' OR name ILIKE '%thừa thiên%';
UPDATE public.regions SET center = '{"lat":16.0471,"lng":108.2068}'::jsonb, zoom = 12 WHERE name ILIKE '%đà nẵng%' OR name ILIKE '%da nang%';
UPDATE public.regions SET center = '{"lat":15.1214,"lng":108.8076}'::jsonb, zoom = 11 WHERE name ILIKE '%quảng ngãi%' OR name ILIKE '%quang ngai%';
UPDATE public.regions SET center = '{"lat":13.0882,"lng":109.0929}'::jsonb, zoom = 11 WHERE name ILIKE '%phú yên%' OR name ILIKE '%phu yen%';
UPDATE public.regions SET center = '{"lat":11.9465,"lng":108.4420}'::jsonb, zoom = 11 WHERE name ILIKE '%lâm đồng%' OR name ILIKE '%lam dong%';
UPDATE public.regions SET center = '{"lat":13.9816,"lng":108.0000}'::jsonb, zoom = 11 WHERE name ILIKE '%gia lai%' OR name ILIKE '%kon tum%';
UPDATE public.regions SET center = '{"lat":12.7100,"lng":108.2378}'::jsonb, zoom = 11 WHERE name ILIKE '%đắk lắk%' OR name ILIKE '%dak lak%' OR name ILIKE '%đắk nông%';
UPDATE public.regions SET center = '{"lat":10.7769,"lng":106.7009}'::jsonb, zoom = 11 WHERE name ILIKE '%hồ chí minh%' OR name ILIKE '%ho chi minh%' OR name ILIKE '%tp.hcm%' OR name ILIKE '%tphcm%' OR name ILIKE '%sài gòn%';
UPDATE public.regions SET center = '{"lat":10.9453,"lng":106.8345}'::jsonb, zoom = 11 WHERE name ILIKE '%đồng nai%' OR name ILIKE '%dong nai%';
UPDATE public.regions SET center = '{"lat":10.6956,"lng":106.2431}'::jsonb, zoom = 11 WHERE name ILIKE '%long an%' OR name ILIKE '%tiền giang%' OR name ILIKE '%bến tre%';
UPDATE public.regions SET center = '{"lat":10.4938,"lng":105.6882}'::jsonb, zoom = 11 WHERE name ILIKE '%đồng tháp%' OR name ILIKE '%dong thap%' OR name ILIKE '%an giang%';
UPDATE public.regions SET center = '{"lat":10.2397,"lng":105.9571}'::jsonb, zoom = 12 WHERE name ILIKE '%vĩnh long%' OR name ILIKE '%vinh long%' OR name ILIKE '%trà vinh%';
UPDATE public.regions SET center = '{"lat":10.0452,"lng":105.7469}'::jsonb, zoom = 12 WHERE name ILIKE '%cần thơ%' OR name ILIKE '%can tho%' OR name ILIKE '%hậu giang%' OR name ILIKE '%sóc trăng%';
UPDATE public.regions SET center = '{"lat":9.8251,"lng":105.1259}'::jsonb, zoom = 11  WHERE name ILIKE '%kiên giang%' OR name ILIKE '%kien giang%' OR name ILIKE '%cà mau%' OR name ILIKE '%bạc liêu%';

-- Bước 3: Kiểm tra kết quả sau khi update
SELECT id, name, center, zoom FROM public.regions ORDER BY name;
