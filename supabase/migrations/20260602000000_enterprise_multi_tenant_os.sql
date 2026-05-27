-- PeakEstimator Enterprise Multi-Tenant SaaS Operating System
-- Parent -> Child architecture with JWT tenant claims, strict RLS, custom roles,
-- feature locks, usage quotas, active sessions, white-labeling, and global rollout tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Parent/child role vocabulary. Legacy roles remain valid for backward compatibility.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'platform_owner',
    'super_admin',
    'agency_admin',
    'organization_owner',
    'admin',
    'manager',
    'sales_manager',
    'estimator',
    'sales_rep',
    'technician',
    'viewer'
  ));

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'suspended', 'archived')),
  ADD COLUMN IF NOT EXISTS parent_agency_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forced_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS feature_locks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS white_label_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS storage_limit_mb integer NOT NULL DEFAULT 10240,
  ADD COLUMN IF NOT EXISTS api_rate_limit_per_minute integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS ai_token_limit_monthly integer NOT NULL DEFAULT 500000;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'agency_admin',
    'organization_owner',
    'admin',
    'manager',
    'sales_manager',
    'estimator',
    'sales_rep',
    'technician',
    'viewer'
  ));

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE OR REPLACE FUNCTION public.jwt_organization_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'organization_id', '');
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', '');
$$;

CREATE OR REPLACE FUNCTION public.jwt_parent_access()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.jwt_is_super_admin()
    OR public.jwt_role() IN ('platform_owner', 'super_admin', 'agency_admin');
$$;

-- Fallback for older tokens that have not refreshed into the new JWT claims yet.
CREATE OR REPLACE FUNCTION public.is_parent_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_admin = true
        OR p.role IN ('platform_owner', 'super_admin', 'agency_admin')
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.enterprise_tenant_match(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
    OR org_id::text = (auth.jwt() ->> 'organization_id');
$$;

GRANT EXECUTE ON FUNCTION public.jwt_organization_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_parent_access() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_parent_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enterprise_tenant_match(uuid) TO authenticated, anon, service_role;

-- Supabase Custom Access Token hook. Enable this in Auth Hooks so every JWT carries:
-- organization_id, role, is_super_admin, and is_agency_admin.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  profile_row record;
BEGIN
  SELECT organization_id, role, is_admin
  INTO profile_row
  FROM public.profiles
  WHERE id = (event ->> 'user_id')::uuid;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);

  IF profile_row.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(profile_row.organization_id::text), true);
  END IF;

  claims := jsonb_set(claims, '{role}', to_jsonb(COALESCE(profile_row.role, 'viewer')), true);
  claims := jsonb_set(
    claims,
    '{is_super_admin}',
    to_jsonb(COALESCE(profile_row.is_admin, false) OR COALESCE(profile_row.role, '') IN ('platform_owner', 'super_admin')),
    true
  );
  claims := jsonb_set(
    claims,
    '{is_agency_admin}',
    to_jsonb(COALESCE(profile_row.role, '') = 'agency_admin'),
    true
  );

  event := jsonb_set(event, '{claims}', claims, true);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Enterprise control-plane tables.
CREATE TABLE IF NOT EXISTS public.agency_organization_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agency_admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, agency_admin_id)
);

CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  base_role text NOT NULL DEFAULT 'viewer',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  parent_enforced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.platform_feature_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  locked_by_parent boolean NOT NULL DEFAULT false,
  quota_limit bigint,
  quota_used bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_fingerprint text,
  ip_address inet,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  ip_address inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.white_label_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  brand_name text,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#2563eb',
  custom_domain text,
  email_from_name text,
  email_from_address text,
  smtp_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_by_parent boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled', 'error')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  encrypted_secret_ref text,
  last_sync_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE TABLE IF NOT EXISTS public.automation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  module_key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  flow_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.global_template_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.automation_templates(id) ON DELETE SET NULL,
  push_type text NOT NULL CHECK (push_type IN ('automation', 'pricing', 'formula', 'materials', 'labor')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'applied', 'failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.estimator_formula_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trade text NOT NULL DEFAULT 'general',
  formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_by_parent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_database_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trade text NOT NULL DEFAULT 'general',
  version integer NOT NULL DEFAULT 1,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  pushed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.labor_rate_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  region text NOT NULL DEFAULT 'default',
  trade text NOT NULL DEFAULT 'general',
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_by_parent boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, region, trade)
);

