-- ═══════════════════════════════════════════════════════════════
-- TERRIMAP — FIX ALL: RLS + Agents + Members
-- Chạy script này 1 lần trong Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. FIX RLS: Cho phép tất cả members thấy nhau ────────────
DROP POLICY IF EXISTS "pm_select" ON public.project_members;
CREATE POLICY "pm_select" ON public.project_members 
  FOR SELECT 
  USING (
    public.is_project_member(project_id, auth.uid()) 
    OR public.is_project_owner(project_id, auth.uid())
  );

-- ── 2. XÓA AGENTS LEGACY (không có project_id) ───────────────
DELETE FROM public.sales_agents 
  WHERE id IN ('sa0','sa1','sa2','sa3','sa4','sa5','sa6','sa7') 
  AND project_id IS NULL;

-- Xóa thêm agents cũ với id khác (sa-hcm*, sa-hue*)  
DELETE FROM public.sales_agents 
  WHERE id LIKE 'sa-hcm%' OR id LIKE 'sa-hue%';

-- ── 3. UPSERT AGENTS MỚI (8 agents, đúng region) ─────────────
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
  name = EXCLUDED.name, 
  active_region = EXCLUDED.active_region,
  capacity = EXCLUDED.capacity, 
  project_id = EXCLUDED.project_id;

-- ── 4. KIỂM TRA ──────────────────────────────────────────────
-- Xem agents (phải đúng 8 rows, không trùng)
SELECT id, name, active_region, project_id FROM public.sales_agents ORDER BY id;

-- Xem members (phải có 3 rows)
SELECT pm.role, p.email, p.full_name 
FROM public.project_members pm
JOIN public.profiles p ON p.id = pm.user_id
WHERE pm.project_id = 'test-project-terrimap'
ORDER BY pm.role;
