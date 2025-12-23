import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const addProjectProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1),
      budget: z.number().default(0),
      expenses: z.number().default(0),
      progress: z.number().min(0).max(100).default(0),
      status: z.enum(['active', 'completed', 'on-hold', 'archived']).default('active'),
      image: z.string().optional(),
      hoursWorked: z.number().default(0),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Projects] Adding project:', input.name, 'for company:', input.companyId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Projects] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          company_id: input.companyId,
          name: input.name,
          budget: input.budget,
          expenses: input.expenses,
          progress: input.progress,
          status: input.status,
          image: input.image,
          hours_worked: input.hoursWorked,
          start_date: input.startDate,
          end_date: input.endDate,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Projects] Error adding project:', error);
        throw new Error(`Failed to add project: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Projects] Project added successfully:', data.id);

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
      console.error('[Projects] Unexpected error adding project:', error);
      throw new Error(error.message || 'Failed to add project');
    }
  });
