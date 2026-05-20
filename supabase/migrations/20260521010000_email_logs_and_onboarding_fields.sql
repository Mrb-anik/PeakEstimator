-- Migration: Recreate email_logs table and add onboarding_dismissed field
-- Target: email_logs (re-created), profiles (extended)

-- 1. Drop existing table if it exists to avoid type mismatch / schema conflicts
DROP TABLE IF EXISTS public.email_logs CASCADE;

-- 2. Create the production-grade email_logs table
CREATE TABLE public.email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  template_type text NOT NULL,
  subject text NOT NULL,
  delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'opened', 'clicked', 'bounced')),
  provider text DEFAULT 'smtp',
  provider_message_id text,
  error_message text,
  html_preview text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Enable strict Row Level Security
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Admins view all email logs" ON public.email_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users view own email logs" ON public.email_logs
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Allow service role or trigger operations to insert logs
CREATE POLICY "Service role insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

-- 5. Extend profiles table with onboarding_dismissed field
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_dismissed boolean DEFAULT false;

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON public.email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

-- 7. Force notify schema reload
NOTIFY pgrst, 'reload schema';
