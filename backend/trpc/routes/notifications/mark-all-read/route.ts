import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const markAllNotificationsReadProcedure = publicProcedure
  .input(z.object({
    userId: z.string().uuid(),
  }))
  .mutation(async ({ input }) => {
    console.log('[Notifications] Marking all read for user:', input.userId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured.');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error, count } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', input.userId)
      .eq('read', false);

    if (error) {
      console.error('[Notifications] Mark-all-read error:', error);
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }

    console.log('[Notifications] Marked all read for user:', input.userId, 'count:', count);
    return { success: true, count: count ?? 0 };
  });
