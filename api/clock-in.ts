import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[ClockIn] ===== API ROUTE STARTED =====');
  console.log('[ClockIn] Method:', req.method);

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, employeeId, projectId, location, workPerformed, category } = req.body;

    console.log('[ClockIn] Clocking in employee:', employeeId, 'for project:', projectId);

    // Validate required fields
    if (!companyId || !employeeId || !projectId) {
      console.log('[ClockIn] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: companyId, employeeId, projectId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[ClockIn] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[ClockIn] Inserting into database...');
    const insertStart = Date.now();

    const { data, error } = await supabase
      .from('clock_entries')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        project_id: projectId,
        clock_in: new Date().toISOString(),
        location: location || { latitude: 0, longitude: 0 },
        work_performed: workPerformed || null,
        category: category || null,
      })
      .select()
      .single();

    const insertDuration = Date.now() - insertStart;
    console.log(`[ClockIn] Database INSERT completed in ${insertDuration}ms`);

    if (error) {
      console.error('[ClockIn] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[ClockIn] ===== API ROUTE COMPLETED =====');
    console.log('[ClockIn] Clock entry created:', data.id);

    return res.status(200).json({
      success: true,
      clockEntry: {
        id: data.id,
        employeeId: data.employee_id,
        projectId: data.project_id,
        clockIn: data.clock_in,
        clockOut: data.clock_out || undefined,
        location: data.location,
        workPerformed: data.work_performed || undefined,
        category: data.category || undefined,
      },
      insertDuration,
    });
  } catch (error: any) {
    console.error('[ClockIn] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
