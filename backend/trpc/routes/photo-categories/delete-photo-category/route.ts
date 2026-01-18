import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const deletePhotoCategoryProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Photo Categories] Deleting category:', input.name, 'for company:', input.companyId);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Photo Categories] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Delete category from photo_categories table
      const { error } = await supabase
        .from('photo_categories')
        .delete()
        .eq('company_id', input.companyId)
        .ilike('name', input.name);

      if (error) {
        console.error('[Photo Categories] Error deleting category:', error);
        throw new Error(`Failed to delete photo category: ${error.message}`);
      }

      console.log('[Photo Categories] Successfully deleted category:', input.name);
      console.log('[Photo Categories] Note: Photos with this category will keep their current category value');

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[Photo Categories] Unexpected error deleting category:', error);
      throw new Error(error.message || 'Failed to delete photo category');
    }
  });
