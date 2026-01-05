import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { createClient } from '@supabase/supabase-js';

export const getInspectionVideosProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      clientId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      status: z.enum(['pending', 'completed', 'all']).default('all'),
    })
  )
  .query(async ({ input }) => {
    console.log('[CRM] Fetching inspection videos for company:', input.companyId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      let query = supabase
        .from('inspection_videos')
        .select('*')
        .eq('company_id', input.companyId)
        .order('created_at', { ascending: false });

      if (input.clientId) {
        query = query.eq('client_id', input.clientId);
      }

      if (input.projectId) {
        query = query.eq('project_id', input.projectId);
      }

      if (input.status !== 'all') {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[CRM] Error fetching inspection videos:', error);
        throw new Error(`Failed to fetch inspection videos: ${error.message}`);
      }

      console.log('[CRM] Found', data.length, 'inspection videos');

      // Convert to camelCase
      const inspections = data.map(item => ({
        id: item.id,
        token: item.token,
        clientId: item.client_id,
        companyId: item.company_id,
        projectId: item.project_id,
        clientName: item.client_name,
        clientEmail: item.client_email,
        status: item.status,
        videoUrl: item.video_url,
        videoDuration: item.video_duration,
        videoSize: item.video_size,
        notes: item.notes,
        createdAt: item.created_at,
        completedAt: item.completed_at,
        expiresAt: item.expires_at,
      }));

      return {
        success: true,
        inspections,
      };
    } catch (error: any) {
      console.error('[CRM] Unexpected error fetching inspections:', error);
      throw new Error(error.message || 'Failed to fetch inspection videos');
    }
  });
