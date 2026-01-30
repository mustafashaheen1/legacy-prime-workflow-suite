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

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-timeout': '5000',
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      console.log('[Price List] Updating item:', input.itemId);

      // Build update object with only provided fields
      const updateData: any = {};
      if (input.category !== undefined) updateData.category = input.category;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.unit !== undefined) updateData.unit = input.unit;
      if (input.unitPrice !== undefined) updateData.unit_price = input.unitPrice;
      if (input.laborCost !== undefined) updateData.labor_cost = input.laborCost;
      if (input.materialCost !== undefined) updateData.material_cost = input.materialCost;

      // Update the item with timeout (only update if custom item and belongs to company)
      const updatePromise = supabase
        .from('price_list_items')
        .update(updateData)
        .eq('id', input.itemId)
        .eq('company_id', input.companyId)
        .eq('is_custom', true);

      // Add a 5-second timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          console.error('[Price List] Update timed out after 5s');
          reject(new Error('Database operation timeout'));
        }, 5000)
      );

      const { error } = await Promise.race([
        updatePromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('[Price List] Error updating price list item:', error);
        throw new Error(`Failed to update price list item: ${error.message}`);
      }

      console.log('[Price List] Price list item updated successfully:', input.itemId);

      // Return success (client already has the updated data locally)
      return {
        success: true,
        item: {
          id: input.itemId,
          category: input.category,
          name: input.name,
          description: input.description || '',
          unit: input.unit,
          unitPrice: input.unitPrice,
          laborCost: input.laborCost,
          materialCost: input.materialCost,
          isCustom: true,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[Price List] Unexpected error updating price list item:', error);
      throw new Error(error.message || 'Failed to update price list item');
    }
  });
