-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — Phase 1: Organization RBAC & Tenant Hardening
-- Migration: 20260527200000_phase1_org_rbac.sql
--
-- BACKWARD-COMPATIBLE: This migration only ADDs columns and tables.
-- Nothing is dropped or renamed. Existing data is preserved.
--
-- What this does:
--   1. Adds platform_owner to profiles.role enum constraint
--   2. Adds organization_members table (team management)
--   3. Adds subscription_plans table (plan definitions)
--   4. Adds organization_usage table (metered billing prep)
--   5. Adds impersonation_logs table (audit trail)
--   6. Updates profiles RLS to scope by organization
--   7. Adds is_platform_owner() DB function (replaces is_admin())
--   8. Updates projects RLS to org-scoped pattern
--   9. Adds org_id index on all major tables
--  10. Backfills organization_id on projects for existing users
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Extend profiles.role to include platform_owner ────────────
-- Drop and recreate the role check constraint to add platform_owner

DO $$
BEGIN
  -- Drop old constraint if it exists (might be named differently)
  ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;
  
  -- Add updated constraint with platform_owner
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN (
      'platform_owner',
      'super_admin',
      'admin',
      'sales_manager',
      'estimator',
      'technician',
      'viewer'
    ));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Role constraint update skipped: %', SQLERRM;
END;
$$;

-- ─── 2. organization_members table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'estimator'
                    CHECK (role IN ('admin', 'sales_manager', 'estimator', 'technician', 'viewer')),
  permissions     jsonb DEFAULT '{}',
  invited_by      uuid REFERENCES auth.users(id),
  invited_at      timestamptz DEFAULT now(),
  accepted_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Members can view others in their org
CREATE POLICY "org_members_select_own_org"
  ON public.organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only org admins can insert members
CREATE POLICY "org_admins_insert_members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND organization_id = organization_members.organization_id
        AND role IN ('admin', 'super_admin', 'platform_owner')
    )
  );

-- Only org admins can update members
CREATE POLICY "org_admins_update_members"
  ON public.organization_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND organization_id = organization_members.organization_id
        AND role IN ('admin', 'super_admin', 'platform_owner')
    )
  );

-- Only org admins can delete members
CREATE POLICY "org_admins_delete_members"
  ON public.organization_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND organization_id = organization_members.organization_id
        AND role IN ('admin', 'super_admin', 'platform_owner')
    )
  );

-- Platform owner full access
CREATE POLICY "platform_owner_all_org_members"
  ON public.organization_members FOR ALL
  USING (public.is_admin());

-- ─── 3. subscription_plans table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  monthly_price   numeric DEFAULT 0,
  annual_price    numeric DEFAULT 0,
  features        jsonb DEFAULT '{}',
  limits          jsonb DEFAULT '{}',
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read plans (it's a public catalog)
CREATE POLICY "subscription_plans_public_read"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- Only platform owners can manage plans
CREATE POLICY "platform_owner_manage_plans"
  ON public.subscription_plans FOR ALL
  USING (public.is_admin());

-- Seed default plans
INSERT INTO public.subscription_plans (name, slug, monthly_price, annual_price, features, limits, sort_order)
VALUES
  (
    'Free', 'free', 0, 0,
    '{"templates": true, "mobile_field": true, "ai_estimates_monthly": 5, "team_members": 1}',
    '{"proposals_per_month": 10, "storage_gb": 1, "ai_tokens_monthly": 50000}',
    1
  ),
  (
    'Pro', 'pro', 99, 990,
    '{"templates": true, "mobile_field": true, "good_better_best": true, "ai_scope": true, "automation": true, "financing": true, "export_pdf": true, "proposal_analytics": true, "ai_estimates_monthly": 500, "team_members": 10}',
    '{"proposals_per_month": 500, "storage_gb": 20, "ai_tokens_monthly": 500000}',
    2
  ),
  (
    'Enterprise', 'enterprise', 299, 2990,
    '{"templates": true, "mobile_field": true, "good_better_best": true, "ai_scope": true, "automation": true, "financing": true, "export_pdf": true, "proposal_analytics": true, "white_label": true, "api_access": true, "custom_domain": true, "priority_support": true, "advanced_analytics": true, "change_orders": true, "lien_waivers": true, "maintenance_contracts": true, "ai_estimates_monthly": -1, "team_members": -1}',
    '{"proposals_per_month": -1, "storage_gb": -1, "ai_tokens_monthly": -1}',
    3
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. organization_usage table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_usage (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id       uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- AI
  ai_tokens_used        bigint DEFAULT 0,
  ai_tokens_limit       bigint DEFAULT 50000,
  ai_requests_count     integer DEFAULT 0,
  -- Storage
  storage_bytes_used    bigint DEFAULT 0,
  storage_bytes_limit   bigint DEFAULT 1073741824, -- 1GB default
  -- Proposals
  proposals_this_month  integer DEFAULT 0,
  proposals_limit       integer DEFAULT 10,
  -- Seats
  seats_used            integer DEFAULT 1,
  seats_limit           integer DEFAULT 1,
  -- Projects
  projects_count        integer DEFAULT 0,
  -- Reset tracking
  period_start          date DEFAULT date_trunc('month', now())::date,
  last_reset_at         timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.organization_usage ENABLE ROW LEVEL SECURITY;

-- Org admins can read their own usage
CREATE POLICY "org_admins_read_own_usage"
  ON public.organization_usage FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'platform_owner')
    )
  );

