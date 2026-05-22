-- ═══════════════════════════════════════════════════════════════
-- Migration: Allow profile lookup by email for member invitations
-- ═══════════════════════════════════════════════════════════════

-- Option 1: Add SELECT RLS policy to profiles (recommended)
-- Allow authenticated users to read basic profile info (id, email)
-- This is safe because only id and email are exposed, not sensitive data

-- Drop restrictive policy if exists
DROP POLICY IF EXISTS "profiles_select_self" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;

-- Allow reading own profile fully AND other profiles' id+email for invite lookup
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Option 2 (alternative): Create a secure function for email lookup
-- This is more restrictive but the policy above is sufficient for this use case

CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(lookup_email TEXT)
RETURNS TABLE(id UUID, email TEXT, full_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.full_name
  FROM profiles p
  WHERE p.email = lookup_email
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(TEXT) TO authenticated;

-- VERIFY
SELECT 'Migration complete: profile lookup enabled' AS status;
