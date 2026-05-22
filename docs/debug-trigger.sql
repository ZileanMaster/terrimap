-- CHẠY TỪNG QUERY MỘT (bôi đen từng block rồi bấm Run)

-- ══════════ QUERY 1: Trigger tồn tại? ══════════
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
-- KỲ VỌNG: 1 dòng "on_auth_user_created" | "INSERT"


-- ══════════ QUERY 2: Orphaned auth users? ══════════
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;
-- KỲ VỌNG: 0 dòng (đã cleanup) hoặc danh sách users


-- ══════════ QUERY 3: Profiles hiện có? ══════════
SELECT id, email, full_name FROM profiles LIMIT 5;
-- KỲ VỌNG: 0 dòng (chưa ai signup thành công)


-- ══════════ QUERY 4: Test insert thủ công ══════════
-- Thử insert trực tiếp vào profiles xem có lỗi gì không
-- (dùng UUID giả, sẽ xóa sau)
DO $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'test@debug.com', 'Debug Test');
  RAISE NOTICE 'INSERT OK — profiles table works!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'INSERT FAILED: % — %', SQLERRM, SQLSTATE;
END;
$$;
-- KỲ VỌNG: "INSERT OK" hoặc lỗi FK (vì uuid không tồn tại trong auth.users)


-- ══════════ QUERY 5: Xóa test row ══════════
DELETE FROM profiles WHERE email = 'test@debug.com';
