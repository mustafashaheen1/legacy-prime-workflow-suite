import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const clockInProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      employeeId: z.string().uuid(),
      projectId: z.string().uuid(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        address: z.string().optional(),
      }),
      workPerformed: z.string().optional(),
      category: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Clock] Clocking in employee:', input.employeeId, 'for project:', input.projectId);

    try {
      const { data, error } = await supabase
        .from('clock_entries')
        .insert({
          company_id: input.companyId,
          employee_id: input.employeeId,
          project_id: input.projectId,
          clock_in: new Date().toISOString(),
          location: input.location,
          work_performed: input.workPerformed,
          category: input.category,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Clock] Error clocking in:', error);
        throw new Error(`Failed to clock in: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Clock] Clocked in successfully:', data.id);

      return {
        success: true,
        clockEntry: {
          id: data.id,
          employeeId: data.employee_id,
          projectId: data.project_id,
          clockIn: data.clock_in,
          clockOut: data.clock_out || undefined,
          location: data.location,
          workPerformed: data.work_performed || undefined,
          category: data.category || undefined,
        },
      };
    } catch (error: any) {
      console.error('[Clock] Unexpected error clocking in:', error);
      throw new Error(error.message || 'Failed to clock in');
    }
  });
