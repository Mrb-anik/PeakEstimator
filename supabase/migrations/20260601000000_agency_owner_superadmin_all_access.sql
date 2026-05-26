-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — Agency Owner & Superadmin All-Access RLS Policies
-- Migration: 20260601000000_agency_owner_superadmin_all_access.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. REPAIR: Trigger handle_new_user function to support pre-selected organization ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- 1a. Create organization for the new signup, or use the pre-selected one from metadata
  IF (NEW.raw_user_meta_data->>'organization_id') IS NOT NULL AND (NEW.raw_user_meta_data->>'organization_id') <> '' THEN
    new_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
  ELSE
    INSERT INTO public.organizations (name, billing_tier)
    VALUES (
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'My Organization'),
      'free'
    )
    RETURNING id INTO new_org_id;
  END IF;

  -- 1b. Create/update the contractor profile
  -- Assign role as 'admin' if not explicitly defined (or set to admin if created for an existing org)
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
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    organization_id = EXCLUDED.organization_id,
    role = COALESCE(NEW.raw_user_meta_data->>'role', profiles.role, 'admin'),
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


-- ─── 2. RLS BYPASS: Define all-access admin policies ───────────────────

-- ── organizations ──
DROP POLICY IF EXISTS "admin_select_all_organizations" ON public.organizations;
CREATE POLICY "admin_select_all_organizations" ON public.organizations FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_organization" ON public.organizations;
CREATE POLICY "admin_insert_any_organization" ON public.organizations FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_organization" ON public.organizations;
CREATE POLICY "admin_update_any_organization" ON public.organizations FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_organization" ON public.organizations;
CREATE POLICY "admin_delete_any_organization" ON public.organizations FOR DELETE USING (public.is_admin());

-- ── organization_settings ──
DROP POLICY IF EXISTS "admin_select_all_org_settings" ON public.organization_settings;
CREATE POLICY "admin_select_all_org_settings" ON public.organization_settings FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_org_settings" ON public.organization_settings;
CREATE POLICY "admin_insert_any_org_settings" ON public.organization_settings FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_org_settings" ON public.organization_settings;
CREATE POLICY "admin_update_any_org_settings" ON public.organization_settings FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_org_settings" ON public.organization_settings;
CREATE POLICY "admin_delete_any_org_settings" ON public.organization_settings FOR DELETE USING (public.is_admin());

-- ── organization_members ──
DROP POLICY IF EXISTS "admin_select_all_org_members" ON public.organization_members;
CREATE POLICY "admin_select_all_org_members" ON public.organization_members FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_org_members" ON public.organization_members;
CREATE POLICY "admin_insert_any_org_members" ON public.organization_members FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_org_members" ON public.organization_members;
CREATE POLICY "admin_update_any_org_members" ON public.organization_members FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_org_members" ON public.organization_members;
CREATE POLICY "admin_delete_any_org_members" ON public.organization_members FOR DELETE USING (public.is_admin());

-- ── feature_flags ──
DROP POLICY IF EXISTS "admin_select_all_feature_flags" ON public.feature_flags;
CREATE POLICY "admin_select_all_feature_flags" ON public.feature_flags FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_feature_flags" ON public.feature_flags;
CREATE POLICY "admin_insert_any_feature_flags" ON public.feature_flags FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_feature_flags" ON public.feature_flags;
CREATE POLICY "admin_update_any_feature_flags" ON public.feature_flags FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_feature_flags" ON public.feature_flags;
CREATE POLICY "admin_delete_any_feature_flags" ON public.feature_flags FOR DELETE USING (public.is_admin());

-- ── ai_usage_limits ──
DROP POLICY IF EXISTS "admin_select_all_ai_limits" ON public.ai_usage_limits;
CREATE POLICY "admin_select_all_ai_limits" ON public.ai_usage_limits FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_ai_limits" ON public.ai_usage_limits;
CREATE POLICY "admin_insert_any_ai_limits" ON public.ai_usage_limits FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_ai_limits" ON public.ai_usage_limits;
CREATE POLICY "admin_update_any_ai_limits" ON public.ai_usage_limits FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_ai_limits" ON public.ai_usage_limits;
CREATE POLICY "admin_delete_any_ai_limits" ON public.ai_usage_limits FOR DELETE USING (public.is_admin());

