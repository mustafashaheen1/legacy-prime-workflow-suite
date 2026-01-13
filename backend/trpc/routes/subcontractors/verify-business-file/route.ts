import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const verifyBusinessFileProcedure = publicProcedure
  .input(
    z.object({
      fileId: z.string(),
      verified: z.boolean(),
      verifiedBy: z.string(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[BusinessFile] Verifying file:', input.fileId, 'Status:', input.verified);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const verifiedDate = new Date().toISOString();

    const { data, error } = await supabase
      .from('business_files')
      .update({
        verified: input.verified,
        verified_by: input.verifiedBy,
        verified_date: verifiedDate,
        notes: input.notes || null,
      })
      .eq('id', input.fileId)
      .select()
      .single();

    if (error) {
      console.error('[BusinessFile] Verify error:', error);
      throw new Error(`Failed to verify file: ${error.message}`);
    }

    console.log('[BusinessFile] File verified:', data.id);

    return {
      id: data.id,
      verified: data.verified,
      verifiedBy: data.verified_by,
      verifiedDate: data.verified_date,
      notes: data.notes,
    };
  });
