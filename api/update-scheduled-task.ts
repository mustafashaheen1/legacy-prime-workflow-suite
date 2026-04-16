import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../backend/lib/sendNotification.js';

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
    if (updates.phaseId !== undefined) updateData.phase_id = updates.phaseId;
    if (updates.visibleToClient !== undefined) updateData.visible_to_client = updates.visibleToClient;
    if (updates.completed !== undefined) updateData.completed = updates.completed;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
    if (updates.assignedEmployeeIds !== undefined) updateData.assigned_employee_ids = updates.assignedEmployeeIds;
    if (updates.assignedSubcontractorIds !== undefined) updateData.assigned_subcontractor_ids = updates.assignedSubcontractorIds;

    // Backfill company_id if missing — resolves tasks created before the migration
    if (updates.projectId) {
      const { data: proj } = await supabase
        .from('projects').select('company_id').eq('id', updates.projectId).single();
      if (proj?.company_id) updateData.company_id = proj.company_id;
    }

    // Snapshot current assigned employees before overwriting (needed for unassign notifications)
    let oldEmployeeIds: string[] = [];
    if (updates.assignedEmployeeIds !== undefined) {
      const { data: existing } = await supabase
        .from('scheduled_tasks')
        .select('assigned_employee_ids, category, project_id, company_id')
        .eq('id', id)
        .single();
      oldEmployeeIds = existing?.assigned_employee_ids ?? [];
    }

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

    // Notify employees who were removed from this task
    if (updates.assignedEmployeeIds !== undefined && oldEmployeeIds.length > 0) {
      const newIds: string[] = updates.assignedEmployeeIds ?? [];
      const removed = oldEmployeeIds.filter(eid => !newIds.includes(eid));
      const companyId = data.company_id;
      const category = data.category ?? 'Scheduled Task';
      if (removed.length > 0 && companyId) {
        for (const eid of removed) {
          try {
            await sendNotification(supabase, {
              userId: eid,
              companyId,
              type: 'general',
              title: 'Removed from Job Assignment',
              message: `You have been unassigned from the ${category} task`,
              data: { taskId: id, projectId: data.project_id },
            });
          } catch (e) {
            console.warn('[UpdateScheduledTask] Unassign notify failed for', eid, ':', e);
          }
        }
      }
    }

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
        phaseId: data.phase_id,
        visibleToClient: data.visible_to_client,
        completed: data.completed,
        completedAt: data.completed_at,
        assignedEmployeeIds: data.assigned_employee_ids ?? [],
        assignedSubcontractorIds: data.assigned_subcontractor_ids ?? [],
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
