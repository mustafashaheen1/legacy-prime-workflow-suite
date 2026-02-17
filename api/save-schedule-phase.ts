import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Save schedule phase request received');

  try {
    const {
      id,
      projectId,
      name,
      parentPhaseId,
      order,
      color,
      visibleToClient,
    } = req.body;

    // Validate required fields
    if (!projectId || !name || !color) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['projectId', 'name', 'color']
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
    const phaseId = id || `phase-${Date.now()}`;

    // Insert into database
    const { data, error } = await supabase
      .from('schedule_phases')
      .insert({
        id: phaseId,
        project_id: projectId,
        name,
        parent_phase_id: parentPhaseId || null,
        order_index: order !== undefined ? order : 0,
        color,
        visible_to_client: visibleToClient !== undefined ? visibleToClient : true,
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to save schedule phase',
        details: error.message
      });
    }

    console.log('[API] Schedule phase saved successfully:', phaseId);

    // Return the saved phase
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
    console.error('[API] Error saving schedule phase:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
