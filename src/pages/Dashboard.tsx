import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, Briefcase, CheckCircle, Target, Plus, ArrowRight } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { formatCurrency } from '../lib/calculations';
import type { StatusType } from '../types';

const STATUS_COLORS: Record<StatusType, string> = {
  lead: '#94A3B8',
  bidding: '#475569',
  sent: '#C58B5C',
  approved: '#10B981',
  won: '#059669',
  lost: '#EF4444',
};

const TRADE_COLORS = ['#C58B5C', '#1E293B', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#64748B'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, loading } = useProjects();

  const kpis = useMemo(() => {
    const pipeline = projects.reduce((s, p) => s + (p.total_value || 0), 0);
    const won = projects.filter(p => p.status === 'won').length;
    const active = projects.filter(p => ['bidding', 'sent', 'approved'].includes(p.status)).length;
    const winRate = projects.length > 0 ? Math.round((won / projects.length) * 100) : 0;
    return { pipeline, won, active, winRate };
  }, [projects]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ 
      status, 
      count, 
      fill: STATUS_COLORS[status as StatusType] || '#94A3B8'
    }));
  }, [projects]);

  const tradeData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.trade] = (counts[p.trade] || 0) + 1; });
    return Object.entries(counts).map(([trade, value]) => ({ trade, value }));
  }, [projects]);

  const recentProjects = projects.slice(0, 5);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-copper border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in font-inter select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-sora font-extrabold text-text-primary dark:text-text-darkPrimary">Dashboard</h1>
          <p className="text-text-secondary dark:text-text-darkSecondary text-sm mt-0.5">Your bidding pipeline at a glance</p>
        </div>
        <button
          id="dashboard-new-bid"
          onClick={() => navigate('/projects')}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          New Bid
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KpiCard
          label="Total Pipeline"
          value={formatCurrency(kpis.pipeline)}
          icon={TrendingUp}
          color="navy"
          sub={`${projects.length} total projects`}
        />
        <KpiCard
          label="Projects Won"
          value={kpis.won.toString()}
          icon={CheckCircle}
          color="emerald"
          sub="Closed deals"
        />
        <KpiCard
          label="Active Bids"
          value={kpis.active.toString()}
          icon={Briefcase}
          color="amber"
          sub="In progress"
        />
        <KpiCard
          label="Win Rate"
          value={`${kpis.winRate}%`}
          icon={Target}
          color="violet"
          sub="Of all submitted"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-8">
        {/* Bar chart */}
        <div className="lg:col-span-3 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl">
          <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary mb-1">Projects by Status</h2>
          <p className="text-xs text-text-secondary dark:text-text-darkSecondary mb-6">Distribution across pipeline stages</p>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #E2E8F0)" className="stroke-slate-100 dark:stroke-navy-800" />
                <XAxis 
                  dataKey="status" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={false} 
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={false} 
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(197, 139, 92, 0.04)' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid var(--tooltip-border, #E2E8F0)',
                    background: 'var(--tooltip-bg, #FFFFFF)',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                  itemStyle={{ color: '#111827' }}
                  labelClassName="font-semibold text-slate-800 dark:text-slate-100"
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart */}
        <div className="lg:col-span-2 bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary mb-1">Projects by Trade</h2>
            <p className="text-xs text-text-secondary dark:text-text-darkSecondary mb-4">Your trade mix</p>
          </div>
          {tradeData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-text-secondary dark:text-text-darkSecondary text-sm">
              No data yet
            </div>
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={tradeData} 
                    dataKey="value" 
                    nameKey="trade" 
                    cx="50%" 
                    cy="45%" 
                    outerRadius={75} 
                    innerRadius={45} 
                    paddingAngle={3}
                  >
                    {tradeData.map((_, i) => (
                      <Cell key={i} fill={TRADE_COLORS[i % TRADE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend 
                    iconSize={8} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                    className="text-text-primary dark:text-text-darkPrimary"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid var(--tooltip-border, #E2E8F0)', 
                      background: 'var(--tooltip-bg, #FFFFFF)',
                      fontSize: '12px' 
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-app-border dark:border-navy-800">
          <h2 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary">Recent Projects</h2>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-xs text-copper font-bold hover:text-copper-hover transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="py-16 text-center px-6">
            <div className="w-12 h-12 bg-app-bg dark:bg-navy-950 rounded-xl flex items-center justify-center mx-auto mb-4 border border-app-border dark:border-navy-800">
              <Briefcase className="w-6 h-6 text-text-secondary dark:text-text-darkSecondary" />
            </div>
            <p className="text-text-primary dark:text-text-darkPrimary text-sm font-semibold">No projects yet</p>
            <p className="text-text-secondary dark:text-text-darkSecondary text-xs mt-1">Create your first bid to get started</p>
            <button
              onClick={() => navigate('/projects')}
              className="mt-5 px-5 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-sm font-bold transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5"
            >
              Create First Bid
            </button>
          </div>
        ) : (
          <div className="divide-y divide-app-border dark:divide-navy-800 overflow-x-auto scrollbar-thin">
            <div className="min-w-[600px]">
              {recentProjects.map(project => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-950/60 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary dark:text-text-darkPrimary truncate">{project.name}</span>
                      <span className="text-xs text-text-secondary dark:text-text-darkSecondary px-2 py-0.5 bg-slate-100 dark:bg-navy-950 rounded border border-slate-200 dark:border-navy-800 capitalize font-medium">
                        {project.trade}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary dark:text-text-darkSecondary mt-0.5 truncate">{project.client_name || 'No client'}</div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${getStatusClass(project.status)}`}>
                      {project.status}
                    </span>
                    <span className="text-sm font-bold text-text-primary dark:text-text-darkPrimary min-w-[100px] text-right">
                      {formatCurrency(project.total_value || 0)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-navy-700" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, color, sub
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'navy' | 'copper' | 'emerald' | 'amber' | 'violet';
  sub: string;
}) {
  const colorMap = {
    navy: 'bg-slate-100 dark:bg-navy-950 text-navy dark:text-slate-200 border border-slate-200 dark:border-navy-850',
    copper: 'bg-copper-100/50 dark:bg-copper-950/30 text-copper dark:text-copper-300 border border-copper-200/30 dark:border-copper-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30',
    amber: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30',
    violet: 'bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30',
  };

  return (
    <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl p-6 transition-all hover:border-slate-300 dark:hover:border-navy-700">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] sm:text-xs font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-sora font-extrabold text-text-primary dark:text-text-darkPrimary tracking-tight">{value}</div>
      <div className="text-xs text-text-secondary dark:text-text-darkSecondary mt-1">{sub}</div>
    </div>
  );
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    lead: 'status-lead',
    bidding: 'status-bidding',
    sent: 'status-sent',
    approved: 'status-approved',
    won: 'status-won',
    lost: 'status-lost',
  };
  return map[status] || 'status-lead';
}
