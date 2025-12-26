import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { createClient } from '@supabase/supabase-js';

export const validateInspectionTokenProcedure = publicProcedure
  .input(
    z.object({
      token: z.string().uuid(),
    })
  )
  .query(async ({ input }) => {
    console.log('[CRM] Validating inspection token:', input.token);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const { data, error } = await supabase
        .from('inspection_videos')
        .select('*')
        .eq('token', input.token)
        .single();

      if (error || !data) {
        console.error('[CRM] Invalid token:', input.token);
        return {
          valid: false,
          message: 'Invalid inspection link',
        };
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        return {
          valid: false,
          message: 'This inspection link has expired',
        };
      }

      // Check if already completed
      if (data.status === 'completed') {
        return {
          valid: false,
          message: 'This inspection has already been completed',
          alreadyCompleted: true,
        };
      }

      console.log('[CRM] Token validated successfully');

      return {
        valid: true,
        inspection: {
          id: data.id,
          clientName: data.client_name,
          clientEmail: data.client_email,
          notes: data.notes,
          expiresAt: data.expires_at,
        },
      };
    } catch (error: any) {
      console.error('[CRM] Error validating token:', error);
      throw new Error(error.message || 'Failed to validate token');
    }
  });
