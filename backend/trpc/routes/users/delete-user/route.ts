import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const deleteUserProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Deleting user:', input.userId);

    try {
      // Check if Supabase is configured
      if (!supabase) {
        console.error('[Users] Supabase not configured - check environment variables');
        throw new Error('Database not configured. Please contact support.');
      }

      // Delete from users table (this will cascade to auth.users if configured)
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', input.userId);

      if (dbError) {
        console.error('[Users] Error deleting user from database:', dbError);
        throw new Error(`Failed to delete user: ${dbError.message}`);
      }

      // Delete from auth.users
      const { error: authError } = await supabase.auth.admin.deleteUser(input.userId);

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
