import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart3, Bot, Building2, Command, CreditCard, Database,
  FileText, Flag, Gauge, HardDrive, KeyRound, LockKeyhole, Mail,
  RefreshCw, Search, Server, Shield, Users, Workflow, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../api/supabase';
import { formatCurrency } from '../../../lib/currency';

type OrgRow = {
  id: string;
  name: string;
  billing_tier?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  organization_id?: string | null;
  role?: string | null;
  last_login_at?: string | null;
  is_suspended?: boolean | null;
};

type UsageRow = {
  organization_id: string;
  ai_tokens_used?: number | null;
  ai_tokens_limit?: number | null;
  ai_cost_cents?: number | null;
  projects_count?: number | null;
  proposals_this_month?: number | null;
  storage_mb_used?: number | null;
  api_requests_count?: number | null;
};

type ProjectRow = {
  id: string;
  organization_id?: string | null;
  status?: string | null;
  total_value?: number | null;
  created_at?: string | null;
};

type SessionRow = {
  id: string;
  organization_id: string;
  user_id: string;
  last_seen_at: string;
  revoked_at?: string | null;
  ip_address?: string | null;
};

type DashboardState = {
  organizations: OrgRow[];
  profiles: ProfileRow[];
  usage: UsageRow[];
  projects: ProjectRow[];
  sessions: SessionRow[];
  auditCount: number;
};

const PLAN_MRR: Record<string, number> = {
  free: 0,
  pro: 99,
  enterprise: 299,
};

const MODULES = [
  ['CRM', 'crm', Users],
  ['Estimator', 'estimator', FileText],
  ['Invoicing', 'invoicing', CreditCard],
  ['Scheduling', 'scheduling', Activity],
  ['Team Management', 'team', Shield],
  ['Reporting', 'reporting', BarChart3],
  ['Automation', 'automation', Workflow],
  ['File Storage', 'storage', HardDrive],
  ['AI Assistant', 'ai', Bot],
  ['Analytics', 'analytics', Gauge],
  ['Billing', 'billing', CreditCard],
  ['White Labeling', 'white_label', Flag],
] as const;

const CONTROL_ACTIONS = [
  ['Impersonate subaccounts', 'Instant parent access to any child workspace', LockKeyhole],
  ['Push estimator formulas', 'Roll out margin and calculation changes globally', Zap],
  ['Push material databases', 'Distribute approved price books to child accounts', Database],
  ['Force feature locks', 'Enable, disable, or lock modules by plan or org', Flag],
  ['Monitor active sessions', 'View devices, IPs, and force logout risky sessions', Shield],
  ['Manage SMTP and API keys', 'Centralize email, webhooks, and external integrations', KeyRound],
] as const;

