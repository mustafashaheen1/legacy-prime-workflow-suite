import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const deleteUserProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Deleting user:', input.userId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Users] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Delete from users table (this will cascade to auth.users if configured)
      console.log('[Users] Deleting from users table...');
      const dbStartTime = Date.now();

      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', input.userId);

      console.log(`[Users] Database delete completed in ${Date.now() - dbStartTime}ms`);

      if (dbError) {
        console.error('[Users] Error deleting user from database:', dbError);
        throw new Error(`Failed to delete user: ${dbError.message}`);
      }

      // Delete from auth.users
      console.log('[Users] Deleting from auth.users...');
      const authStartTime = Date.now();

      const { error: authError } = await supabase.auth.admin.deleteUser(input.userId);

      console.log(`[Users] Auth delete completed in ${Date.now() - authStartTime}ms`);

      if (authError) {
        console.error('[Users] Error deleting user from auth:', authError);
        // Don't throw here as the database record is already deleted
        console.warn('[Users] User deleted from database but not from auth');
      }

      console.log('[Users] User deleted successfully');

      return { success: true };
    } catch (error: any) {
      console.error('[Users] Unexpected error:', error);
      throw new Error(error.message || 'Failed to delete user');
    }
  });
