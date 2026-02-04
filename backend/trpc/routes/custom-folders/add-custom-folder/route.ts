import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

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

    try {
      const folderType = input.name.toLowerCase().replace(/\s+/g, '-');
      console.log('[Custom Folders] Attempting insert with folder_type:', folderType);

      // Create AbortController with 10 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        console.log('[Custom Folders] Starting fetch to Supabase...');

        // Use direct HTTP fetch instead of Supabase SDK to avoid cold start issues
        const response = await fetch(`${supabaseUrl}/rest/v1/custom_folders`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            project_id: input.projectId,
            folder_type: folderType,
            name: input.name.trim(),
            color: input.color || '#6B7280',
            description: input.description || 'Custom folder',
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('[Custom Folders] Fetch completed, status:', response.status);

        if (!response.ok) {
          const error = await response.text();
          console.error('[Custom Folders] Error adding folder:', error);
          throw new Error(`Failed to add custom folder: ${error}`);
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
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('[Custom Folders] Fetch timeout after 10 seconds');
          throw new Error('Request to database timed out. Please check your Supabase configuration.');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[Custom Folders] Unexpected error:', error);
      throw new Error(error.message || 'Failed to add custom folder');
    }
  });
