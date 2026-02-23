import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const createUserProcedure = publicProcedure
  .input(
    z.object({
      name:      z.string().min(1),
      email:     z.string().email(),
      password:  z.string().min(6),   // accepted for API compatibility; no password column in users table
      role:      z.enum(['admin', 'salesperson', 'field-employee', 'employee']),
      companyId: z.string().uuid(),
      avatar:    z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Creating new user:', input.email);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Users] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          name:       input.name,
          email:      input.email,
          role:       input.role,
          company_id: input.companyId,
          avatar:     input.avatar ?? null,
          is_active:  true,
        })
        .select()
        .single();

      if (error) {
        console.error('[Users] Error creating user:', error);
        // Surface duplicate-email as a user-friendly message
        if (error.code === '23505') {
          throw new Error('A user with this email address already exists.');
        }
        throw new Error(`Failed to create user: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Users] User created successfully:', data.id);

      return {
        user: {
          id:        data.id,
          name:      data.name,
          email:     data.email,
          role:      data.role,
          companyId: data.company_id,
          avatar:    data.avatar || undefined,
          isActive:  data.is_active,
          createdAt: data.created_at,
        },
      };
    } catch (error: any) {
      console.error('[Users] Unexpected error creating user:', error);
      throw new Error(error.message || 'Failed to create user');
    }
  });
