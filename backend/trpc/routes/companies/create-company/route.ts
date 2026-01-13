import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

// Generate a unique company code
function generateCompanyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const createCompanyProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(1),
      logo: z.string().optional(),
      brandColor: z.string().default('#2563EB'),
      licenseNumber: z.string().optional(),
      officePhone: z.string().optional(),
      cellPhone: z.string().optional(),
      address: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      slogan: z.string().optional(),
      subscriptionPlan: z.enum(['basic', 'pro', 'enterprise']).default('basic'),
      subscriptionStatus: z.enum(['trial', 'active', 'suspended', 'cancelled']).default('active'),
      settings: z.object({
        features: z.object({
          crm: z.boolean(),
          estimates: z.boolean(),
          schedule: z.boolean(),
          expenses: z.boolean(),
          photos: z.boolean(),
          chat: z.boolean(),
          reports: z.boolean(),
          clock: z.boolean(),
          dashboard: z.boolean(),
        }),
        maxUsers: z.number(),
        maxProjects: z.number(),
      }),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Companies] Creating new company:', input.name);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const subscriptionStartDate = new Date().toISOString();
    const subscriptionEndDate = input.subscriptionStatus === 'trial'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Insert company into database
    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: input.name,
        logo: input.logo || null,
        brand_color: input.brandColor,
        license_number: input.licenseNumber || null,
        office_phone: input.officePhone || null,
        cell_phone: input.cellPhone || null,
        address: input.address || null,
        email: input.email || null,
        website: input.website || null,
        slogan: input.slogan || null,
        subscription_status: input.subscriptionStatus,
        subscription_plan: input.subscriptionPlan,
        subscription_start_date: subscriptionStartDate,
        subscription_end_date: subscriptionEndDate,
        company_code: generateCompanyCode(),
        settings: input.settings,
      })
      .select()
      .single();

    if (error) {
      console.error('[Companies] Database error:', error);
      throw new Error(`Failed to create company: ${error.message}`);
    }

    console.log('[Companies] Company created successfully in database:', data.id);

    // Convert snake_case to camelCase for response
    const company = {
      id: data.id,
      name: data.name,
      logo: data.logo || undefined,
      brandColor: data.brand_color,
      licenseNumber: data.license_number || undefined,
      officePhone: data.office_phone || undefined,
      cellPhone: data.cell_phone || undefined,
      address: data.address || undefined,
      email: data.email || undefined,
      website: data.website || undefined,
      slogan: data.slogan || undefined,
      subscriptionStatus: data.subscription_status,
      subscriptionPlan: data.subscription_plan,
      subscriptionStartDate: data.subscription_start_date,
      subscriptionEndDate: data.subscription_end_date || undefined,
      companyCode: data.company_code || undefined,
      settings: data.settings,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return { company };
  });
