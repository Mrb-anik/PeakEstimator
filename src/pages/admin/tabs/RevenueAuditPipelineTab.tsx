import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Building2, CalendarClock, CheckCircle, DollarSign,
  Mail, MessageSquare, Phone, RefreshCw, Search, Target, UserPlus,
  Workflow, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../api/supabase';
import { formatCurrency } from '../../../lib/currency';

type RevenueAudit = {
  id: string;
  company_name: string;
  owner_name: string;
  email: string;
  phone?: string | null;
  trade_type?: string | null;
  annual_revenue_range?: string | null;
  estimates_per_month?: number | null;
  average_project_size?: number | null;
  average_close_rate?: number | null;
  projected_revenue_recovery?: number | null;
  created_at: string;
};

type AuditScore = {
  revenue_audit_id: string;
  efficiency_score: number;
  follow_up_score: number;
  scalability_score: number;
  operational_maturity_score: number;
  lead_score: number;
  urgency_score: number;
  growth_potential_score: number;
  estimated_deal_value: number;
};

type PipelineRow = {
  id: string;
  revenue_audit_id: string;
  stage: string;
  qualification_status: string;
  projected_revenue_value: number;
  contact_attempts: number;
  assigned_rep_id?: string | null;
};

const STAGES = ['New Audit', 'Qualified', 'Contacted', 'Demo Scheduled', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];

