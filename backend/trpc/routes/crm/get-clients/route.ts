import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getClientsProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
    })
  )
  .query(async ({ input }) => {
    console.log('[CRM] Fetching clients for company:', input.companyId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[CRM] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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
