import { createClient } from '@supabase/supabase-js';
import { sendNotification } from './lib/sendNotification.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  // approve=true + newRate → admin direct override (no pending request required)
  // approve=true             → approve a pending rate_change_request from DB
  // approve=false            → reject a pending rate_change_request
  const { employeeId, approve, newRate: directRate } = req.body ?? {};

  if (!employeeId || typeof approve !== 'boolean') {
    return res.status(400).json({ error: 'employeeId and approve (boolean) are required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Read current user row to get rate_change_request and company_id
  const { data: userRow, error: fetchError } = await supabase
    .from('users')
    .select('rate_change_request, company_id')
    .eq('id', employeeId)
    .single();

  if (fetchError) {
    console.error('[approve-rate-change] Fetch error:', fetchError);
    return res.status(500).json({ error: fetchError.message });
  }

  const updates: Record<string, any> = { rate_change_request: null };
  let newRate: number | null = null;

  if (approve) {
    if (directRate != null) {
      // Admin direct override — rate supplied in the request body
      newRate = Number(directRate);
    } else {
      // Approval of a pending employee request — read rate from DB
      newRate = userRow?.rate_change_request?.newRate ?? null;
      if (newRate == null) {
        return res.status(400).json({ error: 'No pending rate change request found' });
      }
    }
    updates.hourly_rate = newRate;
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', employeeId);

  if (error) {
    console.error('[approve-rate-change] Update error:', error);
    return res.status(500).json({ error: error.message });
  }

  // Notify the employee.
  // Must be awaited before res.json() — Vercel freezes the process the moment
  // the response is sent, so fire-and-forget notifications never execute.
  const isDirectOverride = approve && directRate != null;
  try {
    await sendNotification(supabase, {
      userId: employeeId,
      companyId: userRow.company_id,
      type: 'general',
      title: approve ? 'Hourly Rate Updated' : 'Rate Change Rejected',
      message: approve
        ? `Your hourly rate has been set to $${Number(newRate).toFixed(2)}/hr`
        : 'Your rate change request was not approved at this time',
      data: { newRate, directOverride: isDirectOverride },
    });
  } catch (notifyErr) {
    console.warn('[approve-rate-change] Employee notify failed (non-fatal):', notifyErr);
  }

  return res.status(200).json({ success: true });
}
