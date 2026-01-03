import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const updateClientProcedure = publicProcedure
  .input(
    z.object({
      clientId: z.string().uuid(),
      updates: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        source: z.enum(['Google', 'Referral', 'Ad', 'Phone Call']).optional(),
        status: z.enum(['Lead', 'Project', 'Completed']).optional(),
        lastContacted: z.string().optional(),
        lastContactDate: z.string().optional(),
        nextFollowUpDate: z.string().optional(),
      }),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[CRM] Updating client:', input.clientId, 'with updates:', input.updates);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[CRM] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Convert camelCase to snake_case for database
      const dbUpdates: any = {};

      if (input.updates.name !== undefined) dbUpdates.name = input.updates.name;
      if (input.updates.address !== undefined) dbUpdates.address = input.updates.address;
      if (input.updates.email !== undefined) dbUpdates.email = input.updates.email;
      if (input.updates.phone !== undefined) dbUpdates.phone = input.updates.phone;
      if (input.updates.source !== undefined) dbUpdates.source = input.updates.source;
      if (input.updates.status !== undefined) dbUpdates.status = input.updates.status;
      if (input.updates.lastContacted !== undefined) dbUpdates.last_contacted = input.updates.lastContacted;
      if (input.updates.lastContactDate !== undefined) dbUpdates.last_contact_date = input.updates.lastContactDate;
      if (input.updates.nextFollowUpDate !== undefined) dbUpdates.next_follow_up_date = input.updates.nextFollowUpDate;

      const { data, error } = await supabase
        .from('clients')
        .update(dbUpdates)
        .eq('id', input.clientId)
        .select()
        .single();

      if (error) {
        console.error('[CRM] Error updating client:', error);
        throw new Error(`Failed to update client: ${error.message}`);
      }

      console.log('[CRM] Client updated successfully');

      // Convert response back to camelCase
      const updatedClient = {
        id: data.id,
        name: data.name,
        address: data.address || undefined,
        email: data.email,
        phone: data.phone,
        source: data.source,
        status: data.status,
        lastContacted: data.last_contacted || undefined,
        lastContactDate: data.last_contact_date || undefined,
        nextFollowUpDate: data.next_follow_up_date || undefined,
        createdAt: data.created_at,
      };

      return {
        success: true,
        client: updatedClient,
      };
    } catch (error: any) {
      console.error('[CRM] Unexpected error updating client:', error);
      throw new Error(error.message || 'Failed to update client');
    }
  });
