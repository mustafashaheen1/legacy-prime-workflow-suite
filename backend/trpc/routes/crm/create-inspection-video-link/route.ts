import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { createClient } from '@supabase/supabase-js';

export const createInspectionVideoLinkProcedure = publicProcedure
  .input(
    z.object({
      token: z.string().uuid(),
      clientId: z.string().uuid(),
      companyId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
      clientName: z.string(),
      clientEmail: z.string().email().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[CRM] Creating inspection video link for:', input.clientName);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      console.log('[CRM] Step 1: Setting up data...');
      const startTime = Date.now();

      // Set expiration to 14 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      console.log('[CRM] Step 2: Attempting database insert with token:', input.token);
      console.log('[CRM] Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');

      // Insert into database with pre-generated token from frontend
      // Using minimal query without .select() to avoid timeout
      // @ts-ignore - Supabase types not properly generated
      const { error } = await supabase
        .from('inspection_videos')
        .insert({
          token: input.token,
          client_id: input.clientId,
          company_id: input.companyId,
          project_id: input.projectId || null,
          client_name: input.clientName,
          client_email: input.clientEmail || '',
          status: 'pending',
          notes: input.notes || null,
          expires_at: expiresAt.toISOString(),
        });

      const elapsed = Date.now() - startTime;
      console.log(`[CRM] Step 3: Insert completed in ${elapsed}ms, checking for errors...`);

      if (error) {
        console.error('[CRM] Supabase Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw new Error(`Failed to create inspection link: ${error.message} (${error.code})`);
      }

      const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const inspectionUrl = `${baseUrl}/inspection-video/${input.token}`;

      console.log('[CRM] Inspection video link created with token:', input.token);

      return {
        success: true,
        token: input.token,
        inspectionUrl,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error: any) {
      console.error('[CRM] Unexpected error creating inspection link:', error);
      throw new Error(error.message || 'Failed to create inspection link');
    }
  });
