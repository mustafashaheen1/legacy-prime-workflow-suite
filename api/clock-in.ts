import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getActorName, notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';
import { applyCors } from './lib/cors.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  console.log('[ClockIn] ===== API ROUTE STARTED =====');
  console.log('[ClockIn] Method:', req.method);

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, employeeId, projectId, officeRole, location, workPerformed, category } = req.body;

    console.log('[ClockIn] Clocking in employee:', employeeId, 'for project:', projectId, 'officeRole:', officeRole);

    // Validate required fields — must have either projectId or officeRole, not both null
    if (!companyId || !employeeId) {
      console.log('[ClockIn] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: companyId, employeeId' });
    }
    if (!projectId && !officeRole) {
      console.log('[ClockIn] Missing projectId and officeRole — must have one');
      return res.status(400).json({ error: 'Must provide either projectId or officeRole' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[ClockIn] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Snapshot the employee's current hourly rate so historical entries remain
    // accurate even after future rate changes.
    const { data: userRow } = await supabase
      .from('users')
      .select('hourly_rate')
      .eq('id', employeeId)
      .single();
    const snapshotRate = userRow?.hourly_rate != null ? Number(userRow.hourly_rate) : null;

    console.log('[ClockIn] Inserting into database...');
    const insertStart = Date.now();

    const { data, error } = await supabase
      .from('clock_entries')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        project_id: projectId || null,
        office_role: officeRole || null,
        clock_in: new Date().toISOString(),
        location: (location?.latitude || location?.lat)
          ? { latitude: location.latitude ?? location.lat, longitude: location.longitude ?? location.lng }
          : null,
        work_performed: workPerformed || null,
        category: category || null,
        hourly_rate: snapshotRate,
        is_clocked_in: true,
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

    // Notify admins — must complete BEFORE responding because Vercel freezes
    // the process the moment res.json() is called (fire-and-forget is unsafe here).
    try {
      const name = await getActorName(supabase, employeeId);
      let notifyMessage = '';
      if (officeRole) {
        notifyMessage = `${name} clocked in for office: ${officeRole}`;
      } else {
        const projectRes = await supabase.from('projects').select('name').eq('id', projectId).single();
        notifyMessage = `${name} clocked in on ${projectRes.data?.name ?? 'a project'}`;
      }
      await notifyCompanyAdmins(supabase, {
        companyId,
        actorId: employeeId,
        type: 'general',
        title: 'Employee Clocked In',
        message: notifyMessage,
        data: { projectId: projectId || null, officeRole: officeRole || null, clockEntryId: data.id },
      });
    } catch (e) {
      console.warn('[ClockIn] Admin notify failed (non-fatal):', e);
    }

    return res.status(200).json({
      success: true,
      clockEntry: {
        id: data.id,
        employeeId: data.employee_id,
        projectId: data.project_id || undefined,
        officeRole: data.office_role || undefined,
        clockIn: data.clock_in,
        clockOut: data.clock_out || undefined,
        location: data.location,
        workPerformed: data.work_performed || undefined,
        category: data.category || undefined,
        hourlyRate: data.hourly_rate != null ? Number(data.hourly_rate) : undefined,
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
