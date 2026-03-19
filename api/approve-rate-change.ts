import { createClient } from '@supabase/supabase-js';

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

  const { employeeId, approve } = req.body ?? {};

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

  // If approving, read current rate_change_request to get newRate
  const updates: Record<string, any> = { rate_change_request: null };

  if (approve) {
    const { data: userRow, error: fetchError } = await supabase
      .from('users')
      .select('rate_change_request')
      .eq('id', employeeId)
      .single();

    if (fetchError) {
      console.error('[approve-rate-change] Fetch error:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    const newRate = userRow?.rate_change_request?.newRate;
    if (newRate == null) {
      return res.status(400).json({ error: 'No pending rate change request found' });
    }

    updates.hourly_rate = Number(newRate);
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', employeeId);

  if (error) {
    console.error('[approve-rate-change] Update error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
