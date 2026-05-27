-- 1. Security Definer View
ALTER VIEW public.onboarding_summary SET (security_invoker = true);

-- 2. Function Search Path Mutable
ALTER FUNCTION public.my_parent_id() SET search_path = '';
ALTER FUNCTION public.mark_expired_proposals() SET search_path = '';
ALTER FUNCTION public.enforce_proposal_expiry() SET search_path = '';
ALTER FUNCTION public.handle_user_login_hook(jsonb) SET search_path = '';
ALTER FUNCTION public.handle_user_login() SET search_path = '';
ALTER FUNCTION public.is_user_suspended() SET search_path = '';
ALTER FUNCTION public.log_profile_admin_update() SET search_path = '';
ALTER FUNCTION public.is_admin() SET search_path = '';
ALTER FUNCTION public.increment_ai_usage(uuid, integer) SET search_path = '';
ALTER FUNCTION public.approve_wire_payment(uuid, text, timestamp with time zone) SET search_path = '';
ALTER FUNCTION public.get_project_by_share_token(text) SET search_path = '';
ALTER FUNCTION public.approve_project_by_share_token(text, text, text, text) SET search_path = '';
ALTER FUNCTION public.request_project_changes_by_share_token(text, text) SET search_path = '';
ALTER FUNCTION public.select_project_tier_by_share_token(text, text) SET search_path = '';
ALTER FUNCTION public.get_project_items_by_share_token(text) SET search_path = '';
ALTER FUNCTION public.get_deposits_by_share_token(text) SET search_path = '';
ALTER FUNCTION public.get_maintenance_contract_by_token(text) SET search_path = '';
ALTER FUNCTION public.sign_maintenance_contract_by_token(text, text, text, text) SET search_path = '';
ALTER FUNCTION public.get_subcontractor_bid_by_token(text) SET search_path = '';
ALTER FUNCTION public.submit_subcontractor_bid_by_token(text, numeric, text, jsonb) SET search_path = '';
ALTER FUNCTION public.upsert_org_usage(uuid, integer, integer, integer, integer, integer) SET search_path = '';
ALTER FUNCTION public.sync_profile_to_org() SET search_path = '';

-- 3. Permissive RLS Policies
DROP POLICY IF EXISTS "Service role insert email logs" ON public.email_logs;
CREATE POLICY "Service role insert email logs" ON public.email_logs
FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert analytics" ON public.proposal_analytics;
CREATE POLICY "Public insert analytics" ON public.proposal_analytics
FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public insert questions" ON public.proposal_questions;
CREATE POLICY "Public insert questions" ON public.proposal_questions
FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public insert revisions" ON public.revision_requests;
CREATE POLICY "Public insert revisions" ON public.revision_requests
FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Anyone insert waitlist" ON public.waitlist;
CREATE POLICY "Anyone insert waitlist" ON public.waitlist
FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- 4. Public Bucket Allows Listing
DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_select" ON storage.objects;
DROP POLICY IF EXISTS "Logo read" ON storage.objects;

-- 5. Public Can Execute SECURITY DEFINER Function (Internal functions lockdown)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_suspended() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_to_org() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_profile_admin_update() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_user_login() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_user_login_hook(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_parent_id() FROM PUBLIC, anon;

-- Re-grant to authenticated / service_role where needed
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_suspended() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_to_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_parent_id() TO authenticated;
-- The others are only needed by service_role (edge functions)
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_profile_admin_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_user_login() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_user_login_hook(jsonb) TO service_role;
