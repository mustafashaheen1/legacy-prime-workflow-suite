import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Get daily logs request received');

  try {
    const { projectId, companyId } = req.query;

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query
    let query = supabase
      .from('daily_logs')
      .select('*')
      .order('log_date', { ascending: false });

    // Filter by company if provided
    if (companyId && typeof companyId === 'string') {
      query = query.eq('company_id', companyId);
    }

    // Filter by project if provided
    if (projectId && typeof projectId === 'string') {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to fetch daily logs',
        details: error.message
      });
    }

    console.log(`[API] Found ${data?.length || 0} daily logs`);

    // Convert snake_case to camelCase
    const dailyLogs = (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      projectId: row.project_id,
      logDate: row.log_date,
      createdBy: row.created_by,
      workPerformed: row.work_performed,
      issues: row.issues,
      generalNotes: row.general_notes, // Map 'general_notes' from DB to 'generalNotes' for DailyLog type
      equipmentNote: row.equipment_note,
      materialNote: row.material_note,
      officialNote: row.official_note,
      subsNote: row.subs_note,
      employeesNote: row.employees_note,
      tasks: row.tasks || [],
      photos: row.photos || [],
      sharedWith: row.shared_with || [],
      createdAt: row.created_at,
    }));

    return res.status(200).json({
      success: true,
      dailyLogs,
    });
  } catch (error: any) {
    console.error('[API] Error fetching daily logs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
