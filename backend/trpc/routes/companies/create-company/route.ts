import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

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

    const newCompany = {
      id: `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      logo: input.logo,
      brandColor: input.brandColor,
      licenseNumber: input.licenseNumber,
      officePhone: input.officePhone,
      cellPhone: input.cellPhone,
      address: input.address,
      email: input.email,
      website: input.website,
      slogan: input.slogan,
      subscriptionStatus: input.subscriptionStatus,
      subscriptionPlan: input.subscriptionPlan,
      subscriptionStartDate: new Date().toISOString(),
      subscriptionEndDate: input.subscriptionStatus === 'trial' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      settings: input.settings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[Companies] Company created successfully:', newCompany.id);

    return { company: newCompany };
  });