CREATE TABLE IF NOT EXISTS public.usage_quota_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quota_key text NOT NULL,
  delta bigint NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'app',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  used_mb numeric NOT NULL DEFAULT 0,
  file_count integer NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key_id uuid,
  route text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status_code integer,
  duration_ms integer,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('operational', 'degraded', 'outage')),
  message text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.global_pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE,
  name text NOT NULL,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  annual_price_cents integer NOT NULL DEFAULT 0,
  included_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add organization_id to tenant-owned legacy tables where earlier migrations were user-scoped.
ALTER TABLE IF EXISTS public.project_items ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.template_items ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.activity_events ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.integration_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.support_tickets ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ticket_responses ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.project_schedule ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.deposit_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.maintenance_contracts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.subcontractor_bids ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.proposal_analytics ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.proposal_questions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.revision_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.change_orders ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lien_waivers ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.project_items pi
SET organization_id = p.organization_id
FROM public.projects p
WHERE pi.project_id = p.id AND pi.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.template_items ti
SET organization_id = t.organization_id
FROM public.templates t
WHERE ti.template_id = t.id AND ti.organization_id IS NULL AND t.organization_id IS NOT NULL;

UPDATE public.activity_events ae
SET organization_id = p.organization_id
FROM public.profiles p
WHERE ae.user_id = p.id AND ae.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.integration_requests ir
SET organization_id = p.organization_id
FROM public.profiles p
WHERE ir.user_id = p.id AND ir.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.support_tickets st
SET organization_id = p.organization_id
FROM public.profiles p
WHERE st.user_id = p.id AND st.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.ticket_responses tr
SET organization_id = st.organization_id
FROM public.support_tickets st
WHERE tr.ticket_id = st.id AND tr.organization_id IS NULL AND st.organization_id IS NOT NULL;

UPDATE public.notifications n
SET organization_id = p.organization_id
FROM public.profiles p
WHERE n.user_id = p.id AND n.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.project_schedule ps
SET organization_id = p.organization_id
FROM public.projects p
WHERE ps.project_id = p.id AND ps.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.deposit_requests dr
SET organization_id = p.organization_id
FROM public.projects p
WHERE dr.project_id = p.id AND dr.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.maintenance_contracts mc
SET organization_id = p.organization_id
FROM public.projects p
WHERE mc.project_id = p.id AND mc.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.subcontractor_bids sb
SET organization_id = p.organization_id
FROM public.projects p
WHERE sb.project_id = p.id AND sb.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.proposal_analytics pa
SET organization_id = p.organization_id
FROM public.projects p
WHERE pa.project_id = p.id AND pa.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.proposal_questions pq
SET organization_id = p.organization_id
FROM public.projects p
WHERE pq.project_id = p.id AND pq.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.revision_requests rr
SET organization_id = p.organization_id
FROM public.projects p
WHERE rr.project_id = p.id AND rr.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.change_orders co
SET organization_id = p.organization_id
FROM public.projects p
WHERE co.project_id = p.id AND co.organization_id IS NULL AND p.organization_id IS NOT NULL;

