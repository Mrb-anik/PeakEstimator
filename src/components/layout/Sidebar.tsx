import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Briefcase, BookOpen, Settings, LogOut, Zap, ShieldAlert } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: Briefcase },
  { path: '/price-book', label: 'Price Book', icon: BookOpen },
  { path: '/settings', label: 'Settings', icon: Settings },
];


export default function Sidebar() {
  const navigate = useNavigate();
  const profile = useAppStore(s => s.profile);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-white border-r border-slate-100 flex flex-col z-50 shadow-sm">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-none">ZenBid Pro</div>
            <div className="text-xs text-slate-400 mt-0.5">Contractor Estimating</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
                  style={{ width: '18px', height: '18px' }}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile + Logout */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-1">
        {profile && (
          <div className="px-3 py-2 rounded-xl bg-slate-50 mb-2">
            <div className="text-xs font-semibold text-slate-800 truncate">
              {profile.company_name || profile.full_name || 'Your Company'}
            </div>
            <div className="text-xs text-slate-400 truncate">{profile.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-150"
        >
          <LogOut style={{ width: '18px', height: '18px' }} className="flex-shrink-0" />
          Sign Out
        </button>

        {/* Brand badge */}
        <div className="mt-3 mx-1 px-3 py-2 bg-indigo-600 rounded-xl text-center">
          <div className="text-xs font-semibold text-white opacity-90">ZenBid Pro</div>
          <div className="text-xs text-indigo-200 opacity-75">v1.0.0</div>
        </div>
      </div>
    </aside>
  );
}
