import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from "../../../../lib/sendNotification.js";

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

    const notificationId = await sendNotification(supabase, {
      userId:    input.userId,
      companyId: input.companyId,
      type:      input.type,
      title:     input.title,
      message:   input.message,
      data:      input.data,
    });

    if (!notificationId) throw new Error('Failed to create notification');

    return { success: true, notificationId };
  });
