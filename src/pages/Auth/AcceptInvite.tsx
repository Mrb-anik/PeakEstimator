/**
 * AcceptInvite.tsx — Invited User Onboarding Page
 * ─────────────────────────────────────────────────────────────────
 * Renders when a new user follows their invite link.
 *
 * Flow:
 *   1. Supabase auth handles token validation (magic link in email)
 *   2. User lands on /dashboard → if profile.onboarding_completed is
 *      false AND they came from invite → redirect here
 *   3. We show a fast 2-step setup: set password + confirm company info
 *   4. On complete → redirect to /dashboard
 *
 * This page is also reachable at /welcome for freshly invited users.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Building2, User, Lock, ArrowRight, Zap } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

function PeakLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#0F172A"/>
      <polygon points="32,8 6,56 58,56" fill="none" stroke="#C58B5C" strokeWidth="2.5" strokeLinejoin="round"/>
      <polyline points="18,50 26,28 32,40 38,28 46,50" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="36" y1="16" x2="52" y2="30" stroke="#C58B5C" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="52" cy="30" r="3" fill="#C58B5C"/>
    </svg>
  );
}

export default function AcceptInvite() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Pre-fill from profile metadata
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setCompanyName(profile.company_name || '');
      setCompanyPhone(profile.company_phone || '');
    }
  }, [profile]);

  // If already onboarded, skip to dashboard
  useEffect(() => {
    if (profile?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, navigate]);

  const handleSetPassword = async () => {
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStep(2);
      toast.success('Password set — one more step!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set password';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!fullName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No session');

      // Update profile
      const { error: profileErr } = await supabase.from('profiles').update({
        full_name: fullName.trim(),
        company_name: companyName.trim() || profile?.company_name || '',
        company_phone: companyPhone.trim(),
        onboarding_completed: true,
        onboarding_dismissed: true,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (profileErr) throw profileErr;

      // Sync org name if we have a company name and org_id
      if (profile?.organization_id && companyName.trim()) {
        await supabase.from('organizations').update({
          name: companyName.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', profile.organization_id);
      }

      // Mark done in localStorage too
      localStorage.setItem(`peak_onboarding_completed_${user.id}`, 'true');

      await refreshProfile();
      setDone(true);

      setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Setup failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-white font-sora font-extrabold text-2xl">You're all set!</h2>
          <p className="text-slate-400">Taking you to your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C58B5C 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-md animate-fade-in z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <PeakLogo size={52} />
          </div>
          <h1 className="text-2xl font-sora font-extrabold text-white mb-2">
            {step === 1 ? 'Set your password' : 'Finish setting up'}
          </h1>
          <p className="text-slate-400 text-sm">
            {step === 1
              ? "You've been invited to PeakEstimator. Create a password to secure your account."
              : 'Confirm your info and you\'re ready to go.'
            }
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-copper' : s < step ? 'w-4 bg-emerald-500' : 'w-4 bg-slate-700'}`} />
          ))}
        </div>

        <div className="bg-navy border border-navy-700/60 rounded-2xl p-7 shadow-premium">
          {step === 1 ? (
            /* ── Step 1: Set Password ──────────────────────────── */
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  <Lock className="inline w-3 h-3 mr-1" />New Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                    placeholder="Min. 8 characters"
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-navy-900 border border-navy-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-copper/40 placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                  placeholder="Repeat your password"
                  className="w-full px-4 py-3 rounded-xl bg-navy-900 border border-navy-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-copper/40 placeholder-slate-500"
                />
              </div>
              {/* Password strength */}
              {password && (
                <div className="space-y-1">
                  {[
                    { label: 'At least 8 characters', ok: password.length >= 8 },
                    { label: 'Contains a number', ok: /\d/.test(password) },
                    { label: 'Passwords match', ok: confirmPassword.length > 0 && password === confirmPassword },
                  ].map(check => (
                    <div key={check.label} className={`flex items-center gap-2 text-[11px] ${check.ok ? 'text-emerald-400' : 'text-slate-500'}`}>
                      <CheckCircle2 className={`w-3 h-3 ${check.ok ? 'text-emerald-400' : 'text-slate-700'}`} />
                      {check.label}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleSetPassword}
                disabled={saving || !password || !confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-copper hover:opacity-90 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 mt-2"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          ) : (
            /* ── Step 2: Confirm Info ───────────────────────────── */
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  <User className="inline w-3 h-3 mr-1" />Your Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-3 rounded-xl bg-navy-900 border border-navy-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-copper/40 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  <Building2 className="inline w-3 h-3 mr-1" />Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Smith HVAC Services LLC"
                  className="w-full px-4 py-3 rounded-xl bg-navy-900 border border-navy-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-copper/40 placeholder-slate-500"
                />
                {profile?.company_name && profile.company_name !== companyName && (
                  <p className="text-[10px] text-slate-500 mt-1">Invited as: {profile.company_name}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Phone (optional)</label>
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={e => setCompanyPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-3 rounded-xl bg-navy-900 border border-navy-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-copper/40 placeholder-slate-500"
                />
              </div>
              <div className="bg-copper/5 border border-copper/20 rounded-xl p-3 flex items-start gap-2">
                <Zap className="w-4 h-4 text-copper mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your workspace is ready. You'll have access to the full estimating and proposal suite immediately.
                </p>
              </div>
              <button
                onClick={handleComplete}
                disabled={saving || !fullName.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-copper hover:opacity-90 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 mt-2"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Launch My Workspace <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-[11px] mt-6">
          Already set up? <a href="/login" className="text-copper hover:opacity-80">Sign in</a>
        </p>
      </div>
    </div>
  );
}
