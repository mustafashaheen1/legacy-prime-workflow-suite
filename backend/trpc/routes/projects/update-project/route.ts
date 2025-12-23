import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const updateProjectProcedure = publicProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      budget: z.number().optional(),
      expenses: z.number().optional(),
      progress: z.number().min(0).max(100).optional(),
      status: z.enum(['active', 'completed', 'on-hold', 'archived']).optional(),
      image: z.string().optional(),
      hoursWorked: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Projects] Updating project:', input.id);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Projects] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.budget !== undefined) updateData.budget = input.budget;
      if (input.expenses !== undefined) updateData.expenses = input.expenses;
      if (input.progress !== undefined) updateData.progress = input.progress;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.image !== undefined) updateData.image = input.image;
      if (input.hoursWorked !== undefined) updateData.hours_worked = input.hoursWorked;
      if (input.startDate !== undefined) updateData.start_date = input.startDate;
      if (input.endDate !== undefined) updateData.end_date = input.endDate;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        console.error('[Projects] Error updating project:', error);
        throw new Error(`Failed to update project: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from update');
      }

      console.log('[Projects] Project updated successfully:', data.id);

      return {
        success: true,
        project: {
          id: data.id,
          name: data.name,
          budget: Number(data.budget) || 0,
          expenses: Number(data.expenses) || 0,
          progress: data.progress || 0,
          status: data.status as 'active' | 'completed' | 'on-hold' | 'archived',
          image: data.image || '',
          hoursWorked: Number(data.hours_worked) || 0,
          startDate: data.start_date,
          endDate: data.end_date || undefined,
        },
      };
    } catch (error: any) {
      console.error('[Projects] Unexpected error updating project:', error);
      throw new Error(error.message || 'Failed to update project');
    }
  });
