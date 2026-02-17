import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Get schedule phases request received');

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
      .from('schedule_phases')
      .select('*')
      .order('order_index', { ascending: true });

    // Filter by project if provided
    if (projectId && typeof projectId === 'string') {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to fetch schedule phases',
        details: error.message
      });
    }

    console.log(`[API] Found ${data?.length || 0} schedule phases`);

    // Convert snake_case to camelCase
    const phases = (data || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      parentPhaseId: row.parent_phase_id,
      order: row.order_index,
      color: row.color,
      visibleToClient: row.visible_to_client,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.status(200).json({
      success: true,
      phases,
    });
  } catch (error: any) {
    console.error('[API] Error fetching schedule phases:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
