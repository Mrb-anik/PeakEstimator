/**
 * envValidation.ts
 * ─────────────────────────────────────────────────────────────────
 * Hard-fail environment variable validation at app startup.
 * Any missing REQUIRED var throws — never silently falls back.
 * OPTIONAL vars log a warning but don't block startup.
 * ─────────────────────────────────────────────────────────────────
 */

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  { key: 'VITE_SUPABASE_URL',      required: true,  description: 'Supabase project URL' },
  { key: 'VITE_SUPABASE_ANON_KEY', required: true,  description: 'Supabase anon public key' },
  { key: 'VITE_CAL_BOOKING_LINK',  required: false, description: 'Cal.com booking link (optional)' },
];

export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = import.meta.env[envVar.key];
    const isEmpty = !value || value.trim() === '' || value.includes('placeholder');

    if (isEmpty && envVar.required) {
      missing.push(`  • ${envVar.key} — ${envVar.description}`);
    } else if (isEmpty && !envVar.required) {
      console.warn(`[ENV] Optional variable not set: ${envVar.key} (${envVar.description})`);
    }
  }

  if (missing.length > 0) {
    const message = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '  PeakEstimator — Missing Required Environment Variables',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'The following required variables are not set:',
      ...missing,
      '',
      'Create a .env.local file based on .env.example',
      'and set each variable before starting the app.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    throw new Error(message);
  }
}
