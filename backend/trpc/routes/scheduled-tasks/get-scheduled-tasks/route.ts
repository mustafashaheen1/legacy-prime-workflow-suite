import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { ScheduledTask } from '../../../../../types/index';
import { createClient } from '@supabase/supabase-js';

const scheduledTasksStore: ScheduledTask[] = [];

export const getScheduledTasksProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Backend] Fetching scheduled tasks for project:', input.projectId);

    // Try to fetch from Supabase first
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        let query = supabase
          .from('scheduled_tasks')
          .select('*')
          .order('start_date', { ascending: true });

        if (input.projectId) {
          query = query.eq('project_id', input.projectId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('[Backend] Supabase error fetching scheduled tasks:', error);
          throw new Error(`Failed to fetch from database: ${error.message}`);
        }

        // Convert snake_case to camelCase
        const scheduledTasks: ScheduledTask[] = (data || []).map((row: any) => ({
          id: row.id,
          projectId: row.project_id,
          category: row.category,
          startDate: row.start_date,
          endDate: row.end_date,
          duration: row.duration,
          workType: row.work_type,
          notes: row.notes,
          color: row.color,
          row: row.row,
          rowSpan: row.row_span,
        }));

        console.log('[Backend] Fetched', scheduledTasks.length, 'scheduled tasks from Supabase');
        return { scheduledTasks };
      } catch (error) {
        console.error('[Backend] Error querying Supabase:', error);
        // Fall back to in-memory store on error
      }
    }

    // Fallback to in-memory store
    console.warn('[Backend] Using in-memory store for scheduled tasks');
    const filteredTasks = input.projectId
      ? scheduledTasksStore.filter(task => task.projectId === input.projectId)
      : scheduledTasksStore;

    return { scheduledTasks: filteredTasks };
  });

export { scheduledTasksStore };
