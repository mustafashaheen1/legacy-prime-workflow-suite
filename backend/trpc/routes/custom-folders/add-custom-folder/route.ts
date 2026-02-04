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
    // Immediate log to verify function is executing
    console.log('[Custom Folders] FUNCTION STARTED - Adding folder:', input.name);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[Custom Folders] Env check - URL:', !!supabaseUrl, 'Key:', !!supabaseKey);

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Custom Folders] Missing env variables');
      throw new Error('Database not configured');
    }

    const folderType = input.name.toLowerCase().replace(/\s+/g, '-');
    console.log('[Custom Folders] Will insert with type:', folderType);

    // Direct fetch with minimal timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[Custom Folders] Aborting after 10s');
      controller.abort();
    }, 10000);

    try {
      console.log('[Custom Folders] Fetching:', `${supabaseUrl}/rest/v1/custom_folders`);

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
      console.log('[Custom Folders] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Custom Folders] Error response:', errorText);
        throw new Error(`Database error: ${errorText}`);
      }

      console.log('[Custom Folders] Success!');

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
      clearTimeout(timeoutId);
      console.error('[Custom Folders] Caught error:', error.name, error.message);

      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 10 seconds');
      }
      throw new Error(error.message || 'Failed to add folder');
    }
  });
