import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const updateCompanyProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string(),
      updates: z.object({
        name: z.string().optional(),
        logo: z.string().optional(),
        brandColor: z.string().optional(),
        licenseNumber: z.string().optional(),
        officePhone: z.string().optional(),
        cellPhone: z.string().optional(),
        address: z.string().optional(),
        email: z.string().optional(),
        website: z.string().optional(),
        slogan: z.string().optional(),
        estimateTemplate: z.string().optional(),
        subscriptionStatus: z.enum(['trial', 'active', 'suspended', 'cancelled']).optional(),
        subscriptionPlan: z.enum(['basic', 'pro', 'enterprise']).optional(),
        subscriptionEndDate: z.string().optional(),
        settings: z.object({
          features: z.object({
            crm: z.boolean().optional(),
            estimates: z.boolean().optional(),
            schedule: z.boolean().optional(),
            expenses: z.boolean().optional(),
            photos: z.boolean().optional(),
            chat: z.boolean().optional(),
            reports: z.boolean().optional(),
            clock: z.boolean().optional(),
            dashboard: z.boolean().optional(),
          }).optional(),
          maxUsers: z.number().optional(),
          maxProjects: z.number().optional(),
        }).optional(),
      }),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Companies] Updating company:', input.companyId);

    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // First, get the existing company
    const { data: existingCompanies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', input.companyId);

    if (fetchError) {
      throw new Error(`Failed to fetch company: ${fetchError.message}`);
    }

    if (!existingCompanies || existingCompanies.length === 0) {
      throw new Error('Company not found');
    }

    const existingCompany = existingCompanies[0];

    // Prepare the updated data
    const updatedData: any = {
      ...input.updates,
      updatedAt: new Date().toISOString(),
    };

    // Handle nested settings merging
    if (input.updates.settings) {
      updatedData.settings = {
        ...existingCompany.settings,
        ...input.updates.settings,
      };
      if (input.updates.settings.features) {
        updatedData.settings.features = {
          ...existingCompany.settings?.features,
          ...input.updates.settings.features,
        };
      }
    }

    // Update the company in Supabase
    const { data: updatedCompanies, error: updateError } = await supabase
      .from('companies')
      .update(updatedData)
      .eq('id', input.companyId)
      .select();

    if (updateError) {
      throw new Error(`Failed to update company: ${updateError.message}`);
    }

    console.log('[Companies] Company updated successfully');

    return { company: updatedCompanies[0] };
  });
