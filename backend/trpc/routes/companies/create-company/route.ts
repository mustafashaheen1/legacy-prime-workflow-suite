import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const createCompanyProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(1),
      logo: z.string().optional(),
      brandColor: z.string().default('#2563EB'),
      subscriptionPlan: z.enum(['basic', 'pro', 'enterprise']).default('basic'),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Companies] Creating new company:', input.name);

    const companiesData = await AsyncStorage.getItem('system:companies');
    const companies = companiesData ? JSON.parse(companiesData) : [];

    const maxUsers = input.subscriptionPlan === 'basic' ? 5 : input.subscriptionPlan === 'pro' ? 20 : 100;
    const maxProjects = input.subscriptionPlan === 'basic' ? 10 : input.subscriptionPlan === 'pro' ? 50 : 500;

    const newCompany = {
      id: `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      logo: input.logo,
      brandColor: input.brandColor,
      subscriptionStatus: 'trial' as const,
      subscriptionPlan: input.subscriptionPlan,
      subscriptionStartDate: new Date().toISOString(),
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      settings: {
        features: {
          crm: true,
          estimates: true,
          schedule: true,
          expenses: true,
          photos: true,
          chat: true,
          reports: input.subscriptionPlan !== 'basic',
          clock: true,
          dashboard: true,
        },
        maxUsers,
        maxProjects,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    companies.push(newCompany);
    await AsyncStorage.setItem('system:companies', JSON.stringify(companies));

    console.log('[Companies] Company created successfully:', newCompany.id);

    return { company: newCompany };
  });
