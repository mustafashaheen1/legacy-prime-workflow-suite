import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getNotificationsProcedure = publicProcedure
  .input(z.object({
    userId:     z.string().uuid(),
    companyId:  z.string().uuid(),
    unreadOnly: z.boolean().optional(),
    limit:      z.number().min(1).max(100).optional().default(50),
  }))
  .query(async ({ input }) => {
    console.log('[Notifications] Fetching for user:', input.userId, 'unreadOnly:', input.unreadOnly);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured.');

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', input.userId)
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(input.limit);

    if (input.unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Notifications] Fetch error:', error);
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    const notifications = (data || []).map((n: any) => ({
      id:        n.id,
      userId:    n.user_id,
      companyId: n.company_id,
      type:      n.type,
      title:     n.title,
      message:   n.message,
      data:      n.data,
      read:      n.read,
      readAt:    n.read_at,
      createdAt: n.created_at,
    }));

    console.log('[Notifications] Found', notifications.length, 'notifications');
    return { success: true, notifications };
  });