async function softSelect<T>(table: string, columns: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) {
    console.info(`[ParentCommandCenter] ${table} unavailable:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

export default function ParentCommandCenterTab() {
  const [state, setState] = useState<DashboardState>({
    organizations: [],
    profiles: [],
    usage: [],
    projects: [],
    sessions: [],
    auditCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchCommandCenter = useCallback(async () => {
    setLoading(true);
    try {
      const [organizations, profiles, usage, projects, sessions, auditResult] = await Promise.all([
        softSelect<OrgRow>('organizations', 'id,name,billing_tier,status,created_at'),
        softSelect<ProfileRow>('profiles', 'id,email,full_name,organization_id,role,last_login_at,is_suspended'),
        softSelect<UsageRow>('organization_usage', 'organization_id,ai_tokens_used,ai_tokens_limit,ai_cost_cents,projects_count,proposals_this_month,storage_mb_used,api_requests_count'),
        softSelect<ProjectRow>('projects', 'id,organization_id,status,total_value,created_at'),
        softSelect<SessionRow>('active_sessions', 'id,organization_id,user_id,last_seen_at,revoked_at,ip_address'),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      ]);

      setState({
        organizations,
        profiles,
        usage,
        projects,
        sessions: sessions.filter(session => !session.revoked_at),
        auditCount: auditResult.count ?? 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load parent dashboard';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCommandCenter(); }, [fetchCommandCenter]);

  const metrics = useMemo(() => {
    const activeOrgs = state.organizations.filter(org => org.status !== 'suspended' && org.status !== 'archived');
    const mrr = state.organizations.reduce((sum, org) => sum + (PLAN_MRR[org.billing_tier ?? 'free'] ?? 0), 0);
    const totalEstimateValue = state.projects.reduce((sum, project) => sum + Number(project.total_value ?? 0), 0);
    const wonProjects = state.projects.filter(project => project.status === 'won' || project.status === 'approved').length;
    const conversionRate = state.projects.length ? Math.round((wonProjects / state.projects.length) * 100) : 0;
    const totalAiTokens = state.usage.reduce((sum, row) => sum + Number(row.ai_tokens_used ?? 0), 0);
    const apiRequests = state.usage.reduce((sum, row) => sum + Number(row.api_requests_count ?? 0), 0);
    const storageMb = state.usage.reduce((sum, row) => sum + Number(row.storage_mb_used ?? 0), 0);
    const suspendedUsers = state.profiles.filter(profile => profile.is_suspended).length;

    return {
      activeOrgs: activeOrgs.length,
      mrr,
      activeUsers: state.profiles.length - suspendedUsers,
      apiRequests,
      estimateVolume: state.projects.length,
      totalEstimateValue,
      conversionRate,
      churnRisk: state.organizations.filter(org => org.status === 'suspended').length,
      totalAiTokens,
      storageMb,
    };
  }, [state]);

  const filteredOrgs = state.organizations.filter(org =>
    !query ||
    org.name?.toLowerCase().includes(query.toLowerCase()) ||
    org.billing_tier?.toLowerCase().includes(query.toLowerCase()) ||
    org.status?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const orgUserCount = useMemo(() => {
    const counts = new Map<string, number>();
    state.profiles.forEach(profile => {
      if (profile.organization_id) counts.set(profile.organization_id, (counts.get(profile.organization_id) ?? 0) + 1);
    });
    return counts;
  }, [state.profiles]);

  const usageByOrg = useMemo(() => {
    return new Map(state.usage.map(row => [row.organization_id, row]));
  }, [state.usage]);

  const kpis = [
    ['MRR', formatCurrency(metrics.mrr), 'Subscription analytics', CreditCard, 'text-emerald-400'],
    ['Active Organizations', metrics.activeOrgs.toLocaleString(), 'Strict child workspaces', Building2, 'text-copper'],
    ['Active Users', metrics.activeUsers.toLocaleString(), 'All tenant members', Users, 'text-copper'],
    ['API Usage', metrics.apiRequests.toLocaleString(), 'Metered requests', Server, 'text-violet-400'],
    ['Estimate Volume', metrics.estimateVolume.toLocaleString(), formatCurrency(metrics.totalEstimateValue), FileText, 'text-amber-400'],
    ['Conversion', `${metrics.conversionRate}%`, 'Approved or won', BarChart3, 'text-emerald-400'],
    ['Churn Risk', metrics.churnRisk.toLocaleString(), 'Suspended accounts', Activity, 'text-rose-400'],
    ['AI Tokens', `${(metrics.totalAiTokens / 1_000_000).toFixed(1)}M`, 'Monthly consumption', Bot, 'text-copper'],
  ] as const;

  return (
    <div className="space-y-5 animate-fade-in font-inter">
      <div className="relative overflow-hidden rounded-2xl border border-copper/20 bg-navy-950 text-white shadow-premium">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,139,92,0.2),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,1))]" />
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-copper">
                <Command className="h-3.5 w-3.5" />
                Parent Command Center
              </div>
              <h2 className="font-sora text-2xl font-black tracking-tight md:text-3xl">
                Agency-grade SaaS control plane
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-300">
                Global access, child-account isolation, billing control, feature locks, usage metering, audit trails, and rollout operations from one parent dashboard.
              </p>
            </div>
            <button
              onClick={fetchCommandCenter}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:border-copper hover:bg-copper/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh System
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map(([label, value, sub, Icon, color]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="text-xl font-black leading-none text-white">{value}</div>
                <div className="mt-1 text-[10px] text-slate-400">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card dark:border-navy-800 dark:bg-navy">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Organization Management</h3>
              <p className="text-[11px] text-slate-400">Create, suspend, impersonate, plan-change, and force settings per child account.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search child accounts"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-copper/30 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:border-navy-800">
                  <th className="px-3 py-2">Organization</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Users</th>
                  <th className="px-3 py-2">AI Usage</th>
                  <th className="px-3 py-2">Storage</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {filteredOrgs.map(org => {
                  const usage = usageByOrg.get(org.id);
                  const aiLimit = usage?.ai_tokens_limit ?? 0;
                  const aiUsed = usage?.ai_tokens_used ?? 0;
                  const aiPct = aiLimit > 0 ? Math.min(100, Math.round((aiUsed / aiLimit) * 100)) : 0;
                  return (
                    <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-navy-950/40">
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{org.name}</div>
                        <div className="font-mono text-[9px] text-slate-400">{org.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-lg bg-copper/10 px-2 py-1 text-[10px] font-black uppercase text-copper">
                          {org.billing_tier ?? 'free'}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700 dark:text-slate-200">{orgUserCount.get(org.id) ?? 0}</td>
                      <td className="px-3 py-3">
                        <div className="mb-1 flex justify-between text-[9px] text-slate-400">
                          <span>{(aiUsed / 1000).toFixed(0)}K</span>
                          <span>{aiLimit === -1 ? 'Unlimited' : `${aiPct}%`}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-950">
                          <div className="h-full rounded-full bg-copper" style={{ width: `${aiLimit === -1 ? 100 : aiPct}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-300">{Number(usage?.storage_mb_used ?? 0).toLocaleString()} MB</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
                          org.status === 'suspended' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {org.status ?? 'active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-400">No child accounts found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card dark:border-navy-800 dark:bg-navy">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Security & Audit Center</h3>
          <p className="mb-4 text-[11px] text-slate-400">Live sessions, logins, role changes, exports, deleted records, and impersonation events.</p>

          <div className="space-y-3">
            {[
              { label: 'Active sessions', value: state.sessions.length.toLocaleString(), Icon: Shield, color: 'text-emerald-400' },
              { label: 'Global audit events', value: state.auditCount.toLocaleString(), Icon: FileText, color: 'text-copper' },
              { label: 'Storage usage', value: `${metrics.storageMb.toLocaleString()} MB`, Icon: HardDrive, color: 'text-amber-400' },
              { label: 'System health', value: 'Operational', Icon: Server, color: 'text-emerald-400' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-navy-800 dark:bg-navy-950/60">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {state.sessions.slice(0, 4).map(session => (
              <div key={session.id} className="rounded-xl border border-copper/10 bg-copper/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-copper">{session.user_id.slice(0, 8)}...</span>
                  <span className="text-[9px] text-slate-400">{new Date(session.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">{session.ip_address ?? 'Tracked device'}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card dark:border-navy-800 dark:bg-navy">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Feature & Module Control</h3>
          <p className="mb-4 text-[11px] text-slate-400">Parent-enforced restrictions override child permissions and plan-level settings.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MODULES.map(([label, key, Icon]) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-navy-800 dark:bg-navy-950/50">
                <div className="mb-2 flex items-center justify-between">
                  <Icon className="h-4 w-4 text-copper" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">{label}</div>
                <div className="mt-1 font-mono text-[9px] text-slate-400">{key}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card dark:border-navy-800 dark:bg-navy">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Global Rollout Actions</h3>
          <p className="mb-4 text-[11px] text-slate-400">Operational shortcuts for template, pricing, formula, labor, and material pushes.</p>
          <div className="space-y-2">
            {CONTROL_ACTIONS.map(([label, description, Icon]) => (
              <button
                key={label}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-copper/40 hover:bg-copper/5 dark:border-navy-800 dark:bg-navy-950/50"
              >
                <span className="rounded-lg bg-copper/10 p-2 text-copper">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold text-slate-900 dark:text-white">{label}</span>
                  <span className="block text-[10px] text-slate-400">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-copper/20 bg-copper/5 p-4 dark:bg-copper/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">API-first enterprise posture</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              JWT tenant claims, RLS policies, metered quotas, audit events, active sessions, parent locks, and custom roles are wired for thousands of organizations and millions of estimates.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['JWT', 'Auth'],
              ['RLS', 'Isolation'],
              ['MFA', 'Ready'],
            ].map(([top, bottom]) => (
              <div key={top} className="rounded-xl border border-copper/20 bg-white px-4 py-2 dark:bg-navy">
                <div className="text-sm font-black text-copper">{top}</div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{bottom}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
