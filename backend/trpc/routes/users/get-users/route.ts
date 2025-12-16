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
      query = query.eq('companyId', input.companyId);
    }

    const { data: users, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return { users: users || [] };
  });
