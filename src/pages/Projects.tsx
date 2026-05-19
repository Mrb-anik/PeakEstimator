import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ArrowRight, Filter } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import AddProjectModal from '../components/projects/AddProjectModal';
import { formatCurrency } from '../lib/calculations';
import { TRADE_EMOJIS } from '../types';
import type { StatusType } from '../types';

const STATUS_TABS: { value: StatusType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Lead' },
  { value: 'bidding', label: 'Bidding' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export default function Projects() {
  const navigate = useNavigate();
  const { projects, loading, createProject, deleteProject } = useProjects();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = projects.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project? This action cannot be undone.')) return;
    setDeletingId(id);
    await deleteProject(id);
    setDeletingId(null);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in font-inter select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-sora font-extrabold text-text-primary dark:text-text-darkPrimary">Projects</h1>
          <p className="text-text-secondary dark:text-text-darkSecondary text-sm mt-0.5">{projects.length} total bids</p>
        </div>
        <button
          id="projects-new-bid"
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          New Bid
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            id="projects-search"
            type="text"
            placeholder="Search by name or client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-text-primary dark:text-text-darkPrimary placeholder-slate-400 dark:placeholder-slate-500 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all shadow-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-navy border border-slate-200 dark:border-navy-800 rounded-xl p-1 shadow-sm w-fit max-w-full overflow-x-auto scrollbar-thin">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                statusFilter === tab.value
                  ? 'bg-copper text-white shadow-sm'
                  : 'text-text-secondary dark:text-text-darkSecondary hover:text-text-primary dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card Container */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-copper border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="w-12 h-12 bg-app-bg dark:bg-navy-950 border border-app-border dark:border-navy-800 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Filter className="w-6 h-6 text-text-secondary dark:text-text-darkSecondary" />
            </div>
            <p className="text-text-primary dark:text-text-darkPrimary text-sm font-semibold">
              {search || statusFilter !== 'all' ? 'No projects match your filters' : 'No projects yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-5 px-5 py-2.5 bg-copper hover:bg-copper-hover text-white rounded-xl text-sm font-bold transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5"
              >
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[900px] divide-y divide-app-border dark:divide-navy-800">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 dark:bg-navy-950 border-b border-app-border dark:border-navy-800">
                <div className="col-span-3 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Project Name</div>
                <div className="col-span-2 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Client Name</div>
                <div className="col-span-2 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Trade Discipline</div>
                <div className="col-span-2 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Estimated Value</div>
                <div className="col-span-2 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Bidding Status</div>
                <div className="col-span-1 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider text-right">Actions</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-app-border dark:divide-navy-800">
                {filtered.map(project => (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-950/60 cursor-pointer transition-colors items-center"
                  >
                    <div className="col-span-3 min-w-0 pr-2">
                      <div className="text-sm font-bold text-text-primary dark:text-text-darkPrimary truncate hover:text-copper transition-colors">{project.name}</div>
                      <div className="text-xs text-text-secondary dark:text-text-darkSecondary mt-0.5 font-medium">
                        {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    
                    <div className="col-span-2 min-w-0 pr-2">
                      <div className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary truncate">{project.client_name || '—'}</div>
                      <div className="text-xs text-text-secondary dark:text-text-darkSecondary truncate mt-0.5 font-medium">{project.client_email || ''}</div>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-primary dark:text-text-darkPrimary px-2.5 py-1 bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-lg capitalize">
                        <span>{TRADE_EMOJIS[project.trade]}</span>
                        <span>{project.trade}</span>
                      </span>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="text-sm font-bold text-text-primary dark:text-text-darkPrimary">{formatCurrency(project.total_value || 0)}</span>
                    </div>
                    
                    <div className="col-span-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusClass(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    
                    <div className="col-span-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => handleDelete(e, project.id)}
                        disabled={deletingId === project.id}
                        className="p-1.5 text-text-secondary dark:text-text-darkSecondary hover:text-status-danger dark:hover:text-status-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all disabled:opacity-50"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="p-1.5 text-text-secondary dark:text-text-darkSecondary hover:text-copper dark:hover:text-copper transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddProjectModal
          onClose={() => setShowModal(false)}
          onCreate={createProject}
        />
      )}
    </div>
  );
}

function getStatusClass(status: string) {
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
