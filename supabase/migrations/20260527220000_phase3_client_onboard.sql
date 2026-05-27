-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — Phase 3: First Client Onboard Fixes
-- Migration: 20260527220000_phase3_client_onboard.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Add logo_url to organizations table ───────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ─── 2. Sync profile company_name → org name on profile update ────
CREATE OR REPLACE FUNCTION public.sync_profile_to_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only sync if company_name changed and org exists
  IF NEW.organization_id IS NOT NULL AND
     (OLD.company_name IS DISTINCT FROM NEW.company_name OR
      OLD.company_logo IS DISTINCT FROM NEW.company_logo) THEN

    UPDATE public.organizations
    SET
      name = CASE
        WHEN NEW.company_name IS NOT NULL AND NEW.company_name <> ''
        THEN NEW.company_name
        ELSE name
      END,
      logo_url = COALESCE(NEW.company_logo, logo_url),
      updated_at = now()
    WHERE id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_profile_to_org ON public.profiles;
CREATE TRIGGER tr_sync_profile_to_org
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_org();

-- ─── 3. Mark org as onboarded when first member completes onboarding ─
CREATE OR REPLACE FUNCTION public.mark_org_onboarding_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.onboarding_completed = true AND
     OLD.onboarding_completed IS DISTINCT FROM true AND
     NEW.organization_id IS NOT NULL THEN
    UPDATE public.organizations
    SET
      onboarding_completed = true,
      onboarding_completed_at = now(),
      updated_at = now()
    WHERE id = NEW.organization_id
      AND onboarding_completed = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_mark_org_onboarding ON public.profiles;
CREATE TRIGGER tr_mark_org_onboarding
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_org_onboarding_complete();

-- ─── 4. monthly-reset helper: ensure period_start column exists ───
ALTER TABLE public.organization_usage
  ADD COLUMN IF NOT EXISTS last_reset_at timestamptz;

ALTER TABLE public.organization_usage
  ADD COLUMN IF NOT EXISTS period_start date DEFAULT CURRENT_DATE;

-- ─── 5. Cron job registration (requires pg_cron) ──────────────────
-- Uncomment AFTER enabling pg_cron extension in Supabase Dashboard
-- Database → Extensions → pg_cron → Enable
--
-- SELECT cron.unschedule('monthly-usage-reset') WHERE EXISTS (
--   SELECT 1 FROM cron.job WHERE jobname = 'monthly-usage-reset'
-- );
--
-- SELECT cron.schedule(
--   'monthly-usage-reset',
--   '5 0 1 * *',   -- 00:05 UTC on 1st of every month
--   $$ SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/monthly-reset',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key'),
--       'x-reset-secret', current_setting('app.settings.monthly_reset_secret')
--     ),
--     body := '{}'::jsonb
--   ) $$
-- );

-- ─── 6. Proposal expiry auto-cleanup (mark expired, not delete) ───
CREATE OR REPLACE FUNCTION public.mark_expired_proposals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.projects
  SET status = 'lost',
      updated_at = now()
  WHERE status IN ('sent', 'bidding')
    AND valid_until IS NOT NULL
    AND valid_until < CURRENT_DATE;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.mark_expired_proposals() TO postgres;

-- ─── 7. Index for faster org-scoped project queries ───────────────
CREATE INDEX IF NOT EXISTS idx_projects_org_status
  ON public.projects (organization_id, status)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_org_created
  ON public.projects (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- ─── Done ─────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
