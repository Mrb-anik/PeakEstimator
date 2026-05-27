/**
 * UsageMetricsTab.tsx — Platform-wide Usage & Revenue Metrics Tab
 * ─────────────────────────────────────────────────────────────────
 * Real-time platform analytics for platform owners.
 *
 * Metrics:
 *   - Total revenue (MRR, ARR)
 *   - Active organizations by tier
 *   - AI token consumption across all orgs
 *   - Proposal conversion rates
 *   - Churn indicators
 *   - Per-org usage breakdown
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, Users, Zap, FileText,
  RefreshCw, Building2, Activity, BarChart2, ArrowUp, ArrowDown,
} from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/currency';

// ─── Types ─────────────────────────────────────────────────────────

interface PlatformMetrics {
  total_orgs: number;
  orgs_by_tier: { free: number; pro: number; enterprise: number };
  mrr: number;
  arr: number;
  total_members: number;
  total_ai_tokens_used: number;
  total_proposals: number;
  active_orgs_30d: number;
}

interface OrgUsageRow {
  id: string;
  name: string;
  billing_tier: string;
  member_count: number;
  ai_tokens_used: number;
  ai_tokens_limit: number;
  proposals_count: number;
  last_active?: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const MRR_BY_TIER: Record<string, number> = {
  free: 0,
  pro: 99,
  enterprise: 299,
};

// ─── Component ─────────────────────────────────────────────────────

export default function UsageMetricsTab() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [orgUsage, setOrgUsage] = useState<OrgUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'ai_tokens' | 'proposals' | 'tier'>('ai_tokens');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsResult, membersResult, usageResult, projectsResult] = await Promise.all([
        supabase.from('organizations').select('id, name, billing_tier, created_at'),
        supabase.from('profiles').select('id, organization_id'),
        supabase.from('organization_usage').select('organization_id, ai_tokens_used, ai_tokens_limit, proposals_this_month, updated_at'),
        supabase.from('projects').select('id, organization_id, created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const orgs = orgsResult.data ?? [];
      const members = membersResult.data ?? [];
      const usage = usageResult.data ?? [];
      const recentProjects = projectsResult.data ?? [];

      const usageMap = new Map(usage.map(u => [u.organization_id, u]));
      const memberMap = new Map<string, number>();
      members.forEach(m => {
        if (m.organization_id) {
          memberMap.set(m.organization_id, (memberMap.get(m.organization_id) ?? 0) + 1);
        }
      });

      const recentActiveOrgIds = new Set(recentProjects.map(p => p.organization_id).filter(Boolean));

      // Build per-org usage rows
      const orgRows: OrgUsageRow[] = orgs.map(org => {
        const u = usageMap.get(org.id);
        const orgProjects = recentProjects.filter(p => p.organization_id === org.id);
        return {
          id: org.id,
          name: org.name,
          billing_tier: org.billing_tier ?? 'free',
          member_count: memberMap.get(org.id) ?? 0,
          ai_tokens_used: u?.ai_tokens_used ?? 0,
          ai_tokens_limit: u?.ai_tokens_limit ?? 50_000,
          proposals_count: orgProjects.length,
          last_active: u?.updated_at,
        };
      });

      const tierCounts = { free: 0, pro: 0, enterprise: 0 };
      let totalAiTokens = 0;
      orgs.forEach(org => {
        const tier = (org.billing_tier ?? 'free') as keyof typeof tierCounts;
        if (tier in tierCounts) tierCounts[tier]++;
        totalAiTokens += usageMap.get(org.id)?.ai_tokens_used ?? 0;
      });

      const mrr = (tierCounts.pro * MRR_BY_TIER.pro) + (tierCounts.enterprise * MRR_BY_TIER.enterprise);

      setMetrics({
        total_orgs: orgs.length,
        orgs_by_tier: tierCounts,
        mrr,
        arr: mrr * 12,
        total_members: members.length,
        total_ai_tokens_used: totalAiTokens,
        total_proposals: recentProjects.length,
        active_orgs_30d: recentActiveOrgIds.size,
      });

      // Sort rows
      const sorted = orgRows.sort((a, b) => {
        if (sortBy === 'ai_tokens') return b.ai_tokens_used - a.ai_tokens_used;
        if (sortBy === 'proposals') return b.proposals_count - a.proposals_count;
        const tierOrder: Record<string, number> = { enterprise: 3, pro: 2, free: 1 };
        return (tierOrder[b.billing_tier] ?? 0) - (tierOrder[a.billing_tier] ?? 0);
      });
      setOrgUsage(sorted);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load metrics';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin text-copper" />
      </div>
    );
  }

  const m = metrics!;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-copper" /> Usage & Revenue Metrics
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Platform-wide analytics — updated in real time</p>
        </div>
        <button onClick={fetchMetrics} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-800 text-xs font-bold text-slate-500 hover:border-copper hover:text-copper transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'MRR', value: formatCurrency(m.mrr), icon: DollarSign, color: 'text-emerald-400', sub: `ARR: ${formatCurrency(m.arr)}` },
          { label: 'Organizations', value: m.total_orgs, icon: Building2, color: 'text-blue-400', sub: `${m.active_orgs_30d} active (30d)` },
          { label: 'Total Members', value: m.total_members, icon: Users, color: 'text-purple-400', sub: `Across all orgs` },
          { label: 'AI Tokens Used', value: `${(m.total_ai_tokens_used / 1_000_000).toFixed(1)}M`, icon: Zap, color: 'text-amber-400', sub: `This month` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</div>
            <div className="text-[10px] text-slate-400 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Plan distribution bar */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4">Plan Distribution</h3>
        <div className="space-y-3">
          {([
            ['Enterprise', m.orgs_by_tier.enterprise, 'bg-amber-500', 'text-amber-500'],
            ['Pro', m.orgs_by_tier.pro, 'bg-blue-500', 'text-blue-400'],
            ['Free', m.orgs_by_tier.free, 'bg-slate-300 dark:bg-navy-700', 'text-slate-500'],
          ] as const).map(([label, count, barColor, textColor]) => (
            <div key={label} className="flex items-center gap-3">
              <span className={`text-[10px] font-bold w-16 ${textColor}`}>{label}</span>
              <div className="flex-1 h-2 bg-slate-100 dark:bg-navy-900 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: m.total_orgs > 0 ? `${(count / m.total_orgs) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-[10px] font-black text-slate-900 dark:text-white w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-org usage table */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-app-border dark:border-navy-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">Per-Organization Usage</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Sort:</span>
            {(['ai_tokens', 'proposals', 'tier'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all ${sortBy === s ? 'bg-copper text-white' : 'text-slate-400 hover:text-copper'}`}
              >
                {s === 'ai_tokens' ? 'AI Usage' : s === 'proposals' ? 'Proposals' : 'Tier'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-950 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5 text-left">Organization</th>
                <th className="py-3 px-5 text-left">Plan</th>
                <th className="py-3 px-5 text-center">Seats</th>
                <th className="py-3 px-5 text-left">AI Tokens</th>
                <th className="py-3 px-5 text-center">Proposals (30d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border dark:divide-navy-800">
              {orgUsage.map(org => {
                const usagePct = org.ai_tokens_limit > 0 ? Math.min(100, Math.round((org.ai_tokens_used / org.ai_tokens_limit) * 100)) : 0;
                const isUnlimited = org.ai_tokens_limit === -1;
                return (
                  <tr key={org.id} className="hover:bg-slate-50/40 dark:hover:bg-navy-950/30">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-slate-900 dark:text-white">{org.name}</div>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                        org.billing_tier === 'enterprise' ? 'bg-amber-500/20 text-amber-500' :
                        org.billing_tier === 'pro' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-slate-100 text-slate-500 dark:bg-navy-900 dark:text-slate-400'
                      }`}>{org.billing_tier}</span>
                    </td>
                    <td className="py-3 px-5 text-center font-bold text-slate-900 dark:text-white">
                      {org.member_count}
                    </td>
                    <td className="py-3 px-5 w-48">
                      {isUnlimited ? (
                        <span className="text-emerald-400 font-bold text-[10px]">Unlimited</span>
                      ) : (
                        <div>
                          <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                            <span>{(org.ai_tokens_used / 1000).toFixed(0)}K / {(org.ai_tokens_limit / 1000).toFixed(0)}K</span>
                            <span className={usagePct > 90 ? 'text-red-400 font-bold' : ''}>{usagePct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-navy-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-5 text-center font-bold text-slate-900 dark:text-white">
                      {org.proposals_count}
                    </td>
                  </tr>
                );
              })}
              {orgUsage.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">No organization data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
