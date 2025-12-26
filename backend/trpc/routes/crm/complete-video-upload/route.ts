import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { createClient } from '@supabase/supabase-js';

export const completeVideoUploadProcedure = publicProcedure
  .input(
    z.object({
      token: z.string().uuid(),
      videoKey: z.string(),
      videoDuration: z.number().optional(),
      videoSize: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[CRM] Marking video upload as complete for token:', input.token);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Update inspection record
      const { data, error } = await supabase
        .from('inspection_videos')
        .update({
          status: 'completed',
          video_url: input.videoKey,
          video_duration: input.videoDuration || null,
          video_size: input.videoSize || null,
          completed_at: new Date().toISOString(),
        })
        .eq('token', input.token)
        .select()
        .single();

      if (error) {
        console.error('[CRM] Error updating inspection:', error);
        throw new Error(`Failed to update inspection: ${error.message}`);
      }

      console.log('[CRM] Video upload completed for inspection:', data.id);

      return {
        success: true,
        inspectionId: data.id,
        status: data.status,
      };
    } catch (error: any) {
      console.error('[CRM] Unexpected error completing upload:', error);
      throw new Error(error.message || 'Failed to complete upload');
    }
  });
