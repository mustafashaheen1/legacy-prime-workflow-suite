import { createClient } from '@supabase/supabase-js';
import { notifyCompanyAdmins } from './lib/notifyAdmins.js';

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

  const { employeeId, newRate } = req.body ?? {};

  if (!employeeId || newRate == null || isNaN(Number(newRate)) || Number(newRate) < 0) {
    return res.status(400).json({ error: 'employeeId and valid newRate are required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rateChangeRequest = {
    newRate: Number(newRate),
    requestDate: new Date().toISOString(),
    status: 'pending',
  };

  // 1. Save the request on the user row
  const { data: userRow, error } = await supabase
    .from('users')
    .update({ rate_change_request: rateChangeRequest })
    .eq('id', employeeId)
    .select('id, name, company_id')
    .single();

  if (error) {
    console.error('[request-rate-change] Update error:', error);
    return res.status(500).json({ error: error.message });
  }

  // 2. Notify all admins in the company.
  // Must be awaited before res.json() — Vercel freezes the process the moment
  // the response is sent, so fire-and-forget notifications never execute.
  try {
    await notifyCompanyAdmins(supabase, {
      companyId: userRow.company_id,
      actorId: employeeId,
      type: 'general',
      title: 'Rate Change Request',
      message: `${userRow.name} has requested a new hourly rate of $${Number(newRate).toFixed(2)}/hr`,
      data: { employeeId, newRate: Number(newRate) },
    });
  } catch (notifyErr) {
    console.warn('[request-rate-change] Admin notify failed (non-fatal):', notifyErr);
  }

  return res.status(200).json({ success: true, rateChangeRequest });
}
