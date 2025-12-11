import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const addPhotoProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid(),
      category: z.string().min(1),
      notes: z.string().optional(),
      url: z.string().min(1),
      date: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Photos] Adding photo for project:', input.projectId);

    try {
      const { data, error } = await supabase
        .from('photos')
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          category: input.category,
          notes: input.notes,
          url: input.url,
          date: input.date,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Photos] Error adding photo:', error);
        throw new Error(`Failed to add photo: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Photos] Photo added successfully:', data.id);

      return {
        success: true,
        photo: {
          id: data.id,
          projectId: data.project_id,
          category: data.category,
          notes: data.notes || undefined,
          url: data.url,
          date: data.date,
        },
      };
    } catch (error: any) {
      console.error('[Photos] Unexpected error adding photo:', error);
      throw new Error(error.message || 'Failed to add photo');
    }
  });
