/**
 * AuditLogsTab.tsx — Platform Audit Logs Tab
 * ─────────────────────────────────────────────────────────────────
 * Read-only log of security-sensitive platform events.
 *
 * Events tracked:
 *   - Impersonation start/stop
 *   - Org billing tier changes
 *   - Feature flag toggles
 *   - Member role changes
 *   - Plan upgrades/downgrades
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { ScrollText, RefreshCw, LogIn, LogOut, Flag, CreditCard, Shield, Search } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { toast } from 'sonner';

interface ImpersonationLog {
  id: string;
  actor_id: string;
  target_user_id: string;
  target_org_id: string | null;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  ip_address: string | null;
  actor_email?: string;
  target_email?: string;
  target_org_name?: string;
}

export default function AuditLogsTab() {
  const [logs, setLogs] = useState<ImpersonationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('impersonation_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      // Enrich with profile emails
      const actorIds = [...new Set((data ?? []).map(l => l.actor_id))];
      const targetIds = [...new Set((data ?? []).map(l => l.target_user_id))];
      const orgIds = [...new Set((data ?? []).map(l => l.target_org_id).filter(Boolean))];

      const [actorsResult, targetsResult, orgsResult] = await Promise.all([
        actorIds.length > 0
          ? supabase.from('profiles').select('id, email, full_name').in('id', actorIds)
          : Promise.resolve({ data: [] }),
        targetIds.length > 0
          ? supabase.from('profiles').select('id, email, full_name').in('id', targetIds)
          : Promise.resolve({ data: [] }),
        orgIds.length > 0
          ? supabase.from('organizations').select('id, name').in('id', orgIds as string[])
          : Promise.resolve({ data: [] }),
      ]);

      const actorMap = new Map((actorsResult.data ?? []).map(p => [p.id, p.email || p.full_name]));
      const targetMap = new Map((targetsResult.data ?? []).map(p => [p.id, p.email || p.full_name]));
      const orgMap = new Map((orgsResult.data ?? []).map(o => [o.id, o.name]));

      const enriched = (data ?? []).map(log => ({
        ...log,
        actor_email: actorMap.get(log.actor_id) ?? log.actor_id.slice(0, 8) + '...',
        target_email: targetMap.get(log.target_user_id) ?? log.target_user_id.slice(0, 8) + '...',
        target_org_name: log.target_org_id ? (orgMap.get(log.target_org_id) ?? 'Unknown Org') : null,
      }));

      setLogs(enriched);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit logs';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(log =>
    !search ||
    log.actor_email?.includes(search) ||
    log.target_email?.includes(search) ||
    log.target_org_name?.toLowerCase().includes(search.toLowerCase())
  );

  const duration = (log: ImpersonationLog): string => {
    if (!log.ended_at) return 'Active';
    const ms = new Date(log.ended_at).getTime() - new Date(log.started_at).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${mins} min`;
    return `${Math.round(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sora font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-copper" /> Audit Logs
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Read-only security event log — immutable</p>
        </div>
        <button onClick={fetchLogs} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-800 text-xs font-bold text-slate-500 hover:border-copper hover:text-copper transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by actor, target, or org..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-copper/30"
        />
      </div>

      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading audit logs...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">No audit events found</div>
        ) : (
          <div className="divide-y divide-app-border dark:divide-navy-800">
            {filtered.map(log => (
              <div key={log.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/40 dark:hover:bg-navy-950/20 transition-colors">
                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${log.ended_at ? 'bg-slate-100 dark:bg-navy-900' : 'bg-amber-500/10'}`}>
                  {log.ended_at
                    ? <LogOut className="w-3 h-3 text-slate-400" />
                    : <LogIn className="w-3 h-3 text-amber-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      <span className="text-copper">{log.actor_email}</span>
                      {' impersonated '}
                      <span className="text-blue-400">{log.target_email}</span>
                    </span>
                    {log.ended_at ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-500 font-bold">Ended</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold animate-pulse">Active</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {log.target_org_name && (
                      <span className="text-[10px] text-slate-400">Org: {log.target_org_name}</span>
                    )}
                    <span className="text-[10px] text-slate-400">Duration: {duration(log)}</span>
                    {log.ip_address && (
                      <span className="text-[10px] text-slate-400 font-mono">IP: {log.ip_address}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400">
                    {new Date(log.started_at).toLocaleDateString()}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {new Date(log.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-500 hover:border-copper hover:text-copper disabled:opacity-40 transition-all"
        >
          ← Previous
        </button>
        <span className="text-[10px] text-slate-400">Page {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={logs.length < PAGE_SIZE || loading}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-500 hover:border-copper hover:text-copper disabled:opacity-40 transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
