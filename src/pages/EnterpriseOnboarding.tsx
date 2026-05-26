import { useState } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, AlertCircle,
  Building2, Zap, Mail, Globe, CreditCard, Users, Smartphone,
  Star, FileText, Shield, Landmark, Download, Send, Lock,
  UploadCloud, ExternalLink, Copy, Check
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────
interface AccessItem {
  id: string;
  label: string;
  description: string;
  howToGet?: string;
  required: boolean;
  type: 'file' | 'text' | 'dns' | 'oauth' | 'info' | 'email';
}

interface OnboardingSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  plans: ('pro' | 'enterprise' | 'white_glove')[];
  items: AccessItem[];
  durationEstimate: string;
}

// ─── Onboarding data ──────────────────────────────────────────
const SECTIONS: OnboardingSection[] = [
  {
    id: 'identity',
    title: 'Company Identity & Brand',
    icon: Building2,
    color: 'text-copper',
    plans: ['pro', 'enterprise', 'white_glove'],
    durationEstimate: '10 min',
    items: [
      { id: 'logo', label: 'Company Logo', description: 'PNG, SVG, or JPG — minimum 400×400px, transparent background preferred. Appears on all proposals and PDFs.', howToGet: 'Export from your graphic designer, Canva, or your website assets.', required: true, type: 'file' },
      { id: 'company_name', label: 'Legal Company Name', description: 'As it appears on your license and contracts. Used on proposal headers, emails, and client-facing documents.', required: true, type: 'text' },
      { id: 'trade_license', label: 'License / Contractor Number', description: 'Displayed on PDF proposals for credibility and legal compliance. E.g. "License #EC-88234".', required: false, type: 'text' },
      { id: 'company_email', label: 'Business Email Address', description: 'Proposals and follow-up emails are sent from this address (or our branded sender on your behalf).', required: true, type: 'email' },
      { id: 'company_phone', label: 'Company Phone Number', description: 'Shown on proposals and client portal footer.', required: true, type: 'text' },
      { id: 'brand_colors', label: 'Brand Color Codes (Enterprise)', description: 'Primary and secondary hex codes (#RRGGBB) for your client portal and proposal theme.', howToGet: 'Pull from your website CSS, ask your designer, or use Canva brand kit.', required: false, type: 'text' },
      { id: 'terms_text', label: 'Proposal Terms & Conditions', description: 'The legal text shown below the digital signature block. You can use our default or provide your own.', required: false, type: 'text' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Scope Assistant Setup',
    icon: Zap,
    color: 'text-violet-400',
    plans: ['pro', 'enterprise', 'white_glove'],
    durationEstimate: '5 min',
    items: [
      { id: 'trade_types', label: 'Your Trade Specialties', description: 'List all trades you estimate for: electrical, roofing, HVAC, plumbing, painting, general, etc. The AI tailors scope suggestions to your trade.', required: true, type: 'text' },
      { id: 'scope_samples', label: '3–5 Sample Scope Descriptions (optional)', description: 'Paste examples of how you currently describe jobs. The AI learns your language and style for more accurate output.', howToGet: 'Pull from past proposals or emails to clients.', required: false, type: 'text' },
      { id: 'ai_consent', label: 'AI Usage Authorization', description: 'You authorize PeakEstimator to process your job descriptions through our AI system (OpenRouter / Gemini) to generate scope suggestions. No data is sold or shared with third parties.', required: true, type: 'info' },
    ],
  },
  {
    id: 'email',
    title: 'Email & Follow-Up Automation',
    icon: Mail,
    color: 'text-blue-400',
    plans: ['pro', 'enterprise', 'white_glove'],
    durationEstimate: '15 min',
    items: [
      { id: 'sender_preference', label: 'Email Sender Preference', description: 'Choose: (A) Use our shared sender — proposals@peakestimator.com, or (B) Send from your own domain.', required: true, type: 'text' },
      { id: 'custom_domain_email', label: 'Custom Sending Domain (if option B)', description: 'We add 2 DNS records (SPF + DKIM) to your domain so emails arrive in inbox, not spam. Requires access to your DNS panel (GoDaddy, Cloudflare, etc.).', howToGet: 'Log into your domain registrar and be ready to add TXT/CNAME records. We provide the exact values.', required: false, type: 'dns' },
      { id: 'email_consent', label: 'Email Sending Authorization', description: 'You authorize PeakEstimator to send proposal delivery, follow-up, and approval notification emails on your behalf to your clients.', required: true, type: 'info' },
      { id: 'unsubscribe_address', label: 'Unsubscribe / Reply-To Address', description: 'Where client replies and unsubscribes are routed. Usually your main business email.', required: true, type: 'email' },
    ],
  },
  {
    id: 'portal',
    title: 'Custom Client Portal Domain',
    icon: Globe,
    color: 'text-emerald-400',
    plans: ['enterprise', 'white_glove'],
    durationEstimate: '20 min',
    items: [
      { id: 'subdomain', label: 'Your Subdomain Choice', description: 'The URL your clients visit to review and sign proposals. Format: proposals.yourcompany.com or quotes.yourcompany.com.', howToGet: 'Pick your preferred subdomain — you\'ll add a CNAME record in your DNS panel.', required: true, type: 'text' },
      { id: 'cname_setup', label: 'CNAME DNS Record', description: 'You\'ll add one DNS record: CNAME → portals.peakestimator.app. Takes 5 minutes in your DNS panel, propagates in 5–60 minutes.', howToGet: 'Log into GoDaddy / Cloudflare / Namecheap → DNS settings → Add CNAME. We walk you through it.', required: true, type: 'dns' },
      { id: 'portal_tagline', label: 'Portal Tagline (optional)', description: 'Short line shown under your logo on the portal. E.g. "Professional Electrical Services — Licensed & Insured."', required: false, type: 'text' },
    ],
  },
  {
    id: 'payments',
    title: 'Stripe Payment Collection',
    icon: CreditCard,
    color: 'text-amber-400',
    plans: ['enterprise', 'white_glove'],
    durationEstimate: '20 min',
    items: [
      { id: 'stripe_account', label: 'Stripe Account', description: 'You need a Stripe account (free to create). Funds deposit directly to your bank — PeakEstimator never touches your money.', howToGet: 'Go to stripe.com → Create account → Complete business verification (5–10 min).', required: true, type: 'oauth' },
      { id: 'stripe_publishable', label: 'Stripe Publishable Key', description: 'Found in Stripe Dashboard → Developers → API Keys. Starts with pk_live_...', howToGet: 'Stripe Dashboard → Developers → API Keys → Publishable key.', required: true, type: 'text' },
      { id: 'stripe_restricted', label: 'Stripe Restricted API Key', description: 'Create a restricted key with permissions: Payment Links (write), Checkout Sessions (write), Customers (read/write). Never share your full secret key.', howToGet: 'Stripe Dashboard → Developers → API Keys → Create restricted key → Select permissions.', required: true, type: 'text' },
      { id: 'deposit_amounts', label: 'Default Deposit Percentages', description: 'What % deposit do you collect upfront? E.g. 30% on signing, 40% at rough-in, 30% on completion.', required: true, type: 'text' },
    ],
  },
  {
    id: 'team',
    title: 'Team & Multi-User Setup',
    icon: Users,
    color: 'text-rose-400',
    plans: ['enterprise', 'white_glove'],
    durationEstimate: '10 min',
    items: [
      { id: 'team_emails', label: 'Team Member Emails & Roles', description: 'List all staff who need access. Roles: Admin (full control), Estimator (create/edit proposals), Viewer (read-only), Sales Manager (CRM access).', required: true, type: 'email' },
      { id: 'team_consent', label: 'Team Invitation Authorization', description: 'You authorize PeakEstimator to send invitation emails to the team members you listed and create accounts on their behalf.', required: true, type: 'info' },
    ],
  },
  {
    id: 'sms',
    title: 'SMS & WhatsApp Delivery',
    icon: Smartphone,
    color: 'text-teal-400',
    plans: ['white_glove'],
    durationEstimate: '15 min',
    items: [
      { id: 'sms_preference', label: 'SMS Provider Preference', description: 'Choose: (A) Use our shared Twilio sender number, or (B) Use your own Twilio account and number for branded SMS.', required: true, type: 'text' },
      { id: 'twilio_sid', label: 'Twilio Account SID (if own account)', description: 'Found in Twilio Console dashboard. Grants us ability to send SMS on your behalf.', howToGet: 'twilio.com/console → Account Info → Account SID.', required: false, type: 'text' },
      { id: 'twilio_token', label: 'Twilio Auth Token (if own account)', description: 'Keep this private — share only via our secure key vault, never by email.', howToGet: 'twilio.com/console → Account Info → Auth Token (click reveal).', required: false, type: 'text' },
      { id: 'twilio_number', label: 'Twilio Phone Number (if own account)', description: 'The number clients see when they receive SMS from you. Format: +15551234567.', required: false, type: 'text' },
      { id: 'sms_consent', label: 'SMS Sending Authorization', description: 'You confirm all recipients have opted in to receive SMS, complying with TCPA regulations.', required: true, type: 'info' },
    ],
  },
  {
    id: 'reviews',
    title: 'Google Review Automation',
    icon: Star,
    color: 'text-yellow-400',
    plans: ['white_glove'],
    durationEstimate: '5 min',
    items: [
      { id: 'google_place_id', label: 'Google Business Profile Place ID', description: 'The unique ID of your Google Business listing. Used to generate your direct review link.', howToGet: 'Go to maps.google.com → Search your business → Click the share icon → Copy link → Extract the Place ID (CID) from the URL. Or use developers.google.com/maps/documentation/places/web-service/place-id.', required: true, type: 'text' },
      { id: 'review_timing', label: 'Review Request Timing', description: 'When should the review request be sent? Immediately on project completion, or 24–48 hours later?', required: true, type: 'text' },
    ],
  },
];

// ─── Plan info ──────────────────────────────────────────────────
const PLAN_INFO = {
  pro: { label: 'Pro Plan', price: '$49/mo', color: 'text-copper', bg: 'bg-copper/10 border-copper/30' },
  enterprise: { label: 'Enterprise Plan', price: '$199/mo', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  white_glove: { label: 'White Glove', price: 'Custom', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
};

// ─── Component ──────────────────────────────────────────────────
export default function EnterpriseOnboarding() {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise' | 'white_glove'>('enterprise');
  const [expanded, setExpanded] = useState<string[]>(['identity']);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const visibleSections = SECTIONS.filter(s => s.plans.includes(selectedPlan));
  const allItems = visibleSections.flatMap(s => s.items.filter(i => i.required));
  const completedRequired = allItems.filter(i => completed.has(i.id)).length;
  const progressPct = Math.round((completedRequired / allItems.length) * 100);

  const toggle = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const markDone = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied!');
  };

  const handleSubmitRequest = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
    toast.success('Onboarding checklist submitted! Your success manager will reach out within 1 business day.');
  };

  const typeConfig: Record<string, { icon: React.ComponentType<any>; badge: string; color: string }> = {
    file:  { icon: UploadCloud, badge: 'File Upload', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    text:  { icon: FileText,    badge: 'Text / Info', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
    dns:   { icon: Globe,       badge: 'DNS Change',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    oauth: { icon: ExternalLink,badge: 'OAuth / API Key', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    info:  { icon: Shield,      badge: 'Authorization', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    email: { icon: Mail,        badge: 'Email Address', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-navy-900 to-slate-900 text-white font-inter">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-copper to-amber-500 flex items-center justify-center shadow-lg shadow-copper/30">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/90">PeakEstimator</p>
              <p className="text-[10px] text-white/40">Enterprise Onboarding & Access Guide</p>
            </div>
          </div>
          {/* Progress pill */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-copper rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-xs font-bold text-white/60">{progressPct}%</span>
            </div>
            <button
              onClick={() => {
                const text = visibleSections.map(s =>
                  `## ${s.title}\n` + s.items.map(i => `- [${completed.has(i.id) ? 'x' : ' '}] ${i.label}${i.required ? ' *' : ''}`).join('\n')
                ).join('\n\n');
                copyText(text, 'full');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/10"
            >
              {copiedId === 'full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Checklist
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-copper/20 border border-copper/30 text-copper text-xs font-bold uppercase tracking-wider">
            <Lock className="w-3 h-3" /> Secure Onboarding Protocol
          </div>
          <h1 className="text-3xl sm:text-4xl font-sora font-extrabold text-white">
            What We Need From You
          </h1>
          <p className="text-base text-white/50 max-w-xl mx-auto leading-relaxed">
            To unlock the full power of PeakEstimator for your business, we need specific access and information. Here's exactly what, why, and how to get it — broken down by feature.
          </p>
        </div>

        {/* Plan Selector */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Your Plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.entries(PLAN_INFO) as [keyof typeof PLAN_INFO, typeof PLAN_INFO[keyof typeof PLAN_INFO]][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelectedPlan(key)}
                className={`rounded-xl p-4 text-left border transition-all ${selectedPlan === key ? info.bg : 'bg-white/5 border-white/10 hover:border-white/20'}`}
              >
                <div className={`text-xs font-extrabold ${selectedPlan === key ? info.color : 'text-white/50'} mb-0.5`}>{info.label}</div>
                <div className="text-base font-sora font-extrabold text-white">{info.price}</div>
                <div className="text-[10px] text-white/30 mt-1 font-medium">
                  {key === 'pro' ? 'Core platform + AI + email automations' :
                   key === 'enterprise' ? 'Everything Pro + custom domain, team, Stripe' :
                   'Full setup, migration, SMS, reviews, training'}
                </div>
                {selectedPlan === key && <CheckCircle2 className={`w-4 h-4 ${info.color} mt-2`} />}
              </button>
            ))}
          </div>
        </div>

        {/* Progress summary */}
        <div className="flex items-center justify-between px-5 py-3 bg-white/5 rounded-xl border border-white/10">
          <span className="text-xs text-white/50 font-medium">{completedRequired} of {allItems.length} required items acknowledged</span>
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-copper rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {visibleSections.map(section => {
            const SectionIcon = section.icon;
            const isOpen = expanded.includes(section.id);
            const sectionItems = section.items;
            const doneCount = sectionItems.filter(i => completed.has(i.id)).length;
            const allDone = doneCount === sectionItems.length;

            return (
              <div key={section.id} className={`bg-white/5 border rounded-2xl overflow-hidden transition-all ${allDone ? 'border-emerald-500/30' : 'border-white/10'}`}>
                {/* Section header */}
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
                  onClick={() => toggle(section.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center`}>
                      <SectionIcon className={`w-4 h-4 ${section.color}`} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-white">{section.title}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{section.durationEstimate} to complete · {doneCount}/{sectionItems.length} items done</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {allDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {isOpen ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
                  </div>
                </button>

                {/* Items */}
                {isOpen && (
                  <div className="border-t border-white/10 divide-y divide-white/5">
                    {sectionItems.map(item => {
                      const isDone = completed.has(item.id);
                      const tc = typeConfig[item.type];
                      const TypeIcon = tc.icon;
                      return (
                        <div key={item.id} className={`px-6 py-4 transition-colors ${isDone ? 'bg-emerald-500/5' : ''}`}>
                          <div className="flex items-start gap-4">
                            <button
                              onClick={() => markDone(item.id)}
                              className="mt-0.5 flex-shrink-0"
                            >
                              {isDone
                                ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                : <Circle className="w-5 h-5 text-white/20 hover:text-white/50 transition-colors" />
                              }
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-white">{item.label}</p>
                                {item.required
                                  ? <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase">Required</span>
                                  : <span className="text-[9px] font-black text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase">Optional</span>
                                }
                                <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border ${tc.color}`}>
                                  <TypeIcon className="w-2.5 h-2.5" />{tc.badge}
                                </span>
                              </div>
                              <p className="text-xs text-white/50 leading-relaxed">{item.description}</p>
                              {item.howToGet && (
                                <div className="mt-2 flex items-start gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                                  <AlertCircle className="w-3.5 h-3.5 text-copper flex-shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-copper/80 leading-relaxed">
                                    <span className="font-bold text-copper">How to get it: </span>
                                    {item.howToGet}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* What WE provide section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="font-sora font-extrabold text-white text-sm flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-emerald-400" /> What WE Provide (You Don't Need to Touch This)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'AI Engine', value: 'OpenRouter / Gemini — we manage the API keys and rate limits' },
              { label: 'Email Delivery', value: 'Resend infrastructure — enterprise deliverability, bounce handling' },
              { label: 'PDF Generation', value: 'Server-side rendering — no client software needed' },
              { label: 'Digital Signatures', value: 'Built-in — legally binding, audit logged, no DocuSign needed' },
              { label: 'Hosting & Security', value: 'Supabase + Cloudflare — SOC2-aligned, encrypted at rest & transit' },
              { label: 'Backups', value: 'Daily automated — 30-day point-in-time recovery' },
              { label: 'Uptime SLA', value: '99.9% uptime guarantee on Enterprise plan' },
              { label: 'Support', value: 'Email + in-app ticket system. White Glove: dedicated Slack channel' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">{label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Promise */}
        <div className="bg-gradient-to-r from-violet-950/40 to-slate-900/40 border border-violet-500/20 rounded-2xl p-6">
          <h2 className="font-sora font-extrabold text-white text-sm flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-violet-400" /> Our Security Commitment to You
          </h2>
          <div className="space-y-2 text-xs text-white/60 leading-relaxed">
            <p>• <strong className="text-white">We never store plain-text API keys</strong> — all secrets are encrypted at the Supabase Vault level, never in application code.</p>
            <p>• <strong className="text-white">We never access funds</strong> — Stripe payments route directly to your bank account. We only trigger the session, not the payout.</p>
            <p>• <strong className="text-white">You own your data</strong> — full export available at any time. Cancelling your subscription gives you a complete data snapshot.</p>
            <p>• <strong className="text-white">Minimal-scope access only</strong> — for any third-party API key we request, we tell you exactly what permissions are needed and why.</p>
            <p>• <strong className="text-white">Share keys securely</strong> — never send API keys via email or chat. Use the in-app secure key vault (Admin Portal → Integrations) or our encrypted onboarding form.</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="font-sora font-extrabold text-white text-sm flex items-center gap-2 mb-5">
            <FileText className="w-4 h-4 text-copper" /> Typical Onboarding Timeline
          </h2>
          <div className="relative pl-6 space-y-5">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
            {[
              { day: 'Day 0', title: 'Account Created & Wire Submitted', desc: 'You submit your wire reference. We queue your account for activation.' },
              { day: 'Day 1', title: 'Account Activated + Kickoff Call', desc: 'Wire confirmed, account upgraded. Your success manager books a 30-min screen-share.' },
              { day: 'Day 1–2', title: 'Brand Setup', desc: 'Logo, colors, company info uploaded. Email domain records added. AI calibrated to your trades.' },
              { day: 'Day 2–3', title: 'Custom Domain Live (Enterprise)', desc: 'CNAME propagated. Your client portal is live at proposals.yourcompany.com.' },
              { day: 'Day 3–5', title: 'Stripe & Team Setup', desc: 'Payment collection activated. Team invitations sent. Roles configured.' },
              { day: 'Day 5–7', title: 'First Proposal Sent', desc: 'We build one live proposal together during your training session.' },
              { day: 'Day 7+', title: 'You\'re Fully Operational', desc: 'Ongoing success check-ins weekly for 30 days. Then monthly.' },
            ].map((step, i) => (
              <div key={i} className="relative flex items-start gap-4">
                <div className="absolute -left-6 w-4 h-4 rounded-full bg-copper border-2 border-slate-900 flex-shrink-0" />
                <div>
                  <span className="text-[9px] font-black text-copper uppercase tracking-wider">{step.day}</span>
                  <p className="text-sm font-bold text-white mt-0.5">{step.title}</p>
                  <p className="text-xs text-white/40 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit CTA */}
        {!submitted ? (
          <div className="bg-gradient-to-br from-copper/20 to-amber-500/10 border border-copper/30 rounded-2xl p-6 text-center">
            <h2 className="font-sora font-extrabold text-white text-lg mb-2">Ready to Get Started?</h2>
            <p className="text-sm text-white/50 mb-5 max-w-md mx-auto">
              Acknowledge the items above as you gather them, then hit the button below. Your dedicated success manager will reach out within 1 business day to begin setup.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-copper hover:bg-copper-hover text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-copper/20 disabled:opacity-60"
              >
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Submit Onboarding Request'}
              </button>
              <button
                onClick={() => {
                  const text = `PeakEstimator Enterprise Onboarding Checklist\nPlan: ${PLAN_INFO[selectedPlan].label}\n\n` +
                    visibleSections.map(s =>
                      `## ${s.title}\n` + s.items.map(i =>
                        `${i.required ? '*' : '-'} ${i.label}: ${i.description}`
                      ).join('\n')
                    ).join('\n\n');
                  copyText(text, 'download');
                }}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-bold text-sm transition-all"
              >
                {copiedId === 'download' ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
                {copiedId === 'download' ? 'Copied!' : 'Copy Full Checklist'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h2 className="font-sora font-extrabold text-white text-lg mb-2">Onboarding Request Submitted!</h2>
            <p className="text-sm text-white/50">Your success manager will contact you within 1 business day. Check your email for next steps.</p>
          </div>
        )}

        <p className="text-center text-[11px] text-white/20 pb-4">
          Questions? Email <a href="mailto:billing@peakestimator.com" className="text-copper hover:underline">billing@peakestimator.com</a> · PeakEstimator Technologies Inc.
        </p>
      </div>
    </div>
  );
}
