import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../backend/lib/sendNotification.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { employeeId, companyId, taskName, startDate, companyName } = req.body;
  console.log('[TaskNotif] Request body:', { employeeId, companyId, taskName, startDate, companyName });

  if (!employeeId || !companyId || !taskName || !startDate) {
    console.error('[TaskNotif] Missing required fields:', { employeeId, companyId, taskName, startDate });
    return res.status(400).json({ error: 'employeeId, companyId, taskName, and startDate are required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('[TaskNotif] Firebase env check — PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID, '| CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL, '| PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY);

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check if employee has any push tokens
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, platform, token_source, is_active')
    .eq('user_id', employeeId);
  console.log('[TaskNotif] Push tokens for employee', employeeId, ':', JSON.stringify(tokens));

  const datePart = startDate.split('T')[0].split(' ')[0];
  const [yr, mo, dy] = datePart.split('-').map(Number);
  const dateStr = new Date(Date.UTC(yr, mo - 1, dy)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const sender = companyName || 'Your company';

  try {
    const notifId = await sendNotification(supabase, {
      userId: employeeId,
      companyId,
      type: 'task-assigned',
      title: 'New Job Assignment',
      message: `You've been assigned to: ${taskName} on ${dateStr}. — ${sender}`,
      data: { taskName, startDate },
    });

    console.log('[TaskNotif] Done — notifId:', notifId);
    return res.status(200).json({ success: true, notifId });
  } catch (error: any) {
    console.error('[TaskNotif] sendNotification error:', error.message, error.stack);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
