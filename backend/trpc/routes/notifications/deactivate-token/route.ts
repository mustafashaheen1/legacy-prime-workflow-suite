import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const deactivateTokenProcedure = publicProcedure
  .input(z.object({
    userId: z.string().uuid(),
  }))
  .mutation(async ({ input }) => {
    console.log('[Notifications] Deactivating all push tokens for user:', input.userId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured.');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', input.userId);

    if (error) {
      console.error('[Notifications] Error deactivating tokens:', error);
      throw new Error(`Failed to deactivate tokens: ${error.message}`);
    }

    console.log('[Notifications] All push tokens deactivated for user:', input.userId);
    return { success: true };
  });
