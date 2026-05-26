-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — Repair Tenant Provisioning Trigger & Backfill NULL Organizations
-- Migration: 20260531000000_fix_user_onboarding_and_wire_details.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. REPAIR: Trigger handle_new_user function ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- 1a. Create organization for the new signup
  INSERT INTO public.organizations (name, billing_tier)
  VALUES (
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'My Organization'),
    'free'
  )
  RETURNING id INTO new_org_id;

  -- 1b. Create/update the contractor profile
  -- Assign role as 'admin' to satisfy checklist constraints (admin is the org owner)
  INSERT INTO public.profiles (
    id, 
    organization_id, 
    email, 
    full_name, 
    company_name, 
    company_email, 
    company_phone, 
    role
  )
  VALUES (
    NEW.id,
    new_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Professional Estimator'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company_phone', ''),
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    organization_id = EXCLUDED.organization_id,
    role = 'admin',
    updated_at = NOW();

  -- 1c. Create organization settings
  INSERT INTO public.organization_settings (organization_id)
  VALUES (new_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- 1d. Create standard free billing subscription
  INSERT INTO public.subscriptions (organization_id, plan, status)
  VALUES (new_org_id, 'free', 'free')
  ON CONFLICT (organization_id) DO NOTHING;

  -- 1e. Create standard $5.00 AI credits limit
  INSERT INTO public.ai_usage_limits (organization_id, monthly_limit_cents, monthly_usage_cents)
  VALUES (new_org_id, 500, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  -- 1f. Seed standard feature flags
  INSERT INTO public.feature_flags (organization_id, name, description, enabled_globally) VALUES
    (new_org_id, 'good-better-best', 'Multi-option proposal packages', true),
    (new_org_id, 'ai-scope', 'AI scope assistant and photo-transcriber', true),
    (new_org_id, 'mobile-field', 'Offline-friendly mobile Field Mode PWA', true),
    (new_org_id, 'automation', 'Automated campaign follow-up rules', true),
    (new_org_id, 'financing', 'Monthly payment financing calculator', true),
    (new_org_id, 'templates', 'Trade-specific estimate templates', true)
  ON CONFLICT (organization_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure auth trigger executes handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── 2. REPAIR: Backfill any existing profiles with NULL organization_id ───
DO $$
DECLARE
  r RECORD;
  new_org_id uuid;
BEGIN
  FOR r IN 
    SELECT id, email, full_name, company_name, role 
    FROM public.profiles 
    WHERE organization_id IS NULL
  LOOP
    -- 2a. Create organization
    INSERT INTO public.organizations (name, billing_tier)
    VALUES (
      COALESCE(NULLIF(r.company_name, ''), NULLIF(r.full_name, ''), 'My Organization'),
      'free'
    )
    RETURNING id INTO new_org_id;

    -- 2b. Update the profile with new organization and make them an admin
    UPDATE public.profiles
    SET organization_id = new_org_id,
        role = CASE WHEN role = 'super_admin' THEN 'super_admin' ELSE 'admin' END
    WHERE id = r.id;

    -- 2c. Create settings
    INSERT INTO public.organization_settings (organization_id)
    VALUES (new_org_id)
    ON CONFLICT (organization_id) DO NOTHING;

    -- 2d. Create subscription
    INSERT INTO public.subscriptions (organization_id, plan, status)
    VALUES (new_org_id, 'free', 'free')
    ON CONFLICT (organization_id) DO NOTHING;

    -- 2e. Create AI limits
    INSERT INTO public.ai_usage_limits (organization_id, monthly_limit_cents, monthly_usage_cents)
    VALUES (new_org_id, 500, 0)
    ON CONFLICT (organization_id) DO NOTHING;

    -- 2f. Create feature flags
    INSERT INTO public.feature_flags (organization_id, name, description, enabled_globally) VALUES
      (new_org_id, 'good-better-best', 'Multi-option proposal packages', true),
      (new_org_id, 'ai-scope', 'AI scope assistant and photo-transcriber', true),
      (new_org_id, 'mobile-field', 'Offline-friendly mobile Field Mode PWA', true),
      (new_org_id, 'automation', 'Automated campaign follow-up rules', true),
      (new_org_id, 'financing', 'Monthly payment financing calculator', true),
      (new_org_id, 'templates', 'Trade-specific estimate templates', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
  END LOOP;
END $$;

-- ─── 3. Force schema reload ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';
