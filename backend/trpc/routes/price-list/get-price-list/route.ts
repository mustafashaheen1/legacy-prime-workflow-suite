import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const getPriceListProcedure = publicProcedure
  .input(
    z.object({
      category: z.string().optional(),
      companyId: z.string().uuid().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[Price List] Fetching price list items');

    try {
      let query = supabase
        .from('price_list_items')
        .select('*');

      // Filter by category if provided
      if (input?.category) {
        query = query.eq('category', input.category);
      }

      // Include company-specific items if companyId provided
      if (input?.companyId) {
        query = query.or(`company_id.is.null,company_id.eq.${input.companyId}`);
      } else {
        // Only return master items (no company-specific items)
        query = query.is('company_id', null);
      }

      // Order by category and name
      query = query.order('category').order('name');

      const { data, error } = await query;

      if (error) {
        console.error('[Price List] Error fetching price list:', error);
        throw new Error(`Failed to fetch price list: ${error.message}`);
      }

      if (!data) {
        return { success: true, items: [] };
      }

      console.log(`[Price List] Found ${data.length} items`);

      // Transform to frontend format
      const items = data.map(item => ({
        id: item.id,
        category: item.category,
        name: item.name,
        description: item.description || '',
        unit: item.unit,
        unitPrice: Number(item.unit_price),
        laborCost: item.labor_cost ? Number(item.labor_cost) : undefined,
        materialCost: item.material_cost ? Number(item.material_cost) : undefined,
        isCustom: item.is_custom || false,
      }));

      return {
        success: true,
        items,
      };
    } catch (error: any) {
      console.error('[Price List] Unexpected error:', error);
      throw new Error(error.message || 'Failed to fetch price list');
    }
  });
