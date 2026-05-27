-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — Phase 2: Usage Metering & RBAC Hardening
-- Migration: 20260527210000_phase2_usage_metering.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Add ai_requests_count to track call volume ───────────────
ALTER TABLE public.organization_usage
  ADD COLUMN IF NOT EXISTS ai_requests_count integer DEFAULT 0;

-- ─── 2. Add projects_count tracking ──────────────────────────────
ALTER TABLE public.organization_usage
  ADD COLUMN IF NOT EXISTS projects_count integer DEFAULT 0;

-- ─── 3. Backfill projects_count for all orgs ─────────────────────
UPDATE public.organization_usage ou
SET projects_count = (
  SELECT COUNT(*) FROM public.projects p
  WHERE p.organization_id = ou.organization_id
);

-- ─── 4. Function: increment AI usage (called from Edge Functions) ─
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  org_id uuid,
  tokens_consumed integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.organization_usage (
    organization_id,
    ai_tokens_used,
    ai_requests_count,
    updated_at
  )
  VALUES (
    org_id,
    tokens_consumed,
    1,
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE
  SET
    ai_tokens_used = organization_usage.ai_tokens_used + EXCLUDED.ai_tokens_used,
    ai_requests_count = organization_usage.ai_requests_count + 1,
    updated_at = now();
END;
$$;

-- ─── 5. Function: check AI usage allowance ────────────────────────
CREATE OR REPLACE FUNCTION public.check_ai_allowance(org_id uuid)
RETURNS TABLE(allowed boolean, tokens_remaining bigint, usage_pct integer)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_used bigint;
  v_limit bigint;
BEGIN
  SELECT ai_tokens_used, ai_tokens_limit
  INTO v_used, v_limit
  FROM public.organization_usage
  WHERE organization_id = org_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 50000::bigint, 0::integer;
    RETURN;
  END IF;

  -- -1 = unlimited
  IF v_limit = -1 THEN
    RETURN QUERY SELECT true, -1::bigint, 0::integer;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    (v_limit - v_used) > 0,
    GREATEST(0, v_limit - v_used),
    CASE WHEN v_limit > 0 THEN ROUND((v_used::numeric / v_limit) * 100)::integer ELSE 0 END;
END;
$$;

-- ─── 6. Organization_members: add organization_id to projects RLS ─
-- Ensure new projects created by org members get org_id set

CREATE OR REPLACE FUNCTION public.set_project_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_project_org_id ON public.projects;
CREATE TRIGGER tr_set_project_org_id
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_organization_id();

-- ─── 7. Increment projects_count on project create ────────────────
CREATE OR REPLACE FUNCTION public.increment_org_project_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    UPDATE public.organization_usage
    SET projects_count = projects_count + 1, updated_at = now()
    WHERE organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_increment_org_project_count ON public.projects;
CREATE TRIGGER tr_increment_org_project_count
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_org_project_count();

-- ─── 8. Decrement projects_count on delete ────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_org_project_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.organization_id IS NOT NULL THEN
    UPDATE public.organization_usage
    SET projects_count = GREATEST(0, projects_count - 1), updated_at = now()
    WHERE organization_id = OLD.organization_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_decrement_org_project_count ON public.projects;
CREATE TRIGGER tr_decrement_org_project_count
  AFTER DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_org_project_count();

-- ─── 9. RBAC: org_members SELECT policy for org data ─────────────
-- Members can read their org's organization record
DROP POLICY IF EXISTS "org_members_read_own_org" ON public.organizations;
CREATE POLICY "org_members_read_own_org"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND organization_id IS NOT NULL
    )
    OR public.is_platform_owner()
  );

-- ─── 10. RLS for organization_usage — members can read own ────────
DROP POLICY IF EXISTS "org_members_read_own_usage" ON public.organization_usage;
CREATE POLICY "org_members_read_own_usage"
  ON public.organization_usage FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND organization_id IS NOT NULL
    )
    OR public.is_platform_owner()
  );

-- ─── Done ─────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
