import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../backend/lib/sendNotification.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { employeeId, companyId, taskName, startDate, companyName } = req.body;

  if (!employeeId || !companyId || !taskName || !startDate) {
    return res.status(400).json({ error: 'employeeId, companyId, taskName, and startDate are required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const dateStr = new Date(startDate.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
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

    console.log('[API] Task assignment notification sent to employee:', employeeId, '| notifId:', notifId);
    return res.status(200).json({ success: true, notifId });
  } catch (error: any) {
    console.error('[API] send-task-assignment-notification error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
