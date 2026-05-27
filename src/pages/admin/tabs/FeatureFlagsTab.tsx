/**
 * FeatureFlagsTab.tsx — Platform-wide Feature Flag Management
 * ─────────────────────────────────────────────────────────────────
 * Extracted from AdminPortal.tsx monolith.
 *
 * Two levels of control:
 *   1. Global defaults — apply to all orgs on a plan tier
 *   2. Per-org overrides — managed in SubAccountsTab
 *
 * Platform owners can:
 *   - See all active feature flags across all orgs
 *   - Toggle global feature availability
 *   - See which orgs have overrides
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { Flag, RefreshCw, ToggleLeft, ToggleRight, Building2 } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { toast } from 'sonner';

interface FeatureFlagRow {
  name: string;
  label: string;
  tier: 'free' | 'pro' | 'enterprise';
  description: string;
  orgs_with_override: number;
  global_enabled: boolean;
}

const ALL_FLAGS: Omit<FeatureFlagRow, 'orgs_with_override' | 'global_enabled'>[] = [
  { name: 'templates', label: 'Proposal Templates', tier: 'free', description: 'Pre-built templates for faster estimation' },
  { name: 'mobile-field', label: 'Mobile Field Mode', tier: 'free', description: 'Simplified mobile view for field crews' },
  { name: 'good-better-best', label: 'Good/Better/Best', tier: 'pro', description: 'Three-tier proposal options' },
  { name: 'ai-scope', label: 'AI Scope Generator', tier: 'pro', description: 'AI-powered scope and line item generation' },
  { name: 'automation', label: 'Follow-up Automation', tier: 'pro', description: 'Automated lead nurture campaigns' },
  { name: 'financing', label: 'Financing Options', tier: 'pro', description: 'Built-in financing calculators' },
  { name: 'export-pdf', label: 'PDF Export', tier: 'pro', description: 'Export proposals as branded PDFs' },
  { name: 'proposal-analytics', label: 'Proposal Analytics', tier: 'pro', description: 'View tracking and engagement metrics' },
  { name: 'white-label', label: 'White Label Branding', tier: 'enterprise', description: 'Remove PeakEstimator branding' },
  { name: 'custom-domain', label: 'Custom Domain', tier: 'enterprise', description: 'Use your own domain for client portals' },
  { name: 'api-access', label: 'API Access', tier: 'enterprise', description: 'REST API and webhook integrations' },
  { name: 'advanced-analytics', label: 'Advanced Analytics', tier: 'enterprise', description: 'Revenue forecasting and pipeline metrics' },
  { name: 'change-orders', label: 'Change Orders', tier: 'enterprise', description: 'In-field change order management' },
  { name: 'lien-waivers', label: 'Lien Waivers', tier: 'enterprise', description: 'Digital lien waiver generation' },
  { name: 'maintenance-contracts', label: 'Maintenance Contracts', tier: 'enterprise', description: 'Recurring service agreement builder' },
  { name: 'subcontractor-bids', label: 'Subcontractor Bids', tier: 'enterprise', description: 'Sub-bid request and tracking' },
];

export default function FeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState<'all' | 'free' | 'pro' | 'enterprise'>('all');

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      // Count how many orgs have each flag overridden
      const { data: overrides } = await supabase
        .from('feature_flags')
        .select('name');

      const overrideCount = new Map<string, number>();
      (overrides ?? []).forEach(row => {
        overrideCount.set(row.name, (overrideCount.get(row.name) ?? 0) + 1);
      });

      const rows: FeatureFlagRow[] = ALL_FLAGS.map(f => ({
        ...f,
        orgs_with_override: overrideCount.get(f.name) ?? 0,
        global_enabled: true, // Global flags are always on at platform level — orgs can override
      }));

      setFlags(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load flags';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const tierColors: Record<string, string> = {
    enterprise: 'bg-amber-500/20 text-amber-500',
    pro: 'bg-blue-500/20 text-blue-400',
    free: 'bg-emerald-500/20 text-emerald-500',
  };

  const filtered = flags.filter(f => filterTier === 'all' || f.tier === filterTier);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Flag className="w-4 h-4 text-copper" /> Feature Flags
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Global feature matrix. Per-org overrides are managed in Sub-Accounts tab.
          </p>
        </div>
        <button onClick={fetchFlags} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-800 text-xs font-bold text-slate-500 hover:border-copper hover:text-copper transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Tier filter */}
      <div className="flex gap-2">
        {(['all', 'free', 'pro', 'enterprise'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterTier(t)}
            className={`text-[10px] px-3 py-1 rounded-lg font-bold uppercase tracking-wide transition-all ${filterTier === t ? 'bg-copper text-white' : 'border border-slate-200 dark:border-navy-700 text-slate-400 hover:text-copper hover:border-copper'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading feature flags...</div>
        ) : (
          <div className="divide-y divide-app-border dark:divide-navy-800">
            {filtered.map(flag => (
              <div key={flag.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/40 dark:hover:bg-navy-950/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">{flag.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide ${tierColors[flag.tier]}`}>
                      {flag.tier}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">{flag.description}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500">{flag.name}</span>
                    {flag.orgs_with_override > 0 && (
                      <span className="flex items-center gap-1 text-[9px] text-blue-400 ml-2">
                        <Building2 className="w-2.5 h-2.5" />
                        {flag.orgs_with_override} org override{flag.orgs_with_override !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-[9px] font-bold ${flag.global_enabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {flag.global_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {flag.global_enabled
                    ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                    : <ToggleLeft className="w-6 h-6 text-slate-400" />
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
