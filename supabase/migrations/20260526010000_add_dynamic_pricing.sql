-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — Migration
-- 20260526010000_add_dynamic_pricing.sql
-- Adds configurable pricing fields to system_settings
-- ═══════════════════════════════════════════════════════════════════

-- Add new columns for dynamic pricing
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS pricing_pro_monthly numeric DEFAULT 49,
  ADD COLUMN IF NOT EXISTS pricing_enterprise_monthly numeric DEFAULT 199,
  ADD COLUMN IF NOT EXISTS pricing_enterprise_setup numeric DEFAULT 499,
  ADD COLUMN IF NOT EXISTS pricing_annual_license numeric DEFAULT 8000;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
