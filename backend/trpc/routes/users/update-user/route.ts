import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const updateUserProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      updates: z.object({
        name: z.string().optional(),
        role: z.enum(['super-admin', 'admin', 'salesperson', 'field-employee', 'employee']).optional(),
        isActive: z.boolean().optional(),
        avatar: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        hourlyRate: z.number().optional(),
      }),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Updating user:', input.userId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Users] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Convert camelCase to snake_case for database
      const dbUpdates: Record<string, any> = {};
      if (input.updates.name !== undefined) dbUpdates.name = input.updates.name;
      if (input.updates.role !== undefined) dbUpdates.role = input.updates.role;
      if (input.updates.isActive !== undefined) dbUpdates.is_active = input.updates.isActive;
      if (input.updates.avatar !== undefined) dbUpdates.avatar = input.updates.avatar;
      if (input.updates.phone !== undefined) dbUpdates.phone = input.updates.phone;
      if (input.updates.address !== undefined) dbUpdates.address = input.updates.address;
      if (input.updates.hourlyRate !== undefined) dbUpdates.hourly_rate = input.updates.hourlyRate;

      console.log('[Users] Executing database update with:', dbUpdates);
      const updateStartTime = Date.now();

      const { data, error } = await supabase
        .from('users')
        .update(dbUpdates)
        .eq('id', input.userId)
        .select()
        .single();

      const updateDuration = Date.now() - updateStartTime;
      console.log(`[Users] Database update completed in ${updateDuration}ms`);

      if (error) {
        console.error('[Users] Error updating user:', error);
        throw new Error(`Failed to update user: ${error.message}`);
      }

      if (!data) {
        throw new Error('User not found');
      }

      // Transform response to camelCase
      const user = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        companyId: data.company_id,
        avatar: data.avatar || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        hourlyRate: data.hourly_rate || undefined,
        isActive: data.is_active,
        createdAt: data.created_at,
      };

      console.log('[Users] User updated successfully');

      return { user };
    } catch (error: any) {
      console.error('[Users] Unexpected error:', error);
      throw new Error(error.message || 'Failed to update user');
    }
  });
