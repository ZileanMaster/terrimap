-- TerriMap: Backfill profile data for existing users
-- Date: 2026-05-28
--
-- Problem this solves:
-- - project_members has user_id UUIDs, but profiles rows may be missing or incomplete,
--   causing UI to show UUID and "Chưa cập nhật".
--
-- What it does:
-- 1) Insert missing profiles rows for any auth.users not present in public.profiles.
-- 2) Ensure profiles.email is populated from auth.users.email.
-- 3) Ensure profiles.full_name has a usable default (based on email local-part).
--
-- Safe to run multiple times.

-- 1) Insert any missing profiles
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(split_part(u.email, '@', 1), ''), 'Chưa cập nhật') AS full_name
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );

-- 2) Backfill email if missing
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND u.email IS NOT NULL
  AND (p.email IS NULL OR p.email = '');

-- 3) Default full_name from email if empty
UPDATE public.profiles p
SET full_name = COALESCE(NULLIF(split_part(p.email, '@', 1), ''), 'Chưa cập nhật')
WHERE p.full_name IS NULL OR p.full_name = '';

-- Optional sanity checks:
-- SELECT COUNT(*) FROM public.profiles;
-- SELECT id, email, full_name, date_of_birth, phone FROM public.profiles ORDER BY created_at DESC NULLS LAST LIMIT 20;

