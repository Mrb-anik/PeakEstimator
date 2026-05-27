/**
 * AdminPortalShell.tsx — Phase 2 Admin Portal Orchestrator
 * ─────────────────────────────────────────────────────────────────
 * Lazy-loading admin portal with extracted tabs.
 *
 * PHASE 2 STATUS:
 *   ✅ SubAccountsTab — fully extracted (replaces AdminPortal sub_accounts)
 *   ✅ UsageMetricsTab — fully extracted (replaces AdminPortal revenue/churn)
 *   ✅ FeatureFlagsTab — fully extracted (replaces AdminPortal feature_flags)
 *   ✅ AuditLogsTab — fully extracted (replaces AdminPortal audit_logs)
 *   🔄 All other tabs — still in AdminPortal.tsx (Phase 3 extraction)
 *
 * IMPERSONATION BRIDGE:
 *   SubAccountsTab calls onImpersonate(profile) →
 *   OrganizationProvider.startImpersonation(profile) →
 *   ImpersonationBanner shows automatically
 * ─────────────────────────────────────────────────────────────────
 */

import { Suspense, lazy, useState, useCallback, useEffect } from 'react';
import {
  Building2, BarChart2, Flag, ScrollText, Users, Settings,
  Bot, Mail, ListChecks, Wrench, LayoutTemplate, DollarSign,
  UserX, CreditCard, Boxes, ChevronRight,
} from 'lucide-react';
import { ErrorBoundary } from '../../components/layout/ErrorBoundary';
import { useOrganization } from '../../providers/OrganizationProvider';
import { supabase } from '../../api/supabase';
import type { Profile } from '../../types';

// ── Extracted tabs (Phase 2) ───────────────────────────────────────
import SubAccountsTab from './tabs/SubAccountsTab';
import UsageMetricsTab from './tabs/UsageMetricsTab';
import FeatureFlagsTab from './tabs/FeatureFlagsTab';
import AuditLogsTab from './tabs/AuditLogsTab';

// ── Legacy monolith for remaining tabs (Phase 3 extraction) ────────
const AdminPortal = lazy(() => import('../AdminPortal'));

// ─── Tab config ────────────────────────────────────────────────────

type Phase2Tab = 'sub_accounts' | 'revenue' | 'feature_flags' | 'audit_logs';
type LegacyTab = 'members' | 'crm' | 'integrations' | 'support' | 'email_logs' |
                 'waitlist' | 'onboarding' | 'ai_settings' | 'automation' |
                 'templates' | 'broadcast' | 'churn' | 'stripe' | 'billing' | 'pricebook_admin';
type AdminTab = Phase2Tab | LegacyTab;

interface TabConfig {
  id: AdminTab;
  label: string;
  icon: React.ElementType;
  phase2: boolean;
  badge?: string;
}

const TABS: TabConfig[] = [
  // Phase 2 — extracted
  { id: 'sub_accounts',    label: 'Sub-Accounts', icon: Building2,    phase2: true },
  { id: 'revenue',         label: 'Usage & Revenue', icon: BarChart2, phase2: true },
  { id: 'feature_flags',   label: 'Feature Flags',  icon: Flag,       phase2: true },
  { id: 'audit_logs',      label: 'Audit Logs',     icon: ScrollText, phase2: true },
  // Legacy — in AdminPortal.tsx until Phase 3
  { id: 'members',         label: 'Members',         icon: Users,         phase2: false },
  { id: 'crm',             label: 'CRM',             icon: UserX,         phase2: false },
  { id: 'billing',         label: 'Billing',         icon: CreditCard,    phase2: false },
  { id: 'ai_settings',     label: 'AI Settings',     icon: Bot,           phase2: false },
  { id: 'automation',      label: 'Automation',      icon: Settings,      phase2: false },
  { id: 'templates',       label: 'Templates',       icon: LayoutTemplate,phase2: false },
  { id: 'support',         label: 'Support',         icon: Wrench,        phase2: false },
  { id: 'email_logs',      label: 'Email Logs',      icon: Mail,          phase2: false },
  { id: 'stripe',          label: 'Stripe',          icon: DollarSign,    phase2: false },
  { id: 'pricebook_admin', label: 'Price Book',      icon: Boxes,         phase2: false },
  { id: 'waitlist',        label: 'Waitlist',        icon: ListChecks,    phase2: false },
  { id: 'onboarding',      label: 'Onboarding',      icon: ChevronRight,  phase2: false },
  { id: 'broadcast',       label: 'Broadcast',       icon: Mail,          phase2: false },
];

function TabSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-copper border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminPortalShell() {
  const [activeTab, setActiveTab] = useState<AdminTab>('sub_accounts');
  const [members, setMembers] = useState<Profile[]>([]);
  const { startImpersonation } = useOrganization();

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setMembers(data as Profile[]);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const isPhase2 = (id: AdminTab): id is Phase2Tab =>
    ['sub_accounts', 'revenue', 'feature_flags', 'audit_logs'].includes(id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      {/* Top nav */}
      <div className="sticky top-0 z-20 bg-white dark:bg-navy border-b border-app-border dark:border-navy-800">
        <div className="px-4 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0.5 py-1 min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-copper/10 text-copper'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.phase2 && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-black">P2</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <ErrorBoundary label={`Admin: ${activeTab}`} level="route">
          {/* ── Phase 2 extracted tabs ─────────────────────────── */}
          {activeTab === 'sub_accounts' && (
            <SubAccountsTab
              members={members}
              onImpersonate={startImpersonation}
              onRefreshMembers={fetchMembers}
            />
          )}

          {activeTab === 'revenue' && <UsageMetricsTab />}

          {activeTab === 'feature_flags' && <FeatureFlagsTab />}

          {activeTab === 'audit_logs' && <AuditLogsTab />}

          {/* ── Legacy monolith for remaining tabs ─────────────── */}
          {!isPhase2(activeTab) && (
            <Suspense fallback={<TabSpinner />}>
              <AdminPortal initialTab={activeTab as LegacyTab} />
            </Suspense>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
