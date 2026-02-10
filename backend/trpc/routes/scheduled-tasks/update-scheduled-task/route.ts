import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { scheduledTasksStore } from '../get-scheduled-tasks/route.js';
import { createClient } from '@supabase/supabase-js';

export const updateScheduledTaskProcedure = publicProcedure
  .input(
    z.object({
      id: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      duration: z.number().optional(),
      workType: z.enum(['in-house', 'subcontractor']).optional(),
      notes: z.string().optional(),
      row: z.number().optional(),
      rowSpan: z.number().optional(),
      completed: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Backend] Updating scheduled task:', input.id);

    // Update in-memory store
    const task = scheduledTasksStore.find(t => t.id === input.id);
    if (task) {
      if (input.startDate !== undefined) task.startDate = input.startDate;
      if (input.endDate !== undefined) task.endDate = input.endDate;
      if (input.duration !== undefined) task.duration = input.duration;
      if (input.workType !== undefined) task.workType = input.workType;
      if (input.notes !== undefined) task.notes = input.notes;
      if (input.row !== undefined) task.row = input.row;
      if (input.rowSpan !== undefined) task.rowSpan = input.rowSpan;
      if (input.completed !== undefined) task.completed = input.completed;
      console.log('[Backend] Updated scheduled task in memory store');
    }

    // Update in Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const updateData: any = {};
        if (input.startDate !== undefined) updateData.start_date = input.startDate;
        if (input.endDate !== undefined) updateData.end_date = input.endDate;
        if (input.duration !== undefined) updateData.duration = input.duration;
        if (input.workType !== undefined) updateData.work_type = input.workType;
        if (input.notes !== undefined) updateData.notes = input.notes;
        if (input.row !== undefined) updateData.row = input.row;
        if (input.rowSpan !== undefined) updateData.row_span = input.rowSpan;
        if (input.completed !== undefined) updateData.completed = input.completed;

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .update(updateData)
          .eq('id', input.id)
          .select()
          .single();

        if (error) {
          console.error('[Backend] Supabase error updating scheduled task:', error);
          throw new Error(`Failed to update in database: ${error.message}`);
        }

        console.log('[Backend] Scheduled task updated in Supabase:', data);

        // Convert snake_case to camelCase for return
        const updatedTask = {
          id: data.id,
          projectId: data.project_id,
          category: data.category,
          startDate: data.start_date,
          endDate: data.end_date,
          duration: data.duration,
          workType: data.work_type,
          notes: data.notes,
          color: data.color,
          row: data.row,
          rowSpan: data.row_span,
          completed: data.completed,
          completedAt: data.completed_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };

        return { success: true, scheduledTask: updatedTask };
      } catch (error) {
        console.error('[Backend] Error updating in Supabase:', error);
        throw error;
      }
    }

    console.warn('[Backend] Supabase not configured - updated memory store only');
    return { success: true, scheduledTask: task };
  });
