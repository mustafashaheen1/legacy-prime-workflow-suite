import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { supabase } from "../../../../lib/supabase.js";
import { randomUUID } from 'crypto';

export const createInspectionVideoLinkProcedure = publicProcedure
  .input(
    z.object({
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
      // Generate unique secure token
      const token = randomUUID();
      const inspectionId = randomUUID();

      // Set expiration to 14 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      // Insert into database
      const { data, error } = await supabase
        .from('inspection_videos')
        .insert({
          id: inspectionId,
          token: token,
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

      if (error) {
        console.error('[CRM] Error creating inspection link:', error);
        throw new Error(`Failed to create inspection link: ${error.message}`);
      }

      const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
      const inspectionUrl = `${baseUrl}/inspection/${token}`;

      console.log('[CRM] Inspection video link created:', inspectionId);

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
