import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, CheckCircle, ArrowRight, Clock, TrendingUp, Shield, Phone, FileText, ThumbsUp, Lock } from 'lucide-react';
import { supabase } from '../api/supabase';
import { toast } from 'sonner';

const TRADES = ['⚡ Electrical', '🏠 Roofing', '❄️ HVAC', '🎨 Painting', '🔧 Plumbing', '🚿 Drain & Sewer', '🏗️ General'];

const FEATURES = [
  {
    icon: <FileText className="w-5 h-5" />,
    title: 'Pre-Loaded Trade Price Books',
    desc: '93 items across 7 trades, ready on day one. Tap to add materials and labor — no typing, no guessing.',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Automated Profit Margins',
    desc: 'Set your markup once per trade category. ZenBid calculates overhead and profit perfectly on every single bid.',
  },
  {
    icon: <Phone className="w-5 h-5" />,
    title: 'Mobile-First Proposals',
    desc: 'Clients get a branded, interactive link they can open on any phone and approve with a digital signature.',
  },
  {
    icon: <ThumbsUp className="w-5 h-5" />,
    title: 'Real-Time Approval Alerts',
    desc: 'The moment a client approves, you get notified instantly. No chasing. No follow-up calls.',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Built for the Truck',
    desc: 'Build a full proposal in under 5 minutes. Send it before you leave the driveway.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Your Data, Your Business',
    desc: 'Bank-grade encryption. Your pricing and client list are never shared, sold, or visible to anyone else.',
  },
];

