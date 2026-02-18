import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Save scheduled task request received');

  try {
    const {
      id,
      projectId,
      category,
      startDate,
      endDate,
      duration,
      workType,
      notes,
      color,
      row,
      rowSpan,
      phaseId,
      visibleToClient,
      completed,
      completedAt,
    } = req.body;

    // Validate required fields
    if (!projectId || !category || !startDate || !endDate || !duration || !workType || !color) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['projectId', 'category', 'startDate', 'endDate', 'duration', 'workType', 'color']
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate ID if not provided
    const taskId = id || `scheduled-task-${Date.now()}`;

    // Insert into database
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .insert({
        id: taskId,
        project_id: projectId,
        category,
        start_date: startDate,
        end_date: endDate,
        duration,
        work_type: workType,
        notes: notes || null,
        color,
        row: row || 0,
        row_span: rowSpan || 1,
        phase_id: phaseId || null,
        visible_to_client: visibleToClient !== undefined ? visibleToClient : true,
        completed: completed !== undefined ? completed : false,
        completed_at: completedAt || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to save scheduled task',
        details: error.message
      });
    }

    console.log('[API] Scheduled task saved successfully:', taskId);

    // Return the saved task
    return res.status(200).json({
      success: true,
      scheduledTask: {
        id: data.id,
        projectId: data.project_id,
        category: data.category,
        startDate: data.start_date,
        endDate: data.end_date,
        duration: data.duration,
        workType: data.work_type,
        notes: data.notes,
        color: data.color,
        row: data.row,
        rowSpan: data.row_span,
        phaseId: data.phase_id,
        visibleToClient: data.visible_to_client,
        completed: data.completed,
        completedAt: data.completed_at,
      },
    });
  } catch (error: any) {
    console.error('[API] Error saving scheduled task:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
