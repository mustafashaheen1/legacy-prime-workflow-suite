import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const registerTokenProcedure = publicProcedure
  .input(
    z.object({
      token:     z.string().min(1),
      platform:  z.enum(['ios', 'android', 'web']),
      userId:    z.string().uuid(),
      companyId: z.string().uuid(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Notifications] Registering push token for user:', input.userId, 'platform:', input.platform);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Notifications] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert on token: if the same device re-registers (e.g. after reinstall),
    // we refresh is_active and updated_at rather than inserting a duplicate.
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          token:      input.token,
          user_id:    input.userId,
          company_id: input.companyId,
          platform:   input.platform,
          is_active:  true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[Notifications] Error registering push token:', error);
      throw new Error(`Failed to register push token: ${error.message}`);
    }

    console.log('[Notifications] Push token registered successfully');
    return { success: true };
  });
