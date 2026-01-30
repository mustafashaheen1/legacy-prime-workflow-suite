import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const updatePriceListItemProcedure = publicProcedure
  .input(
    z.object({
      itemId: z.string().uuid(),
      companyId: z.string().uuid(),
      category: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      unit: z.string().min(1).optional(),
      unitPrice: z.number().optional(),
      laborCost: z.number().optional(),
      materialCost: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Price List] Updating price list item:', input.itemId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Price List] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // First, check if the item exists and belongs to this company
      const { data: existingItem, error: fetchError } = await supabase
        .from('price_list_items')
        .select('*')
        .eq('id', input.itemId)
        .single();

      if (fetchError || !existingItem) {
        console.error('[Price List] Item not found:', input.itemId);
        throw new Error('Price list item not found');
      }

      // Only allow updating custom items that belong to this company
      if (!existingItem.is_custom || existingItem.company_id !== input.companyId) {
        console.error('[Price List] Cannot update master item or item from another company');
        throw new Error('You can only update your own custom items');
      }

      // Build update object with only provided fields
      const updateData: any = {};
      if (input.category !== undefined) updateData.category = input.category;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.unit !== undefined) updateData.unit = input.unit;
      if (input.unitPrice !== undefined) updateData.unit_price = input.unitPrice;
      if (input.laborCost !== undefined) updateData.labor_cost = input.laborCost;
      if (input.materialCost !== undefined) updateData.material_cost = input.materialCost;

      // Update the item
      const { data, error } = await supabase
        .from('price_list_items')
        .update(updateData)
        .eq('id', input.itemId)
        .select()
        .single();

      if (error) {
        console.error('[Price List] Error updating price list item:', error);
        throw new Error(`Failed to update price list item: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from update');
      }

      console.log('[Price List] Price list item updated successfully:', data.id);

      // Convert database response back to camelCase
      return {
        success: true,
        item: {
          id: data.id,
          category: data.category,
          name: data.name,
          description: data.description || '',
          unit: data.unit,
          unitPrice: Number(data.unit_price),
          laborCost: data.labor_cost ? Number(data.labor_cost) : undefined,
          materialCost: data.material_cost ? Number(data.material_cost) : undefined,
          isCustom: data.is_custom || false,
          createdAt: data.created_at,
        },
      };
    } catch (error: any) {
      console.error('[Price List] Unexpected error updating price list item:', error);
      throw new Error(error.message || 'Failed to update price list item');
    }
  });