UPDATE public.lien_waivers lw
SET organization_id = p.organization_id
FROM public.projects p
WHERE lw.project_id = p.id AND lw.organization_id IS NULL AND p.organization_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_child_record_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := NULLIF(auth.jwt() ->> 'organization_id', '')::uuid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.default_platform_revenue_org_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT id INTO org_id
  FROM public.organizations
  WHERE subdomain = 'platform-revenue-audits'
  LIMIT 1;

  IF org_id IS NULL THEN
    INSERT INTO public.organizations (name, subdomain, billing_tier, status)
    VALUES ('PeakEstimator Revenue Audit Pipeline', 'platform-revenue-audits', 'enterprise', 'active')
    RETURNING id INTO org_id;
  END IF;

  RETURN org_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.revenue_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_platform_revenue_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  owner_name text NOT NULL,
  email text NOT NULL,
  phone text,
  team_size text,
  annual_revenue_range text,
  service_area text,
  trade_type text,
  estimates_per_month integer NOT NULL DEFAULT 0,
  average_project_size numeric NOT NULL DEFAULT 0,
  average_close_rate numeric NOT NULL DEFAULT 0,
  average_response_time_hours numeric NOT NULL DEFAULT 0,
  follow_up_process text,
  estimator_count integer NOT NULL DEFAULT 0,
  office_staff_count integer NOT NULL DEFAULT 0,
  lost_leads_per_month integer NOT NULL DEFAULT 0,
  delayed_estimates_per_month integer NOT NULL DEFAULT 0,
  inconsistent_pricing_issues text,
  missed_follow_ups_per_month integer NOT NULL DEFAULT 0,
  callback_delay_hours numeric NOT NULL DEFAULT 0,
  manual_processes text,
  estimating_time_hours numeric NOT NULL DEFAULT 0,
  current_crm text,
  estimating_software text,
  scheduling_tools text,
  invoicing_tools text,
  spreadsheet_usage text,
  manual_workflows text,
  estimated_lost_revenue numeric NOT NULL DEFAULT 0,
  projected_revenue_recovery numeric NOT NULL DEFAULT 0,
  qualification_status text NOT NULL DEFAULT 'New Audit',
  source text NOT NULL DEFAULT 'landing_page',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_platform_revenue_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  revenue_audit_id uuid NOT NULL REFERENCES public.revenue_audits(id) ON DELETE CASCADE,
  efficiency_score integer NOT NULL DEFAULT 0,
  follow_up_score integer NOT NULL DEFAULT 0,
  scalability_score integer NOT NULL DEFAULT 0,
  operational_maturity_score integer NOT NULL DEFAULT 0,
  lead_score integer NOT NULL DEFAULT 0,
  urgency_score integer NOT NULL DEFAULT 0,
  growth_potential_score integer NOT NULL DEFAULT 0,
  estimated_deal_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_platform_revenue_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  revenue_audit_id uuid NOT NULL REFERENCES public.revenue_audits(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'New Audit' CHECK (stage IN ('New Audit', 'Qualified', 'Contacted', 'Demo Scheduled', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost')),
  projected_revenue_value numeric NOT NULL DEFAULT 0,
  qualification_status text NOT NULL DEFAULT 'New Audit',
  assigned_rep_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_attempts integer NOT NULL DEFAULT 0,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.default_platform_revenue_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  revenue_audit_id uuid REFERENCES public.revenue_audits(id) ON DELETE SET NULL,
  company_name text,
  full_name text NOT NULL,
  email text,
  phone text,
  contact_type text NOT NULL DEFAULT 'customer',
  lifecycle_stage text NOT NULL DEFAULT 'lead',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_name text,
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'New Audit',
  value numeric NOT NULL DEFAULT 0,
  close_probability integer NOT NULL DEFAULT 0,
  expected_close_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  subject text NOT NULL,
  body text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  revenue_audit_id uuid REFERENCES public.revenue_audits(id) ON DELETE SET NULL,
  title text NOT NULL,
  package_name text,
  roi_projection numeric NOT NULL DEFAULT 0,
  implementation_price numeric NOT NULL DEFAULT 0,
  feature_bundle jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected')),
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  flow_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'canceled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'call', 'meeting', 'internal')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  subject text,
  body text,
  status text NOT NULL DEFAULT 'logged',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'not_started',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_project_child_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := NULLIF(auth.jwt() ->> 'organization_id', '')::uuid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_project_items_org_id ON public.project_items;
CREATE TRIGGER tr_project_items_org_id
  BEFORE INSERT ON public.project_items
  FOR EACH ROW EXECUTE FUNCTION public.set_project_child_org_id();

DROP TRIGGER IF EXISTS tr_project_schedule_org_id ON public.project_schedule;
CREATE TRIGGER tr_project_schedule_org_id
  BEFORE INSERT ON public.project_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_project_child_org_id();

DROP TRIGGER IF EXISTS tr_deposit_requests_org_id ON public.deposit_requests;
CREATE TRIGGER tr_deposit_requests_org_id
  BEFORE INSERT ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_project_child_org_id();

-- Seed module controls for existing organizations.
INSERT INTO public.platform_feature_controls (organization_id, module_key, enabled)
SELECT o.id, module_key, true
FROM public.organizations o
CROSS JOIN (VALUES
  ('crm'), ('estimator'), ('invoicing'), ('scheduling'), ('team'),
  ('reporting'), ('automation'), ('storage'), ('ai'), ('analytics'),
  ('billing'), ('white_label'), ('sms'), ('email'), ('api')
) AS modules(module_key)
ON CONFLICT (organization_id, module_key) DO NOTHING;

INSERT INTO public.global_pricing_plans (plan_key, name, monthly_price_cents, annual_price_cents, included_features, limits)
VALUES
  ('free', 'Free', 0, 0, '{"estimator":true,"templates":true}'::jsonb, '{"team_seats":1,"ai_tokens":50000,"api_requests":0}'::jsonb),
  ('pro', 'Pro', 9900, 99000, '{"crm":true,"automation":true,"ai":true,"email":true}'::jsonb, '{"team_seats":10,"ai_tokens":500000,"api_requests":10000}'::jsonb),
  ('enterprise', 'Enterprise', 29900, 299000, '{"white_label":true,"api":true,"sms":true,"advanced_analytics":true}'::jsonb, '{"team_seats":100,"ai_tokens":2000000,"api_requests":100000}'::jsonb)
ON CONFLICT (plan_key) DO UPDATE
SET name = EXCLUDED.name,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    annual_price_cents = EXCLUDED.annual_price_cents,
    included_features = EXCLUDED.included_features,
    limits = EXCLUDED.limits,
    updated_at = now();

-- Enable RLS and replace tenant table policies with canonical JWT claim checks.
DO $$
DECLARE
  tbl text;
  pol record;
  tenant_tables text[] := ARRAY[
    'organization_settings',
    'organization_members',
    'agency_organization_access',
    'custom_roles',
    'role_assignments',
    'platform_feature_controls',
    'projects',
    'project_items',
    'price_book',
    'templates',
    'template_items',
    'audit_logs',
    'proposal_versions',
    'subscriptions',
    'ai_usage_limits',
    'ai_usage_logs',
    'email_logs',
    'notifications',
    'background_jobs',
    'usage_tracking',
    'organization_usage',
    'activity_events',
    'integration_requests',
    'support_tickets',
    'ticket_responses',
    'project_schedule',
    'deposit_requests',
    'maintenance_contracts',
    'subcontractor_bids',
    'proposal_analytics',
    'proposal_questions',
    'revision_requests',
    'change_orders',
    'lien_waivers',
    'broadcast_emails',
    'active_sessions',
    'security_events',
    'white_label_configs',
    'integration_connections',
    'global_template_pushes',
    'estimator_formula_presets',
    'material_database_versions',
    'labor_rate_presets',
    'usage_quota_events',
    'storage_usage_snapshots',
    'api_usage_logs',
    'system_api_keys',
    'revenue_audits',
    'audit_scores',
    'lead_pipeline',
    'contacts',
    'opportunities',
    'activities',
    'proposals',
    'automations',
    'notes',
    'tasks',
    'communications',
    'onboarding_flows'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = tbl
          AND column_name = 'organization_id'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT USING (COALESCE((auth.jwt() ->> ''is_super_admin'')::boolean, false) = true OR public.is_parent_admin() OR organization_id::text = (auth.jwt() ->> ''organization_id''))',
          'enterprise_' || tbl || '_select',
          tbl
        );
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (COALESCE((auth.jwt() ->> ''is_super_admin'')::boolean, false) = true OR public.is_parent_admin() OR organization_id::text = (auth.jwt() ->> ''organization_id''))',
          'enterprise_' || tbl || '_insert',
          tbl
        );
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE USING (COALESCE((auth.jwt() ->> ''is_super_admin'')::boolean, false) = true OR public.is_parent_admin() OR organization_id::text = (auth.jwt() ->> ''organization_id'')) WITH CHECK (COALESCE((auth.jwt() ->> ''is_super_admin'')::boolean, false) = true OR public.is_parent_admin() OR organization_id::text = (auth.jwt() ->> ''organization_id''))',
          'enterprise_' || tbl || '_update',
          tbl
        );
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE USING (COALESCE((auth.jwt() ->> ''is_super_admin'')::boolean, false) = true OR public.is_parent_admin() OR organization_id::text = (auth.jwt() ->> ''organization_id''))',
          'enterprise_' || tbl || '_delete',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enterprise_organizations_select ON public.organizations;
CREATE POLICY enterprise_organizations_select ON public.organizations
  FOR SELECT USING (
    COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
    OR id::text = (auth.jwt() ->> 'organization_id')
  );

DROP POLICY IF EXISTS enterprise_organizations_insert ON public.organizations;
CREATE POLICY enterprise_organizations_insert ON public.organizations
  FOR INSERT WITH CHECK (
    COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
  );

DROP POLICY IF EXISTS enterprise_organizations_update ON public.organizations;
CREATE POLICY enterprise_organizations_update ON public.organizations
  FOR UPDATE USING (
    COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
    OR id::text = (auth.jwt() ->> 'organization_id')
  )
  WITH CHECK (
    COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
    OR id::text = (auth.jwt() ->> 'organization_id')
  );

DROP POLICY IF EXISTS enterprise_organizations_delete ON public.organizations;
CREATE POLICY enterprise_organizations_delete ON public.organizations
  FOR DELETE USING (
    COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
  );

DROP POLICY IF EXISTS enterprise_profiles_select ON public.profiles;
CREATE POLICY enterprise_profiles_select ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
    OR organization_id::text = (auth.jwt() ->> 'organization_id')
  );

