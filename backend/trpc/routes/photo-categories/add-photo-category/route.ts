import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const addPhotoCategoryProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1, 'Category name is required'),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Photo Categories] Adding category:', input.name, 'for company:', input.companyId);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Photo Categories] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Check for duplicate (case-insensitive)
      const { data: existing } = await supabase
        .from('photo_categories')
        .select('id')
        .eq('company_id', input.companyId)
        .ilike('name', input.name)
        .single();

      if (existing) {
        throw new Error('A category with this name already exists');
      }

      // Insert new category
      const { data, error } = await supabase
        .from('photo_categories')
        .insert({
          company_id: input.companyId,
          name: input.name,
        })
        .select()
        .single();

      if (error) {
        console.error('[Photo Categories] Error adding category:', error);
        throw new Error(`Failed to add photo category: ${error.message}`);
      }

      console.log('[Photo Categories] Successfully added category:', input.name);

      return {
        success: true,
        category: {
          id: data.id,
          name: data.name,
        },
      };
    } catch (error: any) {
      console.error('[Photo Categories] Unexpected error adding category:', error);
      throw new Error(error.message || 'Failed to add photo category');
    }
  });
