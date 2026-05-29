-- Migration: Add custom domain verification, enterprise quota tracking columns, and RLS policies
-- Created: 2026-05-29

-- 1. Add Custom Domain fields to organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS custom_domain_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloudflare_hostname_id text,
  ADD COLUMN IF NOT EXISTS cloudflare_ssl_status text;

-- 2. Add Quota & Revenue Intelligence fields to organization_quotas
ALTER TABLE public.organization_quotas
  ADD COLUMN IF NOT EXISTS max_automations integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS automations_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_api_requests_per_month integer DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS api_requests_this_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_communications_per_month integer DEFAULT 500,
  ADD COLUMN IF NOT EXISTS communications_this_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expansion_score numeric DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS upgrade_likelihood text DEFAULT 'low';

-- Add Check Constraint if not exists for upgrade_likelihood
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organization_quotas_upgrade_likelihood_check'
  ) THEN
    ALTER TABLE public.organization_quotas
      ADD CONSTRAINT organization_quotas_upgrade_likelihood_check 
      CHECK (upgrade_likelihood IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

-- 3. Helper functions to fetch user contexts without infinite recursion in policies
CREATE OR REPLACE FUNCTION public.get_auth_organization_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Define update policy for organizations (allows owners to update settings and custom domains)
DROP POLICY IF EXISTS "Org owners update own organization" ON public.organizations;
CREATE POLICY "Org owners update own organization" ON public.organizations 
  FOR UPDATE 
  USING (
    id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND (role = 'organization_owner' OR role = 'agency_admin'))
    OR public.is_super_admin()
  )
  WITH CHECK (
    id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND (role = 'organization_owner' OR role = 'agency_admin'))
    OR public.is_super_admin()
  );

-- 5. Define select policy for other profiles in the same organization (enables viewing team members)
DROP POLICY IF EXISTS "Users read same organization profiles" ON public.profiles;
CREATE POLICY "Users read same organization profiles" ON public.profiles 
  FOR SELECT 
  USING (
    organization_id = public.get_auth_organization_id()
    OR public.is_super_admin()
  );

-- 6. Define update policy for managing team member roles/membership in organization
DROP POLICY IF EXISTS "Org owners update organization members" ON public.profiles;
CREATE POLICY "Org owners update organization members" ON public.profiles 
  FOR UPDATE 
  USING (
    (organization_id = public.get_auth_organization_id() AND public.get_auth_role() IN ('organization_owner', 'agency_admin'))
    OR public.is_super_admin()
  )
  WITH CHECK (
    ((organization_id = public.get_auth_organization_id() OR organization_id IS NULL) AND public.get_auth_role() IN ('organization_owner', 'agency_admin'))
    OR public.is_super_admin()
  );
