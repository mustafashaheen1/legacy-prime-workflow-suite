import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getPriceListProcedure = publicProcedure
  .input(
    z.object({
      category: z.string().optional(),
      companyId: z.string().uuid().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[Price List] Fetching price list items');

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Price List] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // First, get all categories with their sort_order
      const { data: categories, error: catError } = await supabase
        .from('price_list_categories')
        .select('name, sort_order');

      if (catError) {
        console.error('[Price List] Error fetching categories for ordering:', catError);
      }

      // Create a map of category name to sort_order
      const categorySortOrder = new Map<string, number>();
      if (categories) {
        categories.forEach(cat => {
          categorySortOrder.set(cat.name, cat.sort_order);
        });
      }

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

      // Sort by category sort_order, then by item name
      items.sort((a, b) => {
        const sortOrderA = categorySortOrder.get(a.category) ?? 999;
        const sortOrderB = categorySortOrder.get(b.category) ?? 999;

        if (sortOrderA !== sortOrderB) {
          return sortOrderA - sortOrderB;
        }

        // Same category, sort by name
        return a.name.localeCompare(b.name);
      });

      return {
        success: true,
        items,
      };
    } catch (error: any) {
      console.error('[Price List] Unexpected error:', error);
      throw new Error(error.message || 'Failed to fetch price list');
    }
  });