export default function RevenueAuditPipelineTab() {
  const [audits, setAudits] = useState<RevenueAudit[]>([]);
  const [scores, setScores] = useState<AuditScore[]>([]);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const [auditResult, scoreResult, pipelineResult] = await Promise.all([
        supabase.from('revenue_audits').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_scores').select('*'),
        supabase.from('lead_pipeline').select('*'),
      ]);
      if (auditResult.error) throw auditResult.error;
      if (scoreResult.error) throw scoreResult.error;
      if (pipelineResult.error) throw pipelineResult.error;
      setAudits((auditResult.data ?? []) as RevenueAudit[]);
      setScores((scoreResult.data ?? []) as AuditScore[]);
      setPipeline((pipelineResult.data ?? []) as PipelineRow[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Revenue Audit Pipeline';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);

  const scoreMap = useMemo(() => new Map(scores.map(score => [score.revenue_audit_id, score])), [scores]);
  const pipelineMap = useMemo(() => new Map(pipeline.map(row => [row.revenue_audit_id, row])), [pipeline]);

  const enriched = useMemo(() => audits.map(audit => ({
    audit,
    score: scoreMap.get(audit.id),
    pipe: pipelineMap.get(audit.id),
  })).filter(row =>
    !query ||
    row.audit.company_name.toLowerCase().includes(query.toLowerCase()) ||
    row.audit.owner_name.toLowerCase().includes(query.toLowerCase()) ||
    row.audit.email.toLowerCase().includes(query.toLowerCase()) ||
    row.audit.trade_type?.toLowerCase().includes(query.toLowerCase())
  ), [audits, pipelineMap, query, scoreMap]);

  const selected = enriched.find(row => row.audit.id === selectedId) ?? enriched[0] ?? null;

  const stageCounts = STAGES.map(stage => ({
    stage,
    count: pipeline.filter(row => row.stage === stage).length,
  }));

  const totalRecovery = audits.reduce((sum, audit) => sum + Number(audit.projected_revenue_recovery ?? 0), 0);
  const avgLeadScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score.lead_score, 0) / scores.length) : 0;

  const updateStage = async (pipelineRow: PipelineRow | undefined, stage: string) => {
    if (!pipelineRow) return;
    const { error } = await supabase
      .from('lead_pipeline')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', pipelineRow.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Moved to ${stage}`);
    fetchAudits();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="rounded-2xl border border-sky-500/20 bg-navy-950 p-5 text-white shadow-premium">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
              <Target className="h-3.5 w-3.5" />
              Revenue Audit Pipeline
            </div>
            <h2 className="font-sora text-2xl font-black">Turn operational pain into qualified pipeline.</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
              Every audit submission becomes contractor intelligence: lead score, urgency, recovery potential, maturity gaps, software stack, and sales stage.
            </p>
          </div>
          <button onClick={fetchAudits} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:border-sky-400">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Audit Submissions', value: audits.length.toLocaleString(), Icon: Building2, color: 'text-sky-300' },
            { label: 'Projected Recovery', value: formatCurrency(totalRecovery), Icon: DollarSign, color: 'text-emerald-300' },
            { label: 'Avg Lead Score', value: avgLeadScore.toString(), Icon: BarChart3, color: 'text-violet-300' },
            { label: 'Demo-Ready Leads', value: scores.filter(score => score.lead_score >= 75).length.toString(), Icon: CheckCircle, color: 'text-amber-300' },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="font-sora text-xl font-black">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card dark:border-navy-800 dark:bg-navy">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pipeline Stages</h3>
            <Workflow className="h-4 w-4 text-sky-400" />
          </div>
          <div className="space-y-2">
            {stageCounts.map(({ stage, count }) => (
              <div key={stage} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-navy-800 dark:bg-navy-950/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{stage}</span>
                  <span className="text-xs font-black text-sky-400">{count}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${audits.length ? (count / audits.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-app-border bg-white shadow-card dark:border-navy-800 dark:bg-navy">
          <div className="border-b border-app-border p-4 dark:border-navy-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Audit Submissions</h3>
                <p className="text-[11px] text-slate-400">Lead scoring, projected recovery, and sales stage control.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search audits"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-500/30 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="grid min-h-[560px] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-app-border dark:border-navy-800 lg:border-b-0 lg:border-r">
              <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
                {enriched.map(row => (
                  <button
                    key={row.audit.id}
                    onClick={() => setSelectedId(row.audit.id)}
                    className={`block w-full border-b border-slate-100 p-4 text-left transition dark:border-navy-800 ${
                      selected?.audit.id === row.audit.id ? 'bg-sky-500/10' : 'hover:bg-slate-50 dark:hover:bg-navy-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900 dark:text-white">{row.audit.company_name}</div>
                        <div className="mt-1 truncate text-[11px] text-slate-400">{row.audit.owner_name} · {row.audit.trade_type ?? 'contractor'}</div>
                      </div>
                      <span className="rounded-lg bg-sky-500/10 px-2 py-1 text-[10px] font-black text-sky-400">
                        {row.score?.lead_score ?? 0}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
                      <span className="font-bold text-emerald-500">{formatCurrency(row.audit.projected_revenue_recovery ?? 0)} recovery</span>
                      <span className="text-slate-400">{row.pipe?.stage ?? 'New Audit'}</span>
                    </div>
                  </button>
                ))}
                {enriched.length === 0 && (
                  <div className="p-10 text-center text-xs text-slate-400">No Revenue Audits found.</div>
                )}
              </div>
            </div>

            <div className="p-4">
              {selected ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-sora text-xl font-black text-slate-900 dark:text-white">{selected.audit.company_name}</h3>
                        <p className="text-xs text-slate-400">{selected.audit.owner_name} · {selected.audit.annual_revenue_range} · {selected.audit.trade_type}</p>
                      </div>
                      <span className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-500">
                        {formatCurrency(selected.audit.projected_revenue_recovery ?? 0)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {[Mail, Phone, CalendarClock, MessageSquare, UserPlus].map((Icon, index) => (
                        <button key={index} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-sky-400 hover:text-sky-400 dark:border-navy-700">
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Lead Score', selected.score?.lead_score ?? 0],
                      ['Urgency', selected.score?.urgency_score ?? 0],
                      ['Growth', selected.score?.growth_potential_score ?? 0],
                      ['Maturity', selected.score?.operational_maturity_score ?? 0],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-navy-800 dark:bg-navy-950/60">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
                        <div className="mt-1 font-sora text-2xl font-black text-slate-900 dark:text-white">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-navy-800 dark:bg-navy-950/60">
                    <h4 className="mb-3 text-xs font-black text-slate-900 dark:text-white">Contractor Intelligence</h4>
                    <div className="grid gap-2 text-[11px] text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                      <Info label="Estimates/month" value={selected.audit.estimates_per_month ?? 0} />
                      <Info label="Average job" value={formatCurrency(selected.audit.average_project_size ?? 0)} />
                      <Info label="Close rate" value={`${selected.audit.average_close_rate ?? 0}%`} />
                      <Info label="Deal value" value={formatCurrency(selected.score?.estimated_deal_value ?? 0)} />
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-black text-slate-900 dark:text-white">Move Pipeline Stage</h4>
                    <div className="flex flex-wrap gap-2">
                      {STAGES.map(stage => (
                        <button
                          key={stage}
                          onClick={() => updateStage(selected.pipe, stage)}
                          className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black transition ${
                            selected.pipe?.stage === stage
                              ? 'bg-sky-500 text-white'
                              : 'border border-slate-200 text-slate-500 hover:border-sky-400 hover:text-sky-400 dark:border-navy-700'
                          }`}
                        >
                          {stage}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-black text-sky-400">
                      <Zap className="h-4 w-4" />
                      Revenue Opportunity Engine
                    </div>
                    <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                      Suggested proposal: Revenue Infrastructure implementation with CRM cleanup, follow-up automation, SmartScope setup, estimator templates, and margin controls.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">Select an audit to inspect.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-navy">
      <span>{label}</span>
      <span className="font-black text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}
