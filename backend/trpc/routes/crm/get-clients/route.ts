import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const getClientsProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
    })
  )
  .query(async ({ input }) => {
    console.log('[CRM] Fetching clients for company:', input.companyId);

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', input.companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CRM] Error fetching clients:', error);
        throw new Error(`Failed to fetch clients: ${error.message}`);
      }

      console.log('[CRM] Found', data?.length || 0, 'clients');

      // Convert database response to camelCase
      const clients = (data || []).map((client: any) => ({
        id: client.id,
        name: client.name,
        address: client.address || undefined,
        email: client.email,
        phone: client.phone,
        source: client.source as 'Google' | 'Referral' | 'Ad' | 'Phone Call',
        status: client.status as 'Lead' | 'Project' | 'Completed',
        lastContacted: client.last_contacted || undefined,
        lastContactDate: client.last_contact_date || undefined,
        nextFollowUpDate: client.next_follow_up_date || undefined,
        createdAt: client.created_at,
      }));

      return {
        success: true,
        clients,
      };
    } catch (error: any) {
      console.error('[CRM] Unexpected error fetching clients:', error);
      throw new Error(error.message || 'Failed to fetch clients');
    }
  });