-- ── subscriptions ──
DROP POLICY IF EXISTS "admin_insert_any_subscription" ON public.subscriptions;
CREATE POLICY "admin_insert_any_subscription" ON public.subscriptions FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_subscription" ON public.subscriptions;
CREATE POLICY "admin_delete_any_subscription" ON public.subscriptions FOR DELETE USING (public.is_admin());

-- ── project_items ──
DROP POLICY IF EXISTS "admin_select_all_project_items" ON public.project_items;
CREATE POLICY "admin_select_all_project_items" ON public.project_items FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_project_item" ON public.project_items;
CREATE POLICY "admin_insert_any_project_item" ON public.project_items FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_project_item" ON public.project_items;
CREATE POLICY "admin_update_any_project_item" ON public.project_items FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_project_item" ON public.project_items;
CREATE POLICY "admin_delete_any_project_item" ON public.project_items FOR DELETE USING (public.is_admin());

-- ── change_orders ──
DROP POLICY IF EXISTS "admin_select_all_change_orders" ON public.change_orders;
CREATE POLICY "admin_select_all_change_orders" ON public.change_orders FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_change_order" ON public.change_orders;
CREATE POLICY "admin_insert_any_change_order" ON public.change_orders FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_change_order" ON public.change_orders;
CREATE POLICY "admin_update_any_change_order" ON public.change_orders FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_change_order" ON public.change_orders;
CREATE POLICY "admin_delete_any_change_order" ON public.change_orders FOR DELETE USING (public.is_admin());

-- ── lien_waivers ──
DROP POLICY IF EXISTS "admin_select_all_lien_waivers" ON public.lien_waivers;
CREATE POLICY "admin_select_all_lien_waivers" ON public.lien_waivers FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_lien_waiver" ON public.lien_waivers;
CREATE POLICY "admin_insert_any_lien_waiver" ON public.lien_waivers FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_lien_waiver" ON public.lien_waivers;
CREATE POLICY "admin_update_any_lien_waiver" ON public.lien_waivers FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_lien_waiver" ON public.lien_waivers;
CREATE POLICY "admin_delete_any_lien_waiver" ON public.lien_waivers FOR DELETE USING (public.is_admin());

-- ── project_schedule ──
DROP POLICY IF EXISTS "admin_select_all_project_schedule" ON public.project_schedule;
CREATE POLICY "admin_select_all_project_schedule" ON public.project_schedule FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_project_schedule" ON public.project_schedule;
CREATE POLICY "admin_insert_any_project_schedule" ON public.project_schedule FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_project_schedule" ON public.project_schedule;
CREATE POLICY "admin_update_any_project_schedule" ON public.project_schedule FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_project_schedule" ON public.project_schedule;
CREATE POLICY "admin_delete_any_project_schedule" ON public.project_schedule FOR DELETE USING (public.is_admin());

-- ── deposit_requests ──
DROP POLICY IF EXISTS "admin_select_all_deposit_requests" ON public.deposit_requests;
CREATE POLICY "admin_select_all_deposit_requests" ON public.deposit_requests FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_deposit_request" ON public.deposit_requests;
CREATE POLICY "admin_insert_any_deposit_request" ON public.deposit_requests FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_deposit_request" ON public.deposit_requests;
CREATE POLICY "admin_update_any_deposit_request" ON public.deposit_requests FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_deposit_request" ON public.deposit_requests;
CREATE POLICY "admin_delete_any_deposit_request" ON public.deposit_requests FOR DELETE USING (public.is_admin());

-- ── proposal_analytics ──
DROP POLICY IF EXISTS "admin_select_all_proposal_analytics" ON public.proposal_analytics;
CREATE POLICY "admin_select_all_proposal_analytics" ON public.proposal_analytics FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_proposal_analytics" ON public.proposal_analytics;
CREATE POLICY "admin_insert_any_proposal_analytics" ON public.proposal_analytics FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_proposal_analytics" ON public.proposal_analytics;
CREATE POLICY "admin_update_any_proposal_analytics" ON public.proposal_analytics FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_proposal_analytics" ON public.proposal_analytics;
CREATE POLICY "admin_delete_any_proposal_analytics" ON public.proposal_analytics FOR DELETE USING (public.is_admin());