DROP POLICY IF EXISTS enterprise_profiles_update ON public.profiles;
CREATE POLICY enterprise_profiles_update ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
    OR organization_id::text = (auth.jwt() ->> 'organization_id')
  )
  WITH CHECK (
    id = auth.uid()
    OR COALESCE((auth.jwt() ->> 'is_super_admin')::boolean, false) = true
    OR public.is_parent_admin()
    OR organization_id::text = (auth.jwt() ->> 'organization_id')
  );

DROP POLICY IF EXISTS enterprise_projects_public_share_read ON public.projects;
CREATE POLICY enterprise_projects_public_share_read ON public.projects
  FOR SELECT USING (share_token IS NOT NULL);

DROP POLICY IF EXISTS enterprise_projects_public_share_update ON public.projects;
CREATE POLICY enterprise_projects_public_share_update ON public.projects
  FOR UPDATE USING (share_token IS NOT NULL)
  WITH CHECK (share_token IS NOT NULL);

DROP POLICY IF EXISTS enterprise_project_items_public_share_read ON public.project_items;
CREATE POLICY enterprise_project_items_public_share_read ON public.project_items
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE share_token IS NOT NULL)
  );

DROP POLICY IF EXISTS enterprise_proposal_versions_public_share_read ON public.proposal_versions;
CREATE POLICY enterprise_proposal_versions_public_share_read ON public.proposal_versions
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE share_token IS NOT NULL)
  );

