import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getUsersProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Users] Fetching users for company:', input.companyId);

    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    let query = supabase.from('users').select('*');

    if (input.companyId) {
      query = query.eq('company_id', input.companyId);
    }

    const { data: users, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    // Transform database response to camelCase
    const transformedUsers = (users || []).map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      avatar: user.avatar || undefined,
      phone: user.phone || undefined,
      address: user.address || undefined,
      hourlyRate: user.hourly_rate || undefined,
      isActive: user.is_active,
      createdAt: user.created_at,
      rateChangeRequest: user.rate_change_request || undefined,
    }));

    return { users: transformedUsers };
  });
