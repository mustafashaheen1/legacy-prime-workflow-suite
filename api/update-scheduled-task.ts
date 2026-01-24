import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow PUT/PATCH
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Update scheduled task request received');

  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build update object (convert camelCase to snake_case)
    const updateData: any = {};
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.workType !== undefined) updateData.work_type = updates.workType;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.row !== undefined) updateData.row = updates.row;
    if (updates.rowSpan !== undefined) updateData.row_span = updates.rowSpan;

    // Update in database
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to update scheduled task',
        details: error.message
      });
    }

    console.log('[API] Scheduled task updated successfully:', id);

    // Return the updated task
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
      },
    });
  } catch (error: any) {
    console.error('[API] Error updating scheduled task:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
