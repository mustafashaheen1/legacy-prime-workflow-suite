import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const updatePhotoCategoryProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      oldName: z.string().min(1),
      newName: z.string().min(1, 'Category name is required'),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Photo Categories] Updating category from:', input.oldName, 'to:', input.newName);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Photo Categories] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Check if new name already exists (case-insensitive, excluding current category)
      const { data: existing } = await supabase
        .from('photo_categories')
        .select('id, name')
        .eq('company_id', input.companyId)
        .ilike('name', input.newName)
        .single();

      if (existing && existing.name.toLowerCase() !== input.oldName.toLowerCase()) {
        throw new Error('A category with this name already exists');
      }

      // Find the category to update
      const { data: categoryToUpdate } = await supabase
        .from('photo_categories')
        .select('id')
        .eq('company_id', input.companyId)
        .ilike('name', input.oldName)
        .single();

      if (!categoryToUpdate) {
        throw new Error('Category not found');
      }

      // Update category name in photo_categories table
      const { error: updateCategoryError } = await supabase
        .from('photo_categories')
        .update({
          name: input.newName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryToUpdate.id);

      if (updateCategoryError) {
        console.error('[Photo Categories] Error updating category:', updateCategoryError);
        throw new Error(`Failed to update category: ${updateCategoryError.message}`);
      }

      // Update all photos with old category name to new name
      const { error: updatePhotosError } = await supabase
        .from('photos')
        .update({ category: input.newName })
        .eq('company_id', input.companyId)
        .eq('category', input.oldName);

      if (updatePhotosError) {
        console.error('[Photo Categories] Error updating photos:', updatePhotosError);
        // Don't throw - category was already updated
        console.log('[Photo Categories] Category updated but some photos may not have been updated');
      }

      console.log('[Photo Categories] Successfully updated category:', input.oldName, '->', input.newName);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[Photo Categories] Unexpected error updating category:', error);
      throw new Error(error.message || 'Failed to update photo category');
    }
  });
