import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

/**
 * Persists a notification record to the DB.
 *
 * Intentionally does NOT look up push tokens or call the Expo relay.
 * This endpoint is called from the client when the acting user is
 * already in the app — they see the notification instantly via local
 * state. A push to their own device is redundant and adds two extra
 * DB round-trips that cause FUNCTION_INVOCATION_TIMEOUT on cold starts.
 *
 * Server-side triggers (cron, webhooks) that need to push to a user
 * who may be offline should call sendNotification() directly instead.
 */
export const createNotificationProcedure = publicProcedure
  .input(z.object({
    userId:    z.string().uuid(),
    companyId: z.string().uuid(),
    type:      z.enum(['estimate-received', 'proposal-submitted', 'payment-received', 'change-order', 'general', 'task-reminder']),
    title:     z.string().min(1),
    message:   z.string().min(1),
    data:      z.record(z.unknown()).optional(),
  }))
  .mutation(async ({ input }) => {
    console.log('[Notifications] createNotification:', input.type, 'for user:', input.userId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured.');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id:    input.userId,
        company_id: input.companyId,
        type:       input.type,
        title:      input.title,
        message:    input.message,
        data:       input.data ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Notifications] DB insert failed:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    console.log('[Notifications] Persisted notification:', data.id);
    return { success: true, notificationId: data.id };
  });
