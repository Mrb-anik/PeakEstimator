/**
 * SubAccountsTab.tsx — Organizations / Sub-Accounts Manager Tab
 * ─────────────────────────────────────────────────────────────────
 * Extracted from AdminPortal.tsx monolith.
 * Manages the platform's multi-tenant organization hierarchy.
 *
 * Features:
 *   - List all organizations with billing tier, member count, usage
 *   - Create / edit / delete organizations
 *   - Per-org feature flag overrides
 *   - Per-org AI token limits
 *   - Impersonate org owner via handleLoginAs
 *   - Invite users into specific orgs
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, RefreshCw, LogIn, Pencil, Trash2, X,
  Save, Users, ToggleLeft, ToggleRight, Zap, UserPlus, Globe,
  ChevronRight, Shield, CreditCard, Activity,
} from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { toast } from 'sonner';
import type { Organization, Profile, FeatureFlag } from '../../../types';

// ─── Types ─────────────────────────────────────────────────────────

interface OrgWithUsage extends Organization {
  member_count?: number;
  ai_tokens_used?: number;
  ai_tokens_limit?: number;
  owner?: Profile | null;
}

interface OrgFormData {
  name: string;
  subdomain: string;
  billing_tier: 'free' | 'pro' | 'enterprise';
  ai_tokens_limit?: number;
}

interface SubAccountsTabProps {
  members: Profile[];
  onImpersonate: (profile: Profile) => void;
  onRefreshMembers: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────

const TIER_STYLES: Record<string, string> = {
  enterprise: 'bg-amber-500/20 text-amber-500',
  pro: 'bg-blue-500/20 text-blue-400',
  free: 'bg-slate-100 text-slate-500 dark:bg-navy-900 dark:text-slate-400',
};

const DEFAULT_AI_LIMITS: Record<string, number> = {
  free: 50_000,
  pro: 500_000,
  enterprise: -1, // unlimited
};

// ─── Component ─────────────────────────────────────────────────────

export default function SubAccountsTab({ members, onImpersonate, onRefreshMembers }: SubAccountsTabProps) {
  const [organizations, setOrganizations] = useState<OrgWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Org CRUD modal
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState<OrgFormData>({ name: '', subdomain: '', billing_tier: 'free' });
  const [savingOrg, setSavingOrg] = useState(false);

  // Feature flags modal
  const [showFlagsModal, setShowFlagsModal] = useState(false);
  const [flagsTarget, setFlagsTarget] = useState<OrgWithUsage | null>(null);
  const [orgFlags, setOrgFlags] = useState<FeatureFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(false);

  // AI limits modal
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [limitsTarget, setLimitsTarget] = useState<OrgWithUsage | null>(null);
  const [newTokenLimit, setNewTokenLimit] = useState<number>(500_000);
  const [savingLimits, setSavingLimits] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<OrgWithUsage | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviting, setInviting] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsResult, usageResult] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('organization_usage').select('organization_id, ai_tokens_used, ai_tokens_limit'),
      ]);

      if (orgsResult.error) throw orgsResult.error;

      const usageMap = new Map(
        (usageResult.data ?? []).map(u => [u.organization_id, u])
      );

      const enriched: OrgWithUsage[] = (orgsResult.data ?? []).map(org => {
        const orgMembers = members.filter(m => m.organization_id === org.id);
        const owner = orgMembers.find(m => m.role === 'admin' || m.role === 'super_admin') ?? orgMembers[0] ?? null;
        const usage = usageMap.get(org.id);
        return {
          ...org,
          member_count: orgMembers.length,
          ai_tokens_used: usage?.ai_tokens_used ?? 0,
          ai_tokens_limit: usage?.ai_tokens_limit ?? DEFAULT_AI_LIMITS[org.billing_tier ?? 'free'],
          owner,
        };
      });

      setOrganizations(enriched);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load organizations';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [members]);

  useEffect(() => { fetchOrganizations(); }, [fetchOrganizations]);

  // ── CRUD ─────────────────────────────────────────────────────────
  const handleSaveOrg = async () => {
    if (!orgForm.name.trim()) { toast.error('Organization name is required'); return; }

    setSavingOrg(true);
    try {
      if (editingOrg) {
        const { error } = await supabase
          .from('organizations')
          .update({ ...orgForm, updated_at: new Date().toISOString() })
          .eq('id', editingOrg.id);
        if (error) throw error;
        toast.success('Organization updated');
      } else {
        const { data, error } = await supabase
          .from('organizations')
          .insert({ ...orgForm })
          .select()
          .single();
        if (error) throw error;
        // Seed usage row
        await supabase.from('organization_usage').insert({
          organization_id: data.id,
          ai_tokens_limit: DEFAULT_AI_LIMITS[orgForm.billing_tier],
        });
        toast.success('Organization created');
      }
      setShowOrgModal(false);
      await fetchOrganizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSavingOrg(false);
    }
  };

  const handleDeleteOrg = async (org: OrgWithUsage) => {
    if (!confirm(`Delete "${org.name}"? This cannot be undone. All members will lose access.`)) return;
    const { error } = await supabase.from('organizations').delete().eq('id', org.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Organization deleted');
    fetchOrganizations();
    onRefreshMembers();
  };

  const handleUpdateBillingTier = async (org: OrgWithUsage, tier: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ billing_tier: tier, updated_at: new Date().toISOString() })
      .eq('id', org.id);
    if (error) { toast.error(error.message); return; }
    const newLimit = DEFAULT_AI_LIMITS[tier] ?? 50_000;
    await supabase.from('organization_usage').upsert({ organization_id: org.id, ai_tokens_limit: newLimit }, { onConflict: 'organization_id' });
    toast.success(`Plan updated to ${tier}`);
    fetchOrganizations();
  };

  // ── Feature Flags ────────────────────────────────────────────────
  const openFlagsModal = async (org: OrgWithUsage) => {
    setFlagsTarget(org);
    setLoadingFlags(true);
    setShowFlagsModal(true);
    const { data, error } = await supabase.from('feature_flags').select('*').eq('organization_id', org.id);
    if (error) { toast.error(error.message); setLoadingFlags(false); return; }
    setOrgFlags((data as FeatureFlag[]) ?? []);
    setLoadingFlags(false);
  };

  const handleToggleFlag = async (flagName: string, currentValue: boolean) => {
    if (!flagsTarget) return;
    const { error } = await supabase
      .from('feature_flags')
      .upsert({
        organization_id: flagsTarget.id,
        name: flagName,
        enabled_globally: !currentValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,name' });
    if (error) { toast.error(error.message); return; }
    setOrgFlags(prev => {
      const exists = prev.find(f => f.name === flagName);
      if (exists) return prev.map(f => f.name === flagName ? { ...f, enabled_globally: !currentValue } : f);
      return [...prev, { id: '', organization_id: flagsTarget.id, name: flagName, enabled_globally: !currentValue, updated_at: new Date().toISOString() } as FeatureFlag];
    });
  };

  const AVAILABLE_FLAGS = [
    { name: 'ai-scope', label: 'AI Scope Generator', tier: 'pro' },
    { name: 'good-better-best', label: 'Good/Better/Best Tiers', tier: 'pro' },
    { name: 'automation', label: 'Follow-up Automation', tier: 'pro' },
    { name: 'financing', label: 'Financing Options', tier: 'pro' },
    { name: 'export-pdf', label: 'PDF Export', tier: 'pro' },
    { name: 'proposal-analytics', label: 'Proposal Analytics', tier: 'pro' },
    { name: 'white-label', label: 'White Label Branding', tier: 'enterprise' },
    { name: 'custom-domain', label: 'Custom Domain', tier: 'enterprise' },
    { name: 'api-access', label: 'API Access', tier: 'enterprise' },
    { name: 'change-orders', label: 'Change Orders', tier: 'enterprise' },
    { name: 'lien-waivers', label: 'Lien Waivers', tier: 'enterprise' },
    { name: 'maintenance-contracts', label: 'Maintenance Contracts', tier: 'enterprise' },
    { name: 'subcontractor-bids', label: 'Subcontractor Bids', tier: 'enterprise' },
  ];

  // ── AI Limits ────────────────────────────────────────────────────
  const openLimitsModal = (org: OrgWithUsage) => {
    setLimitsTarget(org);
    setNewTokenLimit(org.ai_tokens_limit ?? DEFAULT_AI_LIMITS[org.billing_tier ?? 'free']);
    setShowLimitsModal(true);
  };

  const handleSaveLimits = async () => {
    if (!limitsTarget) return;
    setSavingLimits(true);
    const { error } = await supabase
      .from('organization_usage')
      .upsert({ organization_id: limitsTarget.id, ai_tokens_limit: newTokenLimit, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
    setSavingLimits(false);
    if (error) { toast.error(error.message); return; }
    toast.success('AI limits updated');
    setShowLimitsModal(false);
    fetchOrganizations();
  };

  // ── Invite ───────────────────────────────────────────────────────
  const handleInviteUser = async () => {
    if (!inviteTarget || !inviteEmail.trim()) { toast.error('Email is required'); return; }
    setInviting(true);
    try {
      const { data, error: inviteError } = await supabase.functions.invoke('admin-manager', {
        body: {
          action: 'create_invite',
          email: inviteEmail.trim(),
          full_name: inviteName.trim(),
          organization_id: inviteTarget.id,
          role: inviteRole,
        },
      });
      if (inviteError) throw inviteError;
      toast.success(`Invite sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail(''); setInviteName('');
      onRefreshMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invite failed';
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────
  const filtered = organizations.filter(org =>
    !search ||
    org.name?.toLowerCase().includes(search.toLowerCase()) ||
    org.subdomain?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-copper" /> Sub-Accounts (Organizations)
          </h2>
          <p className="text-[11px] text-slate-400">
            Manage contractor organizations — billing, feature flags, AI limits, and impersonation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrganizations}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-800 text-xs font-bold text-slate-500 dark:text-slate-400 hover:border-copper hover:text-copper transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => { setEditingOrg(null); setOrgForm({ name: '', subdomain: '', billing_tier: 'free' }); setShowOrgModal(true); }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-copper hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <Plus className="w-3.5 h-3.5" /> Create Sub-Account
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search organizations..."
        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-copper/30"
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orgs', value: organizations.length, icon: Building2, color: 'text-blue-400' },
          { label: 'Enterprise', value: organizations.filter(o => o.billing_tier === 'enterprise').length, icon: Shield, color: 'text-amber-500' },
          { label: 'Pro', value: organizations.filter(o => o.billing_tier === 'pro').length, icon: CreditCard, color: 'text-blue-400' },
          { label: 'Free', value: organizations.filter(o => o.billing_tier === 'free').length, icon: Activity, color: 'text-slate-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-xl p-3 flex items-center gap-3">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <div>
              <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{stat.value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-950 border-b border-app-border text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-5">Subdomain</th>
                <th className="py-3.5 px-5">Plan</th>
                <th className="py-3.5 px-5 text-center">Seats</th>
                <th className="py-3.5 px-5">AI Usage</th>
                <th className="py-3.5 px-5">Created</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border dark:divide-navy-800 text-xs">
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading organizations...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {search ? 'No organizations match your search.' : 'No organizations yet. Create the first one.'}
                  </td>
                </tr>
              ) : filtered.map(org => {
                const usagePct = org.ai_tokens_limit && org.ai_tokens_limit > 0
                  ? Math.min(100, Math.round(((org.ai_tokens_used ?? 0) / org.ai_tokens_limit) * 100))
                  : 0;
                const isUnlimited = org.ai_tokens_limit === -1;

                return (
                  <tr key={org.id} className="hover:bg-slate-50/40 dark:hover:bg-navy-950/30">
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 dark:text-white">{org.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[160px]">{org.id}</div>
                      {org.owner && (
                        <div className="text-[10px] text-slate-400 mt-0.5">Owner: {org.owner.full_name || org.owner.email}</div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-slate-500 font-mono text-[10px]">
                      {org.subdomain ? `${org.subdomain}.peakestimator.top` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-4 px-5">
                      <select
                        value={org.billing_tier ?? 'free'}
                        onChange={e => handleUpdateBillingTier(org, e.target.value)}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border-0 cursor-pointer ${TIER_STYLES[org.billing_tier ?? 'free']}`}
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="py-4 px-5 text-center font-bold text-slate-900 dark:text-white">
                      {org.member_count ?? 0}
                    </td>
                    <td className="py-4 px-5 w-36">
                      {isUnlimited ? (
                        <span className="text-[10px] text-emerald-400 font-bold">Unlimited</span>
                      ) : (
                        <div>
                          <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                            <span>{((org.ai_tokens_used ?? 0) / 1000).toFixed(0)}K</span>
                            <span>{usagePct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-navy-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-slate-400 text-[10px]">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Impersonate */}
                        {org.owner ? (
                          <button
                            onClick={() => onImpersonate(org.owner!)}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold hover:bg-copper hover:text-white transition-all"
                            title={`Impersonate ${org.owner.full_name || org.owner.email}`}
                          >
                            <LogIn className="w-3 h-3" /> Login As
                          </button>
                        ) : (
                          <button
                            onClick={() => { setInviteTarget(org); setShowInviteModal(true); }}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-bold hover:bg-amber-500 hover:text-white transition-all"
                          >
                            <UserPlus className="w-3 h-3" /> Add Owner
                          </button>
                        )}
                        {/* Feature flags */}
                        <button
                          onClick={() => openFlagsModal(org)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all"
                        >
                          <ToggleRight className="w-3 h-3" /> Flags
                        </button>
                        {/* AI limits */}
                        <button
                          onClick={() => openLimitsModal(org)}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-500 rounded-lg text-[10px] font-bold hover:bg-purple-500 hover:text-white transition-all"
                        >
                          <Zap className="w-3 h-3" /> AI
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => { setEditingOrg(org); setOrgForm({ name: org.name, subdomain: org.subdomain ?? '', billing_tier: (org.billing_tier as 'free' | 'pro' | 'enterprise') ?? 'free' }); setShowOrgModal(true); }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-900 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                          title="Edit organization"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteOrg(org)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete organization"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Org CRUD Modal ─────────────────────────────────────────── */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy rounded-2xl shadow-2xl border border-app-border dark:border-navy-700 w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white">
                {editingOrg ? 'Edit Organization' : 'Create Sub-Account'}
              </h3>
              <button onClick={() => setShowOrgModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Organization Name *</label>
                <input
                  value={orgForm.name}
                  onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Acme HVAC Services"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-copper/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Subdomain</label>
                <div className="flex items-center">
                  <input
                    value={orgForm.subdomain}
                    onChange={e => setOrgForm(f => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    placeholder="acme-hvac"
                    className="flex-1 px-3 py-2 rounded-l-xl border border-r-0 border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <span className="px-3 py-2 rounded-r-xl border border-slate-200 dark:border-navy-700 bg-slate-100 dark:bg-navy-800 text-[10px] text-slate-400">.peakestimator.top</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Billing Tier</label>
                <select
                  value={orgForm.billing_tier}
                  onChange={e => setOrgForm(f => ({ ...f, billing_tier: e.target.value as 'free' | 'pro' | 'enterprise' }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro ($99/mo)</option>
                  <option value="enterprise">Enterprise ($299/mo)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveOrg}
                disabled={savingOrg}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-copper text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {savingOrg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editingOrg ? 'Save Changes' : 'Create Organization'}
              </button>
              <button onClick={() => setShowOrgModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature Flags Modal ───────────────────────────────────── */}
      {showFlagsModal && flagsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy rounded-2xl shadow-2xl border border-app-border dark:border-navy-700 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white">Feature Flags</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{flagsTarget.name} — Overrides apply on top of the plan tier</p>
              </div>
              <button onClick={() => setShowFlagsModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {loadingFlags ? (
              <div className="py-8 text-center text-slate-400 text-xs">Loading flags...</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                {AVAILABLE_FLAGS.map(flag => {
                  const record = orgFlags.find(f => f.name === flag.name);
                  const enabled = record?.enabled_globally ?? false;
                  return (
                    <div key={flag.name} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors">
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{flag.label}</div>
                        <div className="text-[9px] text-slate-400 font-mono">{flag.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${flag.tier === 'enterprise' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'}`}>
                          {flag.tier}
                        </span>
                        <button onClick={() => handleToggleFlag(flag.name, enabled)} className="transition-all">
                          {enabled
                            ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                            : <ToggleLeft className="w-6 h-6 text-slate-400" />
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setShowFlagsModal(false)}
              className="w-full px-4 py-2 rounded-xl bg-copper text-white text-xs font-bold hover:opacity-90 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── AI Limits Modal ───────────────────────────────────────── */}
      {showLimitsModal && limitsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy rounded-2xl shadow-2xl border border-app-border dark:border-navy-700 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white">AI Token Limits</h3>
              <button onClick={() => setShowLimitsModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Set monthly AI token limit for <strong className="text-slate-900 dark:text-white">{limitsTarget.name}</strong>. Use -1 for unlimited.</p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Monthly Token Limit</label>
              <input
                type="number"
                value={newTokenLimit}
                onChange={e => setNewTokenLimit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs focus:outline-none focus:ring-2 focus:ring-copper/30 text-slate-900 dark:text-white"
              />
              <div className="flex gap-2 mt-2">
                {[50_000, 500_000, 2_000_000, -1].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setNewTokenLimit(preset)}
                    className="text-[9px] px-2 py-1 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-500 hover:border-copper hover:text-copper transition-all"
                  >
                    {preset === -1 ? '∞ Unlimited' : `${(preset / 1000).toFixed(0)}K`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveLimits}
                disabled={savingLimits}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-copper text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {savingLimits ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Limits
              </button>
              <button onClick={() => setShowLimitsModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ──────────────────────────────────────────── */}
      {showInviteModal && inviteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy rounded-2xl shadow-2xl border border-app-border dark:border-navy-700 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-sora font-extrabold text-sm text-slate-900 dark:text-white">Invite User</h3>
                <p className="text-[10px] text-slate-400">Into: {inviteTarget.name}</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs focus:outline-none focus:ring-2 focus:ring-copper/30 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Full Name (optional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs focus:outline-none text-slate-900 dark:text-white"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs focus:outline-none text-slate-900 dark:text-white"
              >
                <option value="admin">Admin (Org Owner)</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="estimator">Estimator</option>
                <option value="technician">Technician</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleInviteUser}
                disabled={inviting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-copper text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {inviting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Send Invite
              </button>
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
