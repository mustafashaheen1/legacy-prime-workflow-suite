import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const loginProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Auth] Login attempt:', input.email);

    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Fetch user by email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', input.email);

    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }

    if (!users || users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Fetch company by companyId
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', user.companyId);

    if (companyError) {
      throw new Error(`Failed to fetch company: ${companyError.message}`);
    }

    if (!companies || companies.length === 0) {
      throw new Error('Company not found');
    }

    const company = companies[0];

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
