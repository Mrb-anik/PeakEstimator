import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';
import { ShieldAlert, UserCheck, Trash2, Mail, Plus, Users, Search, Building2, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface WaitlistItem {
  id: string;
  email: string;
  name: string | null;
  trade: string | null;
  company: string | null;
  created_at: string;
}

interface ProfileItem {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  is_admin: boolean;
  created_at: string;
}

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState<'members' | 'waitlist'>('members');
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [members, setMembers] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteCompany, setInviteCompany] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch Waitlist
    const { data: waitData, error: waitErr } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (!waitErr && waitData) setWaitlist(waitData);

    // Fetch Members
    const { data: memData, error: memErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (!memErr && memData) setMembers(memData);
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("No active session");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'invite',
          email: inviteEmail.trim(),
          fullName: inviteName.trim(),
          companyName: inviteCompany.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");

      toast.success(`Invitation sent to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteCompany('');
      fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const handleApproveWaitlist = async (item: WaitlistItem) => {
    setInviteEmail(item.email);
    setInviteName(item.name || '');
    setInviteCompany(item.company || '');
    setShowInviteModal(true);
  };

  const handleRemoveWaitlist = async (id: string) => {
    if (!confirm("Remove this entry from the waitlist?")) return;
    const { error } = await supabase.from('waitlist').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Waitlist entry removed");
      setWaitlist(prev => prev.filter(w => w.id !== id));
    }
  };

  const handleRevokeAccess = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently revoke access for ${email}? This deletes their account.`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("No active session");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'delete',
          userId: id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");

      toast.success(`Access revoked for ${email}`);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const filteredMembers = members.filter(m =>
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    (m.full_name && m.full_name.toLowerCase().includes(search.toLowerCase())) ||
    (m.company_name && m.company_name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredWaitlist = waitlist.filter(w =>
    w.email.toLowerCase().includes(search.toLowerCase()) ||
    (w.name && w.name.toLowerCase().includes(search.toLowerCase())) ||
    (w.company && w.company.toLowerCase().includes(search.toLowerCase())) ||
    (w.trade && w.trade.toLowerCase().includes(search.toLowerCase()))
  );

  const modalInputClass = 'w-full px-4 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all text-sm';

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto font-inter select-none animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-sora font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            Admin Management
            <span className="text-[10px] font-bold bg-rose-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">
              Superadmin
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Control enterprise seats, approve waitlist requests, and manage access.</p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-copper hover:bg-copper-hover active:bg-copper-600 text-white font-bold text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Send Direct Invitation
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-navy p-2 rounded-2xl border border-app-border dark:border-navy-800 shadow-sm mb-6">
        <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'members' 
                ? 'bg-slate-100 dark:bg-navy-950 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-950/40'
            }`}
          >
            <Users className="w-4 h-4" />
            Active Members ({members.length})
          </button>
          
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'waitlist' 
                ? 'bg-slate-100 dark:bg-navy-950 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-950/40'
            }`}
          >
            <Mail className="w-4 h-4" />
            Waitlist Requests ({waitlist.length})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email, name, company..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-850 rounded-xl text-sm focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Content Container */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-copper border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'members' ? (
        <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 border-b border-app-border dark:border-navy-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Member / Company</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Security Access Role</th>
                  <th className="py-4 px-6">Seat Registration Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border dark:divide-navy-800 text-sm text-slate-900 dark:text-white">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500 dark:text-slate-400 font-semibold">
                      No members found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white">{m.full_name || '—'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                          <Building2 className="w-3.5 h-3.5" /> {m.company_name || 'No Company Listed'}
                        </div>
                      </td>
                      
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">{m.email}</td>
                      
                      <td className="py-4 px-6">
                        {m.is_admin ? (
                          <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-rose-100 dark:border-rose-900/30 uppercase tracking-wide">
                            Superadmin
                          </span>
                        ) : (
                          <span className="bg-slate-100 dark:bg-navy-950 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-navy-850 uppercase tracking-wide">
                            Contractor Seat
                          </span>
                        )}
                      </td>
                      
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      
                      <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                        {!m.is_admin && (
                          <button
                            onClick={() => handleRevokeAccess(m.id, m.email)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-status-danger dark:hover:text-status-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                            title="Revoke Access & Delete Account"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 border-b border-app-border dark:border-navy-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Applicant / Company</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Trade Discipline</th>
                  <th className="py-4 px-6">Submission Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border dark:divide-navy-800 text-sm text-slate-900 dark:text-white">
                {filteredWaitlist.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500 dark:text-slate-400 font-semibold">
                      No waitlist entries found.
                    </td>
                  </tr>
                ) : (
                  filteredWaitlist.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-950/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white">{w.name || '—'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                          <Building2 className="w-3.5 h-3.5" /> {w.company || 'No Company Listed'}
                        </div>
                      </td>
                      
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">{w.email}</td>
                      
                      <td className="py-4 px-6">
                        <span className="bg-copper/10 dark:bg-copper/20 text-copper dark:text-copper-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-copper/20 dark:border-copper-900/30 uppercase tracking-wide capitalize">
                          {w.trade || 'General'}
                        </span>
                      </td>
                      
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        {new Date(w.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      
                      <td className="py-4 px-6 text-right space-x-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleApproveWaitlist(w)}
                          className="bg-emerald-500/10 border border-emerald-500/20 text-status-success dark:text-emerald-400 font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                        >
                          Approve & Invite
                        </button>
                        <button
                          onClick={() => handleRemoveWaitlist(w.id)}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-status-danger dark:hover:text-status-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                          title="Remove from waitlist"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy border border-slate-200 dark:border-navy-800 rounded-2xl p-8 max-w-md w-full shadow-premium animate-scale-in text-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-slate-100 dark:bg-navy-950 rounded-2xl flex items-center justify-center text-slate-900 dark:text-white flex-shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-sora font-extrabold text-slate-900 dark:text-white">Send Enterprise Invitation</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">Sends a secure magic setup link directly to their inbox.</p>
              </div>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Recipient Email <span className="text-status-danger">*</span></label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="contractor@company.com"
                  className={modalInputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="John Smith"
                  className={modalInputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={inviteCompany}
                  onChange={e => setInviteCompany(e.target.value)}
                  placeholder="Smith Roofing LLC"
                  className={modalInputClass}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border dark:border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="bg-copper hover:bg-copper-hover active:bg-copper-600 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {inviting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Magic Link'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
