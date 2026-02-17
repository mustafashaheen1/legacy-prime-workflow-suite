import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow PUT/PATCH
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Update schedule phase request received');

  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Phase ID is required' });
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
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.parentPhaseId !== undefined) updateData.parent_phase_id = updates.parentPhaseId;
    if (updates.order !== undefined) updateData.order_index = updates.order;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.visibleToClient !== undefined) updateData.visible_to_client = updates.visibleToClient;

    // Update in database
    const { data, error } = await supabase
      .from('schedule_phases')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to update schedule phase',
        details: error.message
      });
    }

    console.log('[API] Schedule phase updated successfully:', id);

    // Return the updated phase
    return res.status(200).json({
      success: true,
      phase: {
        id: data.id,
        projectId: data.project_id,
        name: data.name,
        parentPhaseId: data.parent_phase_id,
        order: data.order_index,
        color: data.color,
        visibleToClient: data.visible_to_client,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[API] Error updating schedule phase:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
