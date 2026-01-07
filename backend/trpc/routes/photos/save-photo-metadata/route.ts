import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

// This procedure saves photo metadata when the file has already been uploaded to S3
export const savePhotoMetadataProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid(),
      category: z.string().min(1),
      notes: z.string().optional(),
      url: z.string().url(), // S3 URL of the already-uploaded photo
      date: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Photos] Saving photo metadata for project:', input.projectId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Photos] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Extract S3 key from URL if it's an S3 URL
      let s3Key: string | null = null;
      try {
        const urlObj = new URL(input.url);
        // Extract path after the bucket name
        s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      } catch {
        // Not a valid URL or can't extract key, that's fine
      }

      // Save to database
      const { data, error } = await supabase
        .from('photos')
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          category: input.category,
          notes: input.notes || null,
          url: input.url,
          s3_key: s3Key,
          date: input.date || new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Photos] Error saving to database:', error);
        throw new Error(`Failed to save photo: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Photos] Photo metadata saved successfully:', data.id);

      return {
        success: true,
        photo: {
          id: data.id,
          projectId: data.project_id,
          category: data.category,
          notes: data.notes || undefined,
          url: data.url,
          date: data.date,
          s3Key: data.s3_key,
        },
      };
    } catch (error: any) {
      console.error('[Photos] Unexpected error saving photo metadata:', error);
      throw new Error(error.message || 'Failed to save photo metadata');
    }
  });
