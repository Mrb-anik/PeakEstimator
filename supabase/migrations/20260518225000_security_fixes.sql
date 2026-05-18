-- 1. Fix: Function Search Path Mutable & Security Definer Executable
-- Supabase Warning: "Function `public.handle_new_user` has a role mutable search_path"
-- Supabase Warning: "Public / Signed-In Users Can Execute SECURITY DEFINER Function"
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- 2. Fix: RLS Policy Always True
-- Supabase Warning: "Table `public.waitlist` has an RLS policy `Public waitlist insert` for `INSERT` that allows unrestricted access"
DROP POLICY IF EXISTS "Public waitlist insert" ON waitlist;
CREATE POLICY "Public waitlist insert" ON waitlist FOR INSERT WITH CHECK (email IS NOT NULL);

-- 3. Fix: Public Bucket Allows Listing
-- Supabase Warning: "Public bucket `company-logos` has 1 broad SELECT policy on `storage.objects` (Logo read)"
-- Public buckets don't need a SELECT policy just to serve files (they serve them via the public URL automatically).
-- A SELECT policy allows the `anon` role to call `.list()` and see every file in the bucket.
DROP POLICY IF EXISTS "Logo read" ON storage.objects;
