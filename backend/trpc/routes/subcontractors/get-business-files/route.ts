import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getBusinessFilesProcedure = publicProcedure
  .input(
    z.object({
      subcontractorId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[BusinessFiles] Fetching files for subcontractor:', input.subcontractorId);

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('business_files')
      .select('*')
      .eq('subcontractor_id', input.subcontractorId)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('[BusinessFiles] Error fetching files:', error);
      throw new Error(`Failed to fetch business files: ${error.message}`);
    }

    console.log('[BusinessFiles] Found', data?.length || 0, 'files');

    // Convert to camelCase
    const files = (data || []).map((file: any) => ({
      id: file.id,
      subcontractorId: file.subcontractor_id,
      type: file.type,
      name: file.name,
      fileType: file.file_type,
      fileSize: file.file_size,
      uri: file.uri,
      uploadDate: file.upload_date,
      expiryDate: file.expiry_date || undefined,
      verified: file.verified,
      verifiedBy: file.verified_by || undefined,
      verifiedDate: file.verified_date || undefined,
      notes: file.notes || undefined,
    }));

    return files;
  });
