import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getCustomFoldersProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Custom Folders] Fetching folders for project:', input.projectId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Custom Folders] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    try {
      const { data, error } = await supabase
        .from('custom_folders')
        .select('*')
        .eq('project_id', input.projectId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Custom Folders] Error fetching folders:', error);
        throw new Error(`Failed to fetch custom folders: ${error.message}`);
      }

      console.log(`[Custom Folders] Found ${data?.length || 0} folders`);

      const folders = (data || []).map((folder: any) => ({
        type: folder.folder_type,
        name: folder.name,
        icon: 'Folder',
        color: folder.color || '#6B7280',
        description: folder.description || 'Custom folder',
      }));

      return {
        success: true,
        folders,
      };
    } catch (error: any) {
      console.error('[Custom Folders] Unexpected error:', error);
      throw new Error(error.message || 'Failed to fetch custom folders');
    }
  });
