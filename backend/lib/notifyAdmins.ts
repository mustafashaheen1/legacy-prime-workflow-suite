import { SupabaseClient } from '@supabase/supabase-js';
import { sendNotification, SendNotificationParams } from './sendNotification.js';

/**
 * Looks up a user's display name from the users table.
 * Falls back to 'An employee' if the user can't be found.
 */
export async function getActorName(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single();
  return data?.name ?? 'An employee';
}

/**
 * Sends a notification to every active admin/super-admin in a company,
 * excluding the actor who performed the action (so an admin doesn't
 * receive their own notifications).
 *
 * This function is designed to be called fire-and-forget (void'd) from
 * route handlers so it never blocks the API response.
 */
export async function notifyCompanyAdmins(
  supabase: SupabaseClient,
  {
    companyId,
    actorId,
    type,
    title,
    message,
    data,
  }: {
    companyId: string;
    actorId: string;
    type: SendNotificationParams['type'];
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .in('role', ['admin', 'super-admin'])
    .neq('id', actorId)
    .eq('is_active', true);

  if (!admins?.length) {
    console.log('[AdminNotify] No admins to notify in company:', companyId);
    return;
  }

  console.log('[AdminNotify] Notifying', admins.length, 'admin(s):', title);

  for (const admin of admins) {
    void sendNotification(supabase, {
      userId: admin.id,
      companyId,
      type,
      title,
      message,
      data,
    });
  }
}
