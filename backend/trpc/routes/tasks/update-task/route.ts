import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';
import { getActorName, notifyCompanyAdmins } from "../../../../lib/notifyAdmins.js";

export const updateTaskProcedure = publicProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      date: z.string().optional(),
      reminder: z.string().optional(),
      completed: z.boolean().optional(),
      companyId: z.string().uuid().optional(),
      completedBy: z.string().uuid().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Tasks] Updating task:', input.id);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Tasks] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

      // Notify admins when a task is marked complete — fire-and-forget
      if (input.completed === true && input.completedBy && input.companyId) {
        void (async () => {
          try {
            const name = await getActorName(supabase, input.completedBy!);
            await notifyCompanyAdmins(supabase, {
              companyId: input.companyId!,
              actorId: input.completedBy!,
              type: 'general',
              title: 'Task Completed',
              message: `${name} completed task: ${data.name}`,
              data: { taskId: data.id, projectId: data.project_id },
            });
          } catch (e) {
            console.warn('[Tasks] Admin notify failed (non-fatal):', e);
          }
        })();
      }

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
