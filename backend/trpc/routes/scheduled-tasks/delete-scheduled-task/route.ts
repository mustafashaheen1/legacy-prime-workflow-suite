import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { scheduledTasksStore } from '../get-scheduled-tasks/route.js';
import { createClient } from '@supabase/supabase-js';

export const deleteScheduledTaskProcedure = publicProcedure
  .input(
    z.object({
      id: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Backend] Deleting scheduled task:', input.id);

    // Delete from in-memory store
    const index = scheduledTasksStore.findIndex(t => t.id === input.id);
    if (index !== -1) {
      scheduledTasksStore.splice(index, 1);
      console.log('[Backend] Deleted scheduled task from memory store');
    }

    // Delete from Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
          .from('scheduled_tasks')
          .delete()
          .eq('id', input.id);

        if (error) {
          console.error('[Backend] Supabase error deleting scheduled task:', error);
          throw new Error(`Failed to delete from database: ${error.message}`);
        }

        console.log('[Backend] Scheduled task deleted from Supabase');
        return { success: true };
      } catch (error) {
        console.error('[Backend] Error deleting from Supabase:', error);
        throw error;
      }
    }

    console.warn('[Backend] Supabase not configured - deleted from memory store only');
    return { success: true };
  });
