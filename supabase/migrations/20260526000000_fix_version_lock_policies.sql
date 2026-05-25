-- ── Fix version-lock: Add INSERT policies for proposal_versions and audit_logs ──
-- The version-lock Edge Function uses the service_role key (bypasses RLS),
-- but adding explicit INSERT policies ensures the tables work correctly
-- if called from authenticated user context as well.

-- 1. proposal_versions: Allow org members to INSERT snapshots
DROP POLICY IF EXISTS "Org insert proposal snapshots" ON public.proposal_versions;
CREATE POLICY "Org insert proposal snapshots" ON public.proposal_versions
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2. audit_logs: Allow org members to INSERT audit records
DROP POLICY IF EXISTS "Org insert audit logs" ON public.audit_logs;
CREATE POLICY "Org insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Also ensure the service_role can always bypass (it does by default,
--    but let's make sure RLS isn't blocking the service key for some reason).
--    Grant explicit usage to service_role on these tables.
GRANT ALL ON public.proposal_versions TO service_role;
GRANT ALL ON public.audit_logs TO service_role;
