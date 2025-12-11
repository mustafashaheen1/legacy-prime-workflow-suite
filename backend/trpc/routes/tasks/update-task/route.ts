import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const updateTaskProcedure = publicProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      date: z.string().optional(),
      reminder: z.string().optional(),
      completed: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Tasks] Updating task:', input.id);

    try {
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.date !== undefined) updateData.date = input.date;
      if (input.reminder !== undefined) updateData.reminder = input.reminder;
      if (input.completed !== undefined) updateData.completed = input.completed;

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        console.error('[Tasks] Error updating task:', error);
        throw new Error(`Failed to update task: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from update');
      }

      console.log('[Tasks] Task updated successfully:', data.id);

      return {
        success: true,
        task: {
          id: data.id,
          projectId: data.project_id,
          name: data.name,
          date: data.date || undefined,
          reminder: data.reminder || undefined,
          completed: data.completed || false,
        },
      };
    } catch (error: any) {
      console.error('[Tasks] Unexpected error updating task:', error);
      throw new Error(error.message || 'Failed to update task');
    }
  });
