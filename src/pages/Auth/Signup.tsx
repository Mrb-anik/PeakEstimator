import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

function PeakLogo({ size = 44 }: { size?: number }) {
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

export default function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-navy-950 font-inter select-none">
      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C58B5C 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-md text-center animate-fade-in z-10">
        <Link to="/" className="inline-flex items-center justify-center mb-6 hover:opacity-80 transition-opacity">
          <PeakLogo size={54} />
        </Link>

        <h1 className="text-3xl font-sora font-extrabold text-white mb-3 tracking-tight">Invite-Only Platform</h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
          <span className="text-copper font-semibold">PeakEstimator</span> is an elite, closed-access platform for top-tier professional contractors. Public registration is strictly disabled.
        </p>

        <div className="bg-navy border border-navy-700/60 rounded-2xl p-8 shadow-premium text-left mb-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-copper/10 border border-copper/30 rounded-xl flex-shrink-0 text-copper">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-sora font-bold text-base mb-1">How do I get access?</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Access is granted exclusively through our official waitlist or direct administrative invitation. When your enterprise seat is approved, you will receive a secure magic setup link directly in your inbox.
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="block w-full py-3.5 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white text-center rounded-xl font-bold text-sm transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            Join the Official Waitlist →
          </Link>
        </div>

        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Already an approved member?{' '}
            <Link to="/login" className="text-copper hover:text-copper-hover font-bold transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
