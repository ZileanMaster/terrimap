-- ═══════════════════════════════════════════════════════════════
-- FIX: Recreate trigger with explicit schema + search_path
-- (Supabase requires explicit public. prefix for auth triggers)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger (pointing to public.handle_new_user)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- VERIFY: function exists with correct schema
SELECT n.nspname as schema, p.proname as function_name
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user';
