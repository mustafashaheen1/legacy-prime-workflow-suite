import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const updateCompanyProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string(),
      updates: z.object({
        name: z.string().optional(),
        logo: z.string().optional(),
        brandColor: z.string().optional(),
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

    const companiesData = await AsyncStorage.getItem('system:companies');
    const companies = companiesData ? JSON.parse(companiesData) : [];

    const companyIndex = companies.findIndex((c: any) => c.id === input.companyId);
    if (companyIndex === -1) {
      throw new Error('Company not found');
    }

    const updatedCompany = {
      ...companies[companyIndex],
      ...input.updates,
      updatedAt: new Date().toISOString(),
    };

    if (input.updates.settings) {
      updatedCompany.settings = {
        ...companies[companyIndex].settings,
        ...input.updates.settings,
      };
      if (input.updates.settings.features) {
        updatedCompany.settings.features = {
          ...companies[companyIndex].settings.features,
          ...input.updates.settings.features,
        };
      }
    }

    companies[companyIndex] = updatedCompany;
    await AsyncStorage.setItem('system:companies', JSON.stringify(companies));

    console.log('[Companies] Company updated successfully');

    return { company: updatedCompany };
  });
