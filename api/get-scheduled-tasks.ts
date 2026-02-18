import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Get scheduled tasks request received');

  try {
    const { projectId } = req.query;

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query database
    let query = supabase
      .from('scheduled_tasks')
      .select('*')
      .order('start_date', { ascending: true });

    // Filter by project if provided
    if (projectId && typeof projectId === 'string') {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to fetch scheduled tasks',
        details: error.message
      });
    }

    console.log(`[API] Found ${data?.length || 0} scheduled tasks`);

    // Convert snake_case to camelCase
    const scheduledTasks = (data || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      category: row.category,
      startDate: row.start_date,
      endDate: row.end_date,
      duration: row.duration,
      workType: row.work_type,
      notes: row.notes,
      color: row.color,
      row: row.row,
      rowSpan: row.row_span,
      phaseId: row.phase_id,
      visibleToClient: row.visible_to_client,
      completed: row.completed,
      completedAt: row.completed_at,
    }));

    return res.status(200).json({
      success: true,
      scheduledTasks,
    });
  } catch (error: any) {
    console.error('[API] Error fetching scheduled tasks:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
