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

        let query = supabase.from('scheduled_tasks').select('*');

        if (input.projectId) {
          query = query.eq('project_id', input.projectId);
        }

        const { data, error } = await query;

        if (!error && data) {
          console.log('[Backend] Fetched', data.length, 'scheduled tasks from Supabase');

          // Convert snake_case to camelCase
          const tasks = data.map((task: any) => ({
            id: task.id,
            projectId: task.project_id,
            category: task.category,
            startDate: task.start_date,
            endDate: task.end_date,
            duration: task.duration,
            workType: task.work_type,
            notes: task.notes,
            color: task.color,
            row: task.row,
            rowSpan: task.row_span,
            completed: task.completed || false,
            completedAt: task.completed_at,
            createdAt: task.created_at,
            updatedAt: task.updated_at,
          }));

          return { scheduledTasks: tasks };
        } else {
          console.error('[Backend] Supabase error fetching scheduled tasks:', error);
        }
      } catch (error) {
        console.error('[Backend] Error fetching from Supabase:', error);
      }
    }

    // Fallback to in-memory store
    console.log('[Backend] Using in-memory store, total tasks:', scheduledTasksStore.length);

    const filteredTasks = input.projectId
      ? scheduledTasksStore.filter(task => task.projectId === input.projectId)
      : scheduledTasksStore;

    console.log('[Backend] Returning', filteredTasks.length, 'scheduled tasks for project:', input.projectId);
    return { scheduledTasks: filteredTasks };
  });

export { scheduledTasksStore };
