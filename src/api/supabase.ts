/**
 * supabase.ts — Singleton Supabase client.
 *
 * RULE: This is the ONLY place a Supabase client is created.
 *       Import { supabase } from '@/api/supabase' everywhere.
 *       Never call createClient() anywhere else in the codebase.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  throw new Error(
    'Missing required Supabase environment variables.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.\n' +
    'See .env.example for reference.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
