import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getActorName, notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[ClockOut] ===== API ROUTE STARTED =====');
  console.log('[ClockOut] Method:', req.method);

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { entryId, workPerformed, lunchBreaks, category } = req.body;

    console.log('[ClockOut] Clocking out entry:', entryId);

    // Validate required fields
    if (!entryId) {
      console.log('[ClockOut] Missing required field: entryId');
      return res.status(400).json({ error: 'Missing required field: entryId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[ClockOut] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[ClockOut] Updating database...');
    const updateStart = Date.now();

    const updateData: any = {
      clock_out: new Date().toISOString(),
    };

    if (workPerformed !== undefined) {
      updateData.work_performed = workPerformed;
    }

    if (lunchBreaks !== undefined) {
      updateData.lunch_breaks = lunchBreaks;
    }

    if (category !== undefined) {
      updateData.category = category;
    }

    const { data, error } = await supabase
      .from('clock_entries')
      .update(updateData)
      .eq('id', entryId)
      .select()
      .single();

    const updateDuration = Date.now() - updateStart;
    console.log(`[ClockOut] Database UPDATE completed in ${updateDuration}ms`);

    if (error) {
      console.error('[ClockOut] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Clock entry not found' });
    }

    console.log('[ClockOut] ===== API ROUTE COMPLETED =====');
    console.log('[ClockOut] Clock entry updated:', data.id);

    // Notify admins — must complete BEFORE responding (Vercel freezes after res.json)
    try {
      const clockInMs = new Date(data.clock_in).getTime();
      const clockOutMs = new Date(data.clock_out).getTime();
      const hoursWorked = ((clockOutMs - clockInMs) / (1000 * 60 * 60)).toFixed(1);

      const [name, projectRes] = await Promise.all([
        getActorName(supabase, data.employee_id),
        supabase.from('projects').select('name').eq('id', data.project_id).single(),
      ]);
      const projectName = projectRes.data?.name ?? 'a project';
      await notifyCompanyAdmins(supabase, {
        companyId: data.company_id,
        actorId: data.employee_id,
        type: 'general',
        title: 'Employee Clocked Out',
        message: `${name} clocked out of ${projectName} after ${hoursWorked}h`,
        data: { projectId: data.project_id, clockEntryId: data.id },
      });
    } catch (e) {
      console.warn('[ClockOut] Admin notify failed (non-fatal):', e);
    }

    return res.status(200).json({
      success: true,
      clockEntry: {
        id: data.id,
        employeeId: data.employee_id,
        projectId: data.project_id,
        clockIn: data.clock_in,
        clockOut: data.clock_out,
        location: data.location,
        workPerformed: data.work_performed || undefined,
        category: data.category || undefined,
        lunchBreaks: data.lunch_breaks || undefined,
      },
      updateDuration,
    });
  } catch (error: any) {
    console.error('[ClockOut] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
