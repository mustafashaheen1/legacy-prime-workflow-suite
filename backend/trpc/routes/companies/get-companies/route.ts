import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side use
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const getCompaniesProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[Companies] Fetching companies');

    try {
      // Check if Supabase is configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[Companies] Supabase not configured, returning empty array');
        return { companies: [] };
      }

      let query = supabase
        .from('companies')
        .select('*');

      if (input?.companyId) {
        query = query.eq('id', input.companyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[Companies] Error fetching companies:', error);
        // Return empty array instead of throwing - allows app to work even if DB is not set up
        return { companies: [] };
      }

      // Transform database response to camelCase
      const companies = (data || []).map((company: any) => ({
        id: company.id,
        name: company.name,
        logo: company.logo || undefined,
        brandColor: company.brand_color,
        licenseNumber: company.license_number || undefined,
        officePhone: company.office_phone || undefined,
        cellPhone: company.cell_phone || undefined,
        address: company.address || undefined,
        email: company.email || undefined,
        website: company.website || undefined,
        slogan: company.slogan || undefined,
        estimateTemplate: company.estimate_template || undefined,
        subscriptionStatus: company.subscription_status,
        subscriptionPlan: company.subscription_plan,
        subscriptionStartDate: company.subscription_start_date,
        subscriptionEndDate: company.subscription_end_date || undefined,
        employeeCount: company.employee_count || undefined,
        companyCode: company.company_code || undefined,
        stripeCustomerId: company.stripe_customer_id || undefined,
        stripeSubscriptionId: company.stripe_subscription_id || undefined,
        settings: company.settings,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      }));

      console.log('[Companies] Found', companies.length, 'companies');

      return { companies };
    } catch (error: any) {
      console.error('[Companies] Unexpected error:', error);
      // Return empty array to prevent app crash
      return { companies: [] };
    }
  });
