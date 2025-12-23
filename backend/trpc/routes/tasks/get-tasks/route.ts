import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const inputSchema = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().optional(),
  completed: z.boolean().optional(),
});

export const getTasksProcedure = publicProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    console.log('[Tasks] Getting tasks for company:', input.companyId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Tasks] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Build query
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('company_id', input.companyId);

      // Apply filters
      if (input.projectId) {
        query = query.eq('project_id', input.projectId);
      }

      if (input.completed !== undefined) {
        query = query.eq('completed', input.completed);
      }

      // Order by date ascending (upcoming first)
      query = query.order('date', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('[Tasks] Error fetching tasks:', error);
        throw new Error(`Failed to fetch tasks: ${error.message}`);
      }

      // Transform database format to frontend format
      const tasks = (data || []).map((task: any) => ({
        id: task.id,
        projectId: task.project_id,
        name: task.name,
        date: task.date,
        reminder: task.reminder,
        completed: task.completed,
      }));

      console.log('[Tasks] Found', tasks.length, 'tasks');

      return {
        tasks,
        total: tasks.length,
      };
    } catch (error: any) {
      console.error('[Tasks] Unexpected error:', error);
      throw new Error(error.message || 'Failed to fetch tasks');
    }
  });
