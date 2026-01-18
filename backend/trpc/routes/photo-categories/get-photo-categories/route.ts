import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getPhotoCategoriesProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Photo Categories] Fetching categories for company:', input.companyId);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Photo Categories] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const { data, error } = await supabase
        .from('photo_categories')
        .select('name')
        .eq('company_id', input.companyId)
        .order('name', { ascending: true });

      if (error) {
        console.error('[Photo Categories] Error fetching categories:', error);
        throw new Error(`Failed to fetch photo categories: ${error.message}`);
      }

      console.log('[Photo Categories] Found', data?.length || 0, 'categories');

      // Return array of category names
      const categories = (data || []).map((cat: any) => cat.name);

      return {
        success: true,
        categories,
      };
    } catch (error: any) {
      console.error('[Photo Categories] Unexpected error fetching categories:', error);
      throw new Error(error.message || 'Failed to fetch photo categories');
    }
  });
