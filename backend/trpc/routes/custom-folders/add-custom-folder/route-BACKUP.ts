// Backup of current version before making changes
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
    const startTime = Date.now();
    console.log('[Custom Folders] ⏱️ START - Adding folder:', input.name, 'for project:', input.projectId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Custom Folders] ❌ Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    console.log('[Custom Folders] ⏱️ Creating Supabase client... (elapsed:', Date.now() - startTime, 'ms)');

    // Create Supabase client INSIDE handler (not at module level)
    // Use simpler config for faster initialization
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'x-client-info': 'legacy-prime-workflow-suite',
        },
      },
    });

    console.log('[Custom Folders] ⏱️ Client created (elapsed:', Date.now() - startTime, 'ms)');

    try {
      const folderType = input.name.toLowerCase().replace(/\s+/g, '-');
      console.log('[Custom Folders] ⏱️ Starting database operation with folder_type:', folderType, '(elapsed:', Date.now() - startTime, 'ms)');

      const insertStart = Date.now();

      // Use Promise.race for 8-second timeout (Vercel hobby plan has 10s limit, leave 2s buffer)
      const result = await Promise.race([
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
          setTimeout(() => {
            console.error('[Custom Folders] ❌ TIMEOUT - Database query exceeded 8 seconds');
            reject(new Error('Database operation timeout - please try again or contact support if issue persists'));
          }, 8000)
        )
      ]);

      const insertDuration = Date.now() - insertStart;
      const totalDuration = Date.now() - startTime;
      console.log('[Custom Folders] ⏱️ Database operation completed in', insertDuration, 'ms (total elapsed:', totalDuration, 'ms)');

      const { data, error } = result;

      if (error) {
        console.error('[Custom Folders] ❌ Database error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        // Handle specific error cases
        if (error.code === '23505') {
          throw new Error('A folder with this name already exists for this project');
        }

        throw new Error(`Failed to add custom folder: ${error.message}`);
      }

      if (!data) {
        console.error('[Custom Folders] ❌ No data returned from insert');
        throw new Error('No data returned from insert');
      }

      console.log('[Custom Folders] ✅ SUCCESS - Folder created:', data.id, '(total time:', Date.now() - startTime, 'ms)');

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
      const totalDuration = Date.now() - startTime;
      console.error('[Custom Folders] ❌ FAILED after', totalDuration, 'ms - Error:', {
        message: error.message,
        stack: error.stack,
      });
      throw new Error(error.message || 'Failed to add custom folder');
    }
  });
