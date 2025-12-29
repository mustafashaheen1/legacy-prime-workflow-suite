import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { supabase } from "../../../../lib/supabase.js";

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

    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      console.log('[CRM] Step 1: Setting up data...');

      // Set expiration to 14 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      console.log('[CRM] Step 2: Inserting into database (let Supabase generate UUIDs)...');

      // Insert into database with pre-generated token from frontend
      // @ts-ignore - Supabase types not properly generated
      const { data, error } = await supabase
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
        })
        .select()
        .single();

      console.log('[CRM] Step 3: Insert completed, checking for errors...');

      if (error) {
        console.error('[CRM] Error creating inspection link:', error);
        throw new Error(`Failed to create inspection link: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const inspectionUrl = `${baseUrl}/inspection-video/${data.token}`;

      console.log('[CRM] Inspection video link created:', data.id);

      return {
        success: true,
        inspectionId: data.id,
        token: data.token,
        inspectionUrl,
        expiresAt: data.expires_at,
      };
    } catch (error: any) {
      console.error('[CRM] Unexpected error creating inspection link:', error);
      throw new Error(error.message || 'Failed to create inspection link');
    }
  });
