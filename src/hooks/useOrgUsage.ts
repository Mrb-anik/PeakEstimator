/**
 * useOrgUsage.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook to read the current organization's usage metrics.
 * Used by: Settings page, AI scope button, usage indicators.
 *
 * Returns live usage data and a gated canUseAI() check.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabase';
import { useOrganization } from '../providers/OrganizationProvider';

export interface OrgUsage {
  ai_tokens_used: number;
  ai_tokens_limit: number;
  ai_requests_count: number;
  proposals_this_month: number;
  proposals_limit: number;
  seats_used: number;
  seats_limit: number;
  projects_count: number;
  period_start: string;
  last_reset_at: string;
}

export interface UseOrgUsageReturn {
  usage: OrgUsage | null;
  loading: boolean;
  aiUsagePct: number;
  canUseAI: boolean;
  isUnlimited: boolean;
  tokensRemaining: number;
  refresh: () => Promise<void>;
}

export function useOrgUsage(): UseOrgUsageReturn {
  const { organization } = useOrganization();
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organization_usage')
        .select('*')
        .eq('organization_id', organization.id)
        .single();

      if (error) {
        // No usage row yet — return permissive defaults
        setUsage(null);
        return;
      }
      setUsage(data as OrgUsage);
    } catch (err) {
      console.error('[useOrgUsage] error:', err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const aiTokensUsed = usage?.ai_tokens_used ?? 0;
  const aiTokensLimit = usage?.ai_tokens_limit ?? 50_000;
  const isUnlimited = aiTokensLimit === -1;
  const tokensRemaining = isUnlimited ? Infinity : Math.max(0, aiTokensLimit - aiTokensUsed);
  const canUseAI = isUnlimited || tokensRemaining > 0;
  const aiUsagePct = isUnlimited ? 0 : aiTokensLimit > 0 ? Math.min(100, Math.round((aiTokensUsed / aiTokensLimit) * 100)) : 0;

  return {
    usage,
    loading,
    aiUsagePct,
    canUseAI,
    isUnlimited,
    tokensRemaining: isUnlimited ? -1 : tokensRemaining,
    refresh: fetchUsage,
  };
}
