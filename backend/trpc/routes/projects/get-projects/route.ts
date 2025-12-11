import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const getProjectsProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      status: z.enum(['active', 'completed', 'on-hold', 'archived']).optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Projects] Fetching projects for company:', input.companyId);

    try {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('company_id', input.companyId);

      if (input.status) {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[Projects] Error fetching projects:', error);
        throw new Error(`Failed to fetch projects: ${error.message}`);
      }

      console.log('[Projects] Found', data?.length || 0, 'projects');

      const projects = (data || []).map((project: any) => ({
        id: project.id,
        name: project.name,
        budget: Number(project.budget) || 0,
        expenses: Number(project.expenses) || 0,
        progress: project.progress || 0,
        status: project.status as 'active' | 'completed' | 'on-hold' | 'archived',
        image: project.image || '',
        hoursWorked: Number(project.hours_worked) || 0,
        startDate: project.start_date,
        endDate: project.end_date || undefined,
      }));

      return {
        success: true,
        projects,
      };
    } catch (error: any) {
      console.error('[Projects] Unexpected error fetching projects:', error);
      throw new Error(error.message || 'Failed to fetch projects');
    }
  });
