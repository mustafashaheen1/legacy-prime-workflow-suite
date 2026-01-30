import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const addPriceListItemProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      category: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      unit: z.string().min(1),
      unitPrice: z.number(),
      laborCost: z.number().optional(),
      materialCost: z.number().optional(),
      isCustom: z.boolean().default(true),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Price List] Adding custom price list item:', input.name, 'for company:', input.companyId);

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
      // Generate UUID for the item
      const itemId = randomUUID();
      const now = new Date().toISOString();

      console.log('[Price List] Starting insert for:', itemId);

      // Insert without selecting back (faster, one query instead of two)
      const insertPromise = supabase
        .from('price_list_items')
        .insert({
          id: itemId,
          company_id: input.companyId,
          category: input.category,
          name: input.name,
          description: input.description || null,
          unit: input.unit,
          unit_price: input.unitPrice,
          labor_cost: input.laborCost || null,
          material_cost: input.materialCost || null,
          is_custom: input.isCustom,
          created_at: now,
        } as any);

      // Add a 5-second timeout to fail fast
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          console.error('[Price List] Database operation timed out after 5s');
          reject(new Error('Database operation timeout'));
        }, 5000)
      );

      const { error } = await Promise.race([
        insertPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('[Price List] Error adding price list item:', error);
        throw new Error(`Failed to add price list item: ${error.message}`);
      }

      console.log('[Price List] Price list item added successfully:', itemId);

      // Return the data we already have (no need to query back)
      return {
        success: true,
        item: {
          id: itemId,
          category: input.category,
          name: input.name,
          description: input.description || '',
          unit: input.unit,
          unitPrice: input.unitPrice,
          laborCost: input.laborCost,
          materialCost: input.materialCost,
          isCustom: input.isCustom,
          createdAt: now,
        },
      };
    } catch (error: any) {
      console.error('[Price List] Unexpected error adding price list item:', error);
      throw new Error(error.message || 'Failed to add price list item');
    }
  });
