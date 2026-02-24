import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, employeeId, employeeName } = req.body;

    if (!companyId || !employeeId || !employeeName) {
      return res.status(400).json({ error: 'Missing required fields: companyId, employeeId, employeeName' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    await notifyCompanyAdmins(supabase, {
      companyId,
      actorId: employeeId,
      type: 'general',
      title: 'New Employee Pending Approval',
      message: `${employeeName} has signed up and is waiting for your approval`,
      data: { employeeId, pendingApproval: true },
    });

    console.log('[ApprovalNotify] Notified admins of new pending employee:', employeeName);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[ApprovalNotify] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send notification' });
  }
}