-- ── proposal_questions ──
DROP POLICY IF EXISTS "admin_select_all_proposal_questions" ON public.proposal_questions;
CREATE POLICY "admin_select_all_proposal_questions" ON public.proposal_questions FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_proposal_question" ON public.proposal_questions;
CREATE POLICY "admin_insert_any_proposal_question" ON public.proposal_questions FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_proposal_question" ON public.proposal_questions;
CREATE POLICY "admin_update_any_proposal_question" ON public.proposal_questions FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_proposal_question" ON public.proposal_questions;
CREATE POLICY "admin_delete_any_proposal_question" ON public.proposal_questions FOR DELETE USING (public.is_admin());

-- ── revision_requests ──
DROP POLICY IF EXISTS "admin_select_all_revision_requests" ON public.revision_requests;
CREATE POLICY "admin_select_all_revision_requests" ON public.revision_requests FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_revision_request" ON public.revision_requests;
CREATE POLICY "admin_insert_any_revision_request" ON public.revision_requests FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_revision_request" ON public.revision_requests;
CREATE POLICY "admin_update_any_revision_request" ON public.revision_requests FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_revision_request" ON public.revision_requests;
CREATE POLICY "admin_delete_any_revision_request" ON public.revision_requests FOR DELETE USING (public.is_admin());

-- ── maintenance_contracts ──
DROP POLICY IF EXISTS "admin_select_all_maintenance_contracts" ON public.maintenance_contracts;
CREATE POLICY "admin_select_all_maintenance_contracts" ON public.maintenance_contracts FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_maintenance_contract" ON public.maintenance_contracts;
CREATE POLICY "admin_insert_any_maintenance_contract" ON public.maintenance_contracts FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_maintenance_contract" ON public.maintenance_contracts;
CREATE POLICY "admin_update_any_maintenance_contract" ON public.maintenance_contracts FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_maintenance_contract" ON public.maintenance_contracts;
CREATE POLICY "admin_delete_any_maintenance_contract" ON public.maintenance_contracts FOR DELETE USING (public.is_admin());

-- ── subcontractor_bids ──
DROP POLICY IF EXISTS "admin_select_all_subcontractor_bids" ON public.subcontractor_bids;
CREATE POLICY "admin_select_all_subcontractor_bids" ON public.subcontractor_bids FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_subcontractor_bid" ON public.subcontractor_bids;
CREATE POLICY "admin_insert_any_subcontractor_bid" ON public.subcontractor_bids FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_subcontractor_bid" ON public.subcontractor_bids;
CREATE POLICY "admin_update_any_subcontractor_bid" ON public.subcontractor_bids FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_subcontractor_bid" ON public.subcontractor_bids;
CREATE POLICY "admin_delete_any_subcontractor_bid" ON public.subcontractor_bids FOR DELETE USING (public.is_admin());

-- ── broadcast_emails ──
DROP POLICY IF EXISTS "admin_select_all_broadcast_emails" ON public.broadcast_emails;
CREATE POLICY "admin_select_all_broadcast_emails" ON public.broadcast_emails FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_broadcast_email" ON public.broadcast_emails;
CREATE POLICY "admin_insert_any_broadcast_email" ON public.broadcast_emails FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_broadcast_email" ON public.broadcast_emails;
CREATE POLICY "admin_update_any_broadcast_email" ON public.broadcast_emails FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_broadcast_email" ON public.broadcast_emails;
CREATE POLICY "admin_delete_any_broadcast_email" ON public.broadcast_emails FOR DELETE USING (public.is_admin());

-- ── audit_logs ──
DROP POLICY IF EXISTS "admin_select_all_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_select_all_audit_logs" ON public.audit_logs FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_any_audit_log" ON public.audit_logs;
CREATE POLICY "admin_insert_any_audit_log" ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_any_audit_log" ON public.audit_logs;
CREATE POLICY "admin_update_any_audit_log" ON public.audit_logs FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_any_audit_log" ON public.audit_logs;
CREATE POLICY "admin_delete_any_audit_log" ON public.audit_logs FOR DELETE USING (public.is_admin());

-- ── Force schema reload ──
NOTIFY pgrst, 'reload schema';
