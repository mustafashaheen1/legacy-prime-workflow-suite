import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const addCustomFolderProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string(),
      name: z.string(),
      color: z.string().optional(),
      description: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Custom Folders] Adding folder:', input.name, 'for project:', input.projectId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[Custom Folders] Supabase URL exists:', !!supabaseUrl);
    console.log('[Custom Folders] Supabase Key exists:', !!supabaseKey);

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Custom Folders] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Custom Folders] Supabase client created');

    try {
      const folderType = input.name.toLowerCase().replace(/\s+/g, '-');
      console.log('[Custom Folders] Attempting insert with folder_type:', folderType);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database operation timed out after 8 seconds')), 8000)
      );

      const insertPromise = supabase
        .from('custom_folders')
        .insert({
          project_id: input.projectId,
          folder_type: folderType,
          name: input.name.trim(),
          color: input.color || '#6B7280',
          description: input.description || 'Custom folder',
        });

      const { error } = await Promise.race([insertPromise, timeoutPromise]) as any;

      if (error) {
        console.error('[Custom Folders] Error adding folder:', error);
        throw new Error(`Failed to add custom folder: ${error.message}`);
      }

      console.log('[Custom Folders] Folder created successfully');

      return {
        success: true,
        folder: {
          type: folderType,
          name: input.name.trim(),
          icon: 'Folder',
          color: input.color || '#6B7280',
          description: input.description || 'Custom folder',
        },
      };
    } catch (error: any) {
      console.error('[Custom Folders] Unexpected error:', error);
      throw new Error(error.message || 'Failed to add custom folder');
    }
  });
