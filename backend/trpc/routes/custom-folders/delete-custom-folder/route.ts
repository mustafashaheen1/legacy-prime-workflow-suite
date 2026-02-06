import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const deleteCustomFolderProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string(),
      folderType: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Custom Folders] Deleting folder:', input.folderType, 'for project:', input.projectId);

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
      const { error } = await supabase
        .from('custom_folders')
        .delete()
        .eq('project_id', input.projectId)
        .eq('folder_type', input.folderType);

      if (error) {
        console.error('[Custom Folders] Error deleting folder:', error);
        throw new Error(`Failed to delete custom folder: ${error.message}`);
      }

      console.log('[Custom Folders] Folder deleted successfully');

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[Custom Folders] Unexpected error:', error);
      throw new Error(error.message || 'Failed to delete custom folder');
    }
  });
