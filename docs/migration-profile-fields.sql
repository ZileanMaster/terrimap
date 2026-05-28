-- TerriMap: Add extra profile fields for personnel management
-- Date: 2026-05-28
--
-- Adds:
-- - profiles.date_of_birth (DATE)
-- - profiles.phone (TEXT)
--
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Optional sanity check:
-- SELECT id, email, full_name, date_of_birth, phone FROM public.profiles LIMIT 10;