const PAIN_POINTS = [
  { before: 'Typing estimates in Word at 10 PM', after: 'Built in the truck in 5 minutes' },
  { before: 'Sending clunky PDF attachments', after: 'Clean branded link on their phone' },
  { before: 'Following up for days to get approval', after: 'Approved before you leave the driveway' },
  { before: 'Guessing your markup on the fly', after: 'Profit built in automatically, every time' },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from('waitlist').insert({
      email: email.trim().toLowerCase(),
      name: name.trim() || null,
      trade: trade || null,
    });

    if (error) {
      if (error.code === '23505') {
        toast.info("You're already on the list — we'll be in touch!");
        setJoined(true);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } else {
      setJoined(true);
      toast.success("You're on the list! We'll reach out when your spot is ready.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-white font-inter">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">ZenBid <span className="text-indigo-600">Pro</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors px-4 py-2">
              Member Sign In
            </Link>
            <a
              href="#waitlist"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200 hover:-translate-y-0.5"
            >
              Join Waitlist →
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 text-center relative">
          {/* Access badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-300 text-sm font-semibold mb-8">
            <Lock className="w-3.5 h-3.5" />
            Invite-Only Access · Waitlist Now Open
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 tracking-tight">
            Stop Writing Estimates.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Start Closing Jobs.
            </span>
          </h1>

          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            ZenBid Pro is the proposal tool built for tradespeople.
            Build a professional bid in minutes, send a smart link,
            and get <strong className="text-white">approved before you leave the driveway.</strong>
          </p>

          <a
            href="#waitlist"
            id="hero-cta-btn"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-xl shadow-indigo-900/50 hover:-translate-y-1 mb-12"
          >
            Request Early Access
            <ArrowRight className="w-5 h-5" />
          </a>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {TRADES.map(t => (
              <span key={t} className="bg-white/10 border border-white/10 text-white/70 text-sm px-3 py-1.5 rounded-full backdrop-blur-sm">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ─────────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Sound Familiar?</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Most contractors are losing jobs — not because of their work, but because their proposals look amateur.
            </p>
          </div>

          <div className="space-y-4">
            {PAIN_POINTS.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-100 rounded-2xl px-6 py-4 flex items-center gap-3">
                  <span className="text-red-400 text-lg flex-shrink-0">✗</span>
                  <span className="text-sm text-red-700 font-medium">{p.before}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-4 flex items-center gap-3">
                  <span className="text-emerald-500 text-lg flex-shrink-0">✓</span>
                  <span className="text-sm text-emerald-700 font-semibold">{p.after}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Build. Send. Close.</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              The entire process from walkthrough to signed proposal in under 5 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', icon: '🔨', title: 'Build in the Truck', desc: 'Tap from your pre-loaded trade price book to add materials and labor instantly. No typing. No guessing.' },
              { step: '02', icon: '📱', title: 'Send a Smart Link', desc: 'Hit send. Your client gets a branded, interactive proposal on their phone in seconds — not a clunky PDF.' },
              { step: '03', icon: '✅', title: 'Watch it Get Approved', desc: 'Client signs and taps approve. Your dashboard lights up. The job is locked in.' },
            ].map(item => (
              <div key={item.step} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="text-xs font-bold text-indigo-500 mb-2 tracking-widest uppercase">Step {item.step}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Everything You Need to Win More Jobs</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Not a bloated dispatching tool. A dedicated sales engine for the field.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="w-11 h-11 bg-indigo-100 group-hover:bg-indigo-600 rounded-xl flex items-center justify-center text-indigo-600 group-hover:text-white transition-all mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY INVITE-ONLY ─────────────────────────────────── */}
      <section className="py-24 bg-slate-950 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 rounded-full px-4 py-1.5 text-indigo-300 text-sm font-medium mb-8">
            <Lock className="w-3.5 h-3.5" />
            Why Invite-Only?
          </div>
          <h2 className="text-4xl font-black text-white mb-6">
            We're Not Trying to Be the Biggest.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              We're Here to Make You the Best.
            </span>
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-8">
            ZenBid Pro is built with a limited-access model so we can personally onboard each contractor, ensure your price book is dialed in, and make sure the platform actually delivers ROI before we scale.
          </p>
          <p className="text-slate-400 text-base leading-relaxed">
            This isn't a free tool with hidden upsells. It's a <strong className="text-white">paid professional platform</strong> — and every seat is earned. When your spot opens, you'll be the first to know.
          </p>
        </div>
      </section>

      {/* ── WAITLIST FORM ───────────────────────────────────── */}
      <section id="waitlist" className="py-24 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="max-w-xl mx-auto px-6 relative">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black text-white mb-4 leading-tight">
              Ready to Close Jobs Faster?
            </h2>
            <p className="text-indigo-200 text-lg">
              Join the waitlist. We'll reach out personally when your spot opens.
            </p>
          </div>

          {joined ? (
            <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-3xl p-10 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-black text-white mb-3">You're on the list!</h3>
              <p className="text-indigo-200 text-base leading-relaxed">
                We'll review your request and reach out personally when your spot is ready. Keep building great work — we'll be in touch soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-3xl p-8 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-indigo-100 mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Mike Johnson"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-indigo-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-indigo-100 mb-1.5">Work Email <span className="text-indigo-300">*</span></label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="mike@yourcompany.com"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-indigo-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-indigo-100 mb-1.5">Your Trade</label>
                <select
                  value={trade}
                  onChange={e => setTrade(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40 transition-all appearance-none"
                >
                  <option value="" className="text-slate-800">Select your trade…</option>
                  <option value="electrical" className="text-slate-800">⚡ Electrical</option>
                  <option value="roofing" className="text-slate-800">🏠 Roofing</option>
                  <option value="hvac" className="text-slate-800">❄️ HVAC</option>
                  <option value="painting" className="text-slate-800">🎨 Painting</option>
                  <option value="plumbing" className="text-slate-800">🔧 Plumbing</option>
                  <option value="drain" className="text-slate-800">🚿 Drain & Sewer</option>
                  <option value="general" className="text-slate-800">🏗️ General Contracting</option>
                </select>
              </div>

              <button
                id="waitlist-submit-btn"
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-white text-indigo-700 font-bold text-base rounded-xl hover:bg-indigo-50 transition-all shadow-xl hover:-translate-y-0.5 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Request My Spot
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-5 pt-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-indigo-200">
                  <CheckCircle className="w-3.5 h-3.5 text-white" /> No spam, ever
                </span>
                <span className="flex items-center gap-1.5 text-xs text-indigo-200">
                  <CheckCircle className="w-3.5 h-3.5 text-white" /> Personal onboarding included
                </span>
                <span className="flex items-center gap-1.5 text-xs text-indigo-200">
                  <CheckCircle className="w-3.5 h-3.5 text-white" /> Cancel anytime
                </span>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-slate-950 py-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">ZenBid Pro</span>
          </div>
          <div className="text-slate-500 text-sm">© {new Date().getFullYear()} ZenBid Pro. All rights reserved.</div>
          <div className="flex gap-5 text-sm text-slate-500">
            <Link to="/login" className="hover:text-white transition-colors">Member Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
