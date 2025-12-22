import { publicProcedure } from "../../../create-context.js";
import { supabase } from "../../../../lib/supabase.js";

export const getCategoriesProcedure = publicProcedure
  .query(async () => {
    console.log('[Price List] Fetching categories');

    try {
      const { data, error } = await supabase
        .from('price_list_categories')
        .select('*')
        .order('sort_order');

      if (error) {
        console.error('[Price List] Error fetching categories:', error);
        throw new Error(`Failed to fetch categories: ${error.message}`);
      }

      if (!data) {
        return { success: true, categories: [] };
      }

      console.log(`[Price List] Found ${data.length} categories`);

      return {
        success: true,
        categories: data.map(cat => cat.name),
      };
    } catch (error: any) {
      console.error('[Price List] Unexpected error:', error);
      throw new Error(error.message || 'Failed to fetch categories');
    }
  });
