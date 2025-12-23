import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const clockOutProcedure = publicProcedure
  .input(
    z.object({
      entryId: z.string().uuid(),
      workPerformed: z.string().optional(),
      lunchBreaks: z.array(z.object({
        start: z.string(),
        end: z.string(),
      })).optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Clock] Clocking out entry:', input.entryId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Clock] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const updateData: any = {
        clock_out: new Date().toISOString(),
      };

      if (input.workPerformed) {
        updateData.work_performed = input.workPerformed;
      }

      if (input.lunchBreaks) {
        updateData.lunch_breaks = input.lunchBreaks;
      }

      const { data, error } = await supabase
        .from('clock_entries')
        .update(updateData)
        .eq('id', input.entryId)
        .select()
        .single();

      if (error) {
        console.error('[Clock] Error clocking out:', error);
        throw new Error(`Failed to clock out: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from update');
      }

      console.log('[Clock] Clocked out successfully:', data.id);

      return {
        success: true,
        clockEntry: {
          id: data.id,
          employeeId: data.employee_id,
          projectId: data.project_id,
          clockIn: data.clock_in,
          clockOut: data.clock_out,
          location: data.location,
          workPerformed: data.work_performed || undefined,
          category: data.category || undefined,
          lunchBreaks: data.lunch_breaks || undefined,
        },
      };
    } catch (error: any) {
      console.error('[Clock] Unexpected error clocking out:', error);
      throw new Error(error.message || 'Failed to clock out');
    }
  });
