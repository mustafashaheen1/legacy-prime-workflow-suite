import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from './lib/sendNotification.js';
import { notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing required field: userId' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, name, email, is_active, role, company_id')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role === 'admin' || user.role === 'super-admin') {
    return res.status(403).json({ error: 'Cannot reject admin users' });
  }

  if (user.is_active) {
    return res.status(400).json({ error: 'Cannot reject an already active user' });
  }

  // Notify the employee before deleting so the push token is still valid
  try {
    await sendNotification(supabase, {
      userId: user.id,
      companyId: user.company_id,
      type: 'general',
      title: 'Account Not Approved',
      message: 'Your account application was not approved. Please contact your administrator for more information.',
      data: {},
    });
  } catch (e) {
    console.warn('[RejectUser] Employee notify failed (non-fatal):', e);
  }

  // Notify other admins
  try {
    await notifyCompanyAdmins(supabase, {
      companyId: user.company_id,
      actorId: user.id,
      type: 'general',
      title: 'Employee Application Rejected',
      message: `${user.name} account application has been rejected`,
      data: { userId: user.id },
    });
  } catch (e) {
    console.warn('[RejectUser] Admin notify failed (non-fatal):', e);
  }

  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteError) {
    console.error('[RejectUser] Delete error:', deleteError);
    return res.status(500).json({ error: deleteError.message });
  }

  return res.status(200).json({ success: true, deletedUserId: userId });
}
