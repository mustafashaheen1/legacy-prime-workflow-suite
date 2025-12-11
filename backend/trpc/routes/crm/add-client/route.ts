import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const addClientProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1),
      address: z.string().optional(),
      email: z.string().email(),
      phone: z.string().min(1),
      source: z.enum(['Google', 'Referral', 'Ad', 'Other']),
      status: z.enum(['Lead', 'Project', 'Completed']).default('Lead'),
      lastContacted: z.string().optional(),
      lastContactDate: z.string().optional(),
      nextFollowUpDate: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[CRM] Adding client:', input.name, 'for company:', input.companyId);

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          company_id: input.companyId,
          name: input.name,
          address: input.address,
          email: input.email,
          phone: input.phone,
          source: input.source,
          status: input.status,
          last_contacted: input.lastContacted,
          last_contact_date: input.lastContactDate,
          next_follow_up_date: input.nextFollowUpDate,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[CRM] Error adding client:', error);
        throw new Error(`Failed to add client: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[CRM] Client added successfully:', data.id);

      // Convert database response back to camelCase
      return {
        success: true,
        client: {
          id: data.id,
          name: data.name,
          address: data.address || undefined,
          email: data.email,
          phone: data.phone,
          source: data.source as 'Google' | 'Referral' | 'Ad' | 'Other',
          status: data.status as 'Lead' | 'Project' | 'Completed',
          lastContacted: data.last_contacted || undefined,
          lastContactDate: data.last_contact_date || undefined,
          nextFollowUpDate: data.next_follow_up_date || undefined,
          createdAt: data.created_at,
        },
      };
    } catch (error: any) {
      console.error('[CRM] Unexpected error adding client:', error);
      throw new Error(error.message || 'Failed to add client');
    }
  });
