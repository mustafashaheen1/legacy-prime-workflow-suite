import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const loginProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Auth] Login attempt:', input.email);

    const usersData = await AsyncStorage.getItem('system:users');
    const companiesData = await AsyncStorage.getItem('system:companies');

    const users = usersData ? JSON.parse(usersData) : [];
    const companies = companiesData ? JSON.parse(companiesData) : [];

    const user = users.find((u: any) => u.email === input.email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const company = companies.find((c: any) => c.id === user.companyId);

    if (!company) {
      throw new Error('Company not found');
    }

    if (company.subscriptionStatus === 'suspended' || company.subscriptionStatus === 'cancelled') {
      throw new Error('Your company subscription is not active. Please contact support.');
    }

    if (!user.isActive) {
      throw new Error('Your account has been deactivated. Please contact your admin.');
    }

    console.log('[Auth] Login successful:', user.email, 'Role:', user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        avatar: user.avatar,
        createdAt: user.createdAt,
        isActive: user.isActive,
      },
      company,
    };
  });
