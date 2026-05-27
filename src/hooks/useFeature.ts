/**
 * useFeature.ts
 * ─────────────────────────────────────────────────────────────────
 * Dynamic feature flag gating.
 *
 * Usage:
 *   const aiEnabled = useFeature('ai-scope');
 *   const { hasFeature } = useFeatureGate();
 *
 * Feature entitlement is checked in priority order:
 *   1. Org-level feature_flags record (most specific)
 *   2. Plan-level defaults (billing_tier → feature matrix)
 *   3. Global platform default (false if not found)
 *
 * Never enforce feature gating on frontend alone —
 * backend Edge Functions must also validate plan access.
 * ─────────────────────────────────────────────────────────────────
 */

import { useOrganization } from '../providers/OrganizationProvider';
import type { BillingTier } from '../types';

// ─── Plan → Feature matrix ─────────────────────────────────────────
// These are the DEFAULT entitlements per plan tier.
// Org-level feature flags can override these in either direction.

const PLAN_FEATURES: Record<BillingTier, Set<string>> = {
  free: new Set([
    'templates',
    'mobile-field',
  ]),
  pro: new Set([
    'templates',
    'mobile-field',
    'good-better-best',
    'ai-scope',
    'automation',
    'financing',
    'export-pdf',
    'proposal-analytics',
  ]),
  enterprise: new Set([
    'templates',
    'mobile-field',
    'good-better-best',
    'ai-scope',
    'automation',
    'financing',
    'export-pdf',
    'proposal-analytics',
    'white-label',
    'api-access',
    'custom-domain',
    'priority-support',
    'advanced-analytics',
    'change-orders',
    'lien-waivers',
    'subcontractor-bids',
    'maintenance-contracts',
  ]),
};

// ─── Hook: single feature check ───────────────────────────────────

export function useFeature(featureName: string): boolean {
  const { organization, featureFlags } = useOrganization();

  // Check org-level feature flag first (can override plan)
  const orgFlag = featureFlags.find(f => f.name === featureName);
  if (orgFlag !== undefined) {
    // If the flag exists for this org, use its enabled_globally value
    return orgFlag.enabled_globally;
  }

  // Fall back to plan-level entitlement
  const tier = (organization?.billing_tier ?? 'free') as BillingTier;
  return PLAN_FEATURES[tier]?.has(featureName) ?? false;
}

// ─── Hook: gate object for multiple checks ────────────────────────

export interface FeatureGate {
  hasFeature: (name: string) => boolean;
  plan: BillingTier;
  isEnterprise: boolean;
  isPro: boolean;
  isFree: boolean;
}

export function useFeatureGate(): FeatureGate {
  const { organization, featureFlags } = useOrganization();
  const tier = (organization?.billing_tier ?? 'free') as BillingTier;

  const hasFeature = (featureName: string): boolean => {
    const orgFlag = featureFlags.find(f => f.name === featureName);
    if (orgFlag !== undefined) return orgFlag.enabled_globally;
    return PLAN_FEATURES[tier]?.has(featureName) ?? false;
  };

  return {
    hasFeature,
    plan: tier,
    isEnterprise: tier === 'enterprise',
    isPro: tier === 'pro' || tier === 'enterprise',
    isFree: tier === 'free',
  };
}