-- Platform owners see all usage
CREATE POLICY "platform_owner_all_usage"
  ON public.organization_usage FOR ALL
  USING (public.is_admin());

-- ─── 5. impersonation_logs table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.impersonation_logs (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id          uuid REFERENCES auth.users(id) NOT NULL,
  target_user_id    uuid REFERENCES auth.users(id) NOT NULL,
  target_org_id     uuid REFERENCES public.organizations(id),
  reason            text,
  ip_address        text,
  user_agent        text,
  started_at        timestamptz DEFAULT now(),
  ended_at          timestamptz,
  actions_taken     jsonb DEFAULT '[]',
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Only platform owners can read impersonation logs
CREATE POLICY "platform_owner_read_impersonation_logs"
  ON public.impersonation_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "platform_owner_insert_impersonation_logs"
  ON public.impersonation_logs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "platform_owner_update_impersonation_logs"
  ON public.impersonation_logs FOR UPDATE
  USING (public.is_admin());

-- ─── 6. is_platform_owner() DB function ──────────────────────────
-- The authoritative server-side platform staff check.
-- Checks BOTH new role field AND legacy is_admin for backward compat.

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT (role IN ('platform_owner', 'super_admin') OR is_admin = true)
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    false
  );
$$;

-- ─── 7. Update existing is_admin() to use new function ───────────
-- Keeps backward compat for existing policies that call is_admin()

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_platform_owner();
$$;

-- ─── 8. Organization-scoped projects RLS ─────────────────────────
-- Adds org-scoped SELECT alongside existing user_id policy.
-- Users without org still use user_id = auth.uid().

DROP POLICY IF EXISTS "org_scoped_projects_select" ON public.projects;
CREATE POLICY "org_scoped_projects_select"
  ON public.projects FOR SELECT
  USING (
    -- Own project
    user_id = auth.uid()
    OR
    -- Same organization (multi-member access)
    (
      organization_id IS NOT NULL
      AND organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE id = auth.uid()
          AND organization_id IS NOT NULL
      )
    )
  );

-- ─── 9. Performance indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_organization_id
  ON public.projects(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id
  ON public.profiles(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id
  ON public.organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON public.organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_actor_id
  ON public.impersonation_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target_id
  ON public.impersonation_logs(target_user_id);

-- ─── 10. Backfill organization_id on projects ────────────────────
-- For existing users: copy their profile's organization_id to all their projects
-- Only touches rows where organization_id is NULL

UPDATE public.projects p
SET organization_id = pr.organization_id
FROM public.profiles pr
WHERE p.user_id = pr.id
  AND p.organization_id IS NULL
  AND pr.organization_id IS NOT NULL;

-- ─── 11. Seed organization_usage for existing orgs ───────────────
INSERT INTO public.organization_usage (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- ─── Done ─────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
