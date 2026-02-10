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

      const taskId = input.id || `scheduled-task-${Date.now()}`;
      const now = new Date().toISOString();

      const scheduledTask = {
        id: taskId,
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
        completed: false,
        completedAt: undefined,
        createdAt: now,
        updatedAt: now,
      };

      // Save to in-memory store
      scheduledTasksStore.push(scheduledTask);
      console.log('[Backend] Scheduled task added to memory store');

      // Save to Supabase
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);

          const { data, error } = await supabase
            .from('scheduled_tasks')
            .insert({
              id: taskId,
              project_id: input.projectId,
              category: input.category,
              start_date: input.startDate,
              end_date: input.endDate,
              duration: input.duration,
              work_type: input.workType,
              notes: input.notes,
              color: input.color,
              row: input.row || 0,
              row_span: input.rowSpan || 1,
              completed: false,
            })
            .select()
            .single();

          if (error) {
            console.error('[Backend] Supabase error inserting scheduled task:', error);
          } else {
            console.log('[Backend] Scheduled task saved to Supabase:', data);

            // Update the return value with database timestamps
            scheduledTask.createdAt = data.created_at;
            scheduledTask.updatedAt = data.updated_at;
          }
        } catch (error) {
          console.error('[Backend] Error saving to Supabase:', error);
        }
      } else {
        console.warn('[Backend] Supabase not configured - saved to memory store only');
      }

      console.log('[Backend] Scheduled task created:', scheduledTask);
      console.log('[Backend] Total scheduled tasks in store:', scheduledTasksStore.length);

      return { success: true, scheduledTask };
    } catch (error) {
      console.error('[Backend] Error adding scheduled task:', error);
      throw new Error('Failed to add scheduled task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });
