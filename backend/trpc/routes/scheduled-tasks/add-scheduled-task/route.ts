import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { scheduledTasksStore } from '../get-scheduled-tasks/route.js';
import { createClient } from '@supabase/supabase-js';

export const addScheduledTaskProcedure = publicProcedure
  .input(
    z.object({
      id: z.string().optional(),
      projectId: z.string(),
      category: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      duration: z.number(),
      workType: z.enum(['in-house', 'subcontractor']),
      notes: z.string().optional(),
      color: z.string(),
      row: z.number().optional(),
      rowSpan: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('[Backend] Adding scheduled task with input:', input);

      const scheduledTask = {
        id: input.id || `scheduled-task-${Date.now()}`,
        projectId: input.projectId,
        category: input.category,
        startDate: input.startDate,
        endDate: input.endDate,
        duration: input.duration,
        workType: input.workType,
        notes: input.notes,
        color: input.color,
        row: input.row || 0,
        rowSpan: input.rowSpan || 1,
      };

      // Save to in-memory store for backward compatibility
      scheduledTasksStore.push(scheduledTask);

      // Save to Supabase database
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .insert({
            id: scheduledTask.id,
            project_id: input.projectId,
            category: input.category,
            start_date: input.startDate,
            end_date: input.endDate,
            duration: input.duration,
            work_type: input.workType,
            notes: input.notes,
            color: input.color,
            row: scheduledTask.row,
            row_span: scheduledTask.rowSpan,
          })
          .select()
          .single();

        if (error) {
          console.error('[Backend] Supabase error adding scheduled task:', error);
          throw new Error(`Failed to save to database: ${error.message}`);
        }

        console.log('[Backend] Scheduled task saved to Supabase:', data);
      } else {
        console.warn('[Backend] Supabase not configured - scheduled task saved to memory only');
      }

      console.log('[Backend] Scheduled task created:', scheduledTask);
      console.log('[Backend] Total scheduled tasks in store:', scheduledTasksStore.length);

      return { success: true, scheduledTask };
    } catch (error) {
      console.error('[Backend] Error adding scheduled task:', error);
      throw new Error('Failed to add scheduled task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });
