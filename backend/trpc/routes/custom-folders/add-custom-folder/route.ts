import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../lib/supabase.js";

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

    if (!supabase) {
      console.error('[Custom Folders] Supabase client not initialized');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    try {
      const folderType = input.name.toLowerCase().replace(/\s+/g, '-');
      console.log('[Custom Folders] Starting insert with folder_type:', folderType);

      const insertStart = Date.now();

      // Use Promise.race for 30-second timeout protection
      const { data, error } = await Promise.race([
        supabase
          .from('custom_folders')
          .insert({
            project_id: input.projectId,
            folder_type: folderType,
            name: input.name.trim(),
            color: input.color || '#6B7280',
            description: input.description || 'Custom folder',
          })
          .select()
          .single(),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Insert query timeout after 30 seconds')), 30000)
        )
      ]);

      const insertDuration = Date.now() - insertStart;
      console.log('[Custom Folders] Insert completed in', insertDuration, 'ms');

      if (error) {
        console.error('[Custom Folders] Error adding folder:', error);
        throw new Error(`Failed to add custom folder: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Custom Folders] Folder created successfully:', data.id);

      return {
        success: true,
        folder: {
          id: data.id,
          type: data.folder_type,
          name: data.name,
          icon: 'Folder',
          color: data.color,
          description: data.description,
          createdAt: data.created_at,
        },
      };
    } catch (error: any) {
      console.error('[Custom Folders] Unexpected error:', error.message);
      throw new Error(error.message || 'Failed to add custom folder');
    }
  });
