import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const addTaskProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid(),
      name: z.string().min(1),
      date: z.string().optional(),
      reminder: z.string().optional(),
      completed: z.boolean().default(false),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Tasks] Adding task:', input.name, 'for project:', input.projectId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Tasks] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          name: input.name,
          date: input.date,
          reminder: input.reminder,
          completed: input.completed,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Tasks] Error adding task:', error);
        throw new Error(`Failed to add task: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Tasks] Task added successfully:', data.id);

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
      console.error('[Tasks] Unexpected error adding task:', error);
      throw new Error(error.message || 'Failed to add task');
    }
  });
