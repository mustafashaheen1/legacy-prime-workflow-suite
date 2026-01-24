import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { scheduledTasksStore } from '../get-scheduled-tasks/route.js';

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

      // Save to in-memory store
      scheduledTasksStore.push(scheduledTask);
      console.log('[Backend] Scheduled task added to memory store');
      console.log('[Backend] Scheduled task created:', scheduledTask);
      console.log('[Backend] Total scheduled tasks in store:', scheduledTasksStore.length);

      // TODO: Add Supabase persistence later - for now just use in-memory
      // The in-memory store works within a single serverless function instance

      return { success: true, scheduledTask };
    } catch (error) {
      console.error('[Backend] Error adding scheduled task:', error);
      throw new Error('Failed to add scheduled task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });
