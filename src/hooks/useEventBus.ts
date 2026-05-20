import { supabase } from '../api/supabase';
import { toast } from 'sonner';

interface TriggerEventParams {
  entityType: 'estimate' | 'support' | 'integration' | 'member' | 'onboarding';
  entityId?: string;
  actionType: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  sendNotification?: boolean;
  notificationType?: 'info' | 'success' | 'warning' | 'activity' | 'support';
  sendEmail?: boolean;
  emailType?: 'invite' | 'welcome' | 'prospect' | 'new_member' | 'ticket_received' | 'feature_received' | 'activity';
  recipientEmail?: string;
  emailSubject?: string;
}

export function useEventBus() {
  const triggerEvent = async (params: TriggerEventParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // 1. Insert into activity_events (Universal Timeline)
      const { data: eventData, error: eventErr } = await supabase
        .from('activity_events')
        .insert({
          user_id: user.id,
          entity_type: params.entityType,
          entity_id: params.entityId || null,
          action_type: params.actionType,
          metadata: {
            title: params.title,
            description: params.description,
            ...params.metadata,
          },
        })
        .select()
        .single();

      if (eventErr) {
        console.error('Event Bus logging failed:', eventErr.message);
      }

      // 2. Insert into notifications (if requested)
      if (params.sendNotification) {
        const { error: notifErr } = await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            title: params.title,
            message: params.description,
            type: params.notificationType || 'info',
            is_read: false,
          });

        if (notifErr) {
          console.error('Event Bus notification failed:', notifErr.message);
        }
      }

      // 3. Insert into email_logs (if requested)
      if (params.sendEmail && params.recipientEmail) {
        const trackingToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        
        const { error: emailErr } = await supabase
          .from('email_logs')
          .insert({
            user_id: user.id,
            template_type: params.emailType || 'activity',
            recipient_email: params.recipientEmail,
            subject: params.emailSubject || params.title,
            delivery_status: 'sent',
            provider: 'resend',
            provider_message_id: trackingToken,
            metadata: {
              'message_id': `<${trackingToken}@peakestimator.top>`,
              'entity_ref': `${params.entityType}:${params.entityId || 'none'}`,
              'entity_type': params.entityType,
              'action_type': params.actionType,
            },
          });

        if (emailErr) {
          console.error('Event Bus email logging failed:', emailErr.message);
        } else {
          console.log(`[Email System] Dispatched ${params.emailType} email to ${params.recipientEmail}`);
        }
      }

      return eventData;
    } catch (err) {
      console.error('Event Bus critical failure:', err);
      return null;
    }
  };

  return { triggerEvent };
}
