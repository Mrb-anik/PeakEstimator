-- Premium Enterprise Schema Migration for PeakEstimator
-- Targets: activity_events, integration_requests, support_tickets, ticket_responses, notifications, email_logs, profiles columns.

-- 1. Extend profiles table with onboarding and customer intelligence fields
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{"email": true, "in_app": true, "digest": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS has_dismissed_helpers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS assigned_success_manager text DEFAULT null,
  ADD COLUMN IF NOT EXISTS concierge_requested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS concierge_details jsonb DEFAULT '{}'::jsonb;

-- 2. Create activity_events table (Universal Event Bus & Timeline)
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  action_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own events" ON public.activity_events 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all events" ON public.activity_events 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 3. Create integration_requests table
CREATE TABLE IF NOT EXISTS public.integration_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_need text NOT NULL,
  current_tool text,
  desired_workflow text,
  urgency text DEFAULT 'medium' CHECK (urgency IN ('low','medium','high','critical')),
  expected_outcome text,
  attachment_url text,
  status text DEFAULT 'pending review' CHECK (status IN ('pending review','under analysis','planned','in progress','completed','rejected')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  admin_notes text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.integration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own integration requests" ON public.integration_requests 
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins full access integration requests" ON public.integration_requests 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 4. Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text CHECK (category IN ('billing','technical','bug','feature','other')),
  subject text NOT NULL,
  message text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open','in progress','resolved','closed')),
  attachment_url text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  sla_timer timestamptz DEFAULT (now() + interval '4 hours'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own support tickets" ON public.support_tickets 
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins full access support tickets" ON public.support_tickets 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 5. Create ticket_responses table
CREATE TABLE IF NOT EXISTS public.ticket_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ticket_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own ticket responses" ON public.ticket_responses 
  FOR ALL USING (
    (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()) AND is_internal = false) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. Create notifications table (In-App Alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info','success','warning','activity','support')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own notifications" ON public.notifications 
  FOR ALL USING (auth.uid() = user_id);

-- 7. Create email_logs table (Branded Email Delivery Statuses)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent','delivered','failed','opened','clicked','bounced')),
  retry_count integer DEFAULT 0,
  failed_reason text,
  tracking_token text UNIQUE,
  headers jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all email logs" ON public.email_logs 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Indexes for performance optimizations
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id ON public.activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON public.activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_requests_user_id ON public.integration_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket_id ON public.ticket_responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_tracking_token ON public.email_logs(tracking_token);
