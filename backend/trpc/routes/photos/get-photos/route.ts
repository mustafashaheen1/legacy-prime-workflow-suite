import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const inputSchema = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().optional(),
  category: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getPhotosProcedure = publicProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    console.log('[Photos] Getting photos for company:', input.companyId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Photos] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Start with base query
      let query = supabase
        .from('photos')
        .select('*')
        .eq('company_id', input.companyId);

      // Apply filters
      if (input.projectId) {
        query = query.eq('project_id', input.projectId);
      }

      if (input.category) {
        query = query.ilike('category', `%${input.category}%`);
      }

      if (input.date) {
        query = query.gte('date', input.date).lt('date', input.date + 'T23:59:59');
      }

      if (input.startDate && input.endDate) {
        query = query.gte('date', input.startDate).lte('date', input.endDate);
      }

      // Order by date descending (newest first)
      query = query.order('date', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('[Photos] Error fetching photos:', error);
        throw new Error(`Failed to fetch photos: ${error.message}`);
      }

      // Transform database format to frontend format
      const photos = (data || []).map((photo: any) => ({
        id: photo.id,
        projectId: photo.project_id,
        category: photo.category,
        notes: photo.notes || '',
        url: photo.url,
        date: photo.date,
        fileSize: photo.file_size,
        fileType: photo.file_type,
        s3Key: photo.s3_key,
        compressed: photo.compressed,
      }));

      console.log('[Photos] Found', photos.length, 'photos');

      return {
        photos,
        total: photos.length,
      };
    } catch (error: any) {
      console.error('[Photos] Unexpected error:', error);
      throw new Error(error.message || 'Failed to fetch photos');
    }
  });