DROP POLICY IF EXISTS public_insert_revenue_audits ON public.revenue_audits;
CREATE POLICY public_insert_revenue_audits ON public.revenue_audits
  FOR INSERT WITH CHECK (email IS NOT NULL AND company_name IS NOT NULL);

DROP POLICY IF EXISTS public_insert_audit_scores ON public.audit_scores;
CREATE POLICY public_insert_audit_scores ON public.audit_scores
  FOR INSERT WITH CHECK (revenue_audit_id IS NOT NULL);

DROP POLICY IF EXISTS public_insert_lead_pipeline ON public.lead_pipeline;
CREATE POLICY public_insert_lead_pipeline ON public.lead_pipeline
  FOR INSERT WITH CHECK (revenue_audit_id IS NOT NULL);

DROP POLICY IF EXISTS public_insert_revenue_contacts ON public.contacts;
CREATE POLICY public_insert_revenue_contacts ON public.contacts
  FOR INSERT WITH CHECK (
    contact_type = 'revenue_audit_lead'
    AND revenue_audit_id IS NOT NULL
  );

-- Make organization_id NOT NULL on tenant tables once backfilled. Tables with global rows
-- such as price_book/templates are intentionally left nullable to support parent-pushed global presets.
DO $$
DECLARE
  tbl text;
  strict_tables text[] := ARRAY[
    'projects',
    'audit_logs',
    'proposal_versions',
    'subscriptions',
    'ai_usage_limits',
    'ai_usage_logs',
    'background_jobs',
    'usage_tracking',
    'organization_usage',
    'organization_settings',
    'organization_members',
    'custom_roles',
    'role_assignments',
    'platform_feature_controls',
    'active_sessions',
    'security_events',
    'white_label_configs',
    'integration_connections',
    'global_template_pushes',
    'estimator_formula_presets',
    'material_database_versions',
    'labor_rate_presets',
    'usage_quota_events',
    'storage_usage_snapshots',
    'api_usage_logs',
    'revenue_audits',
    'audit_scores',
    'lead_pipeline',
    'contacts',
    'opportunities',
    'activities',
    'proposals',
    'automations',
    'notes',
    'tasks',
    'communications',
    'onboarding_flows'
  ];
  null_count bigint;
BEGIN
  FOREACH tbl IN ARRAY strict_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE organization_id IS NULL', tbl) INTO null_count;
      IF null_count = 0 THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', tbl);
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_organizations_parent_agency_id ON public.organizations(parent_agency_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);
CREATE INDEX IF NOT EXISTS idx_profiles_org_role ON public.profiles(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_active_sessions_org_last_seen ON public.active_sessions(organization_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_org_created ON public.security_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_controls_org_module ON public.platform_feature_controls(organization_id, module_key);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_org_created ON public.api_usage_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_quota_events_org_key ON public.usage_quota_events(organization_id, quota_key, created_at DESC);

NOTIFY pgrst, 'reload schema';
