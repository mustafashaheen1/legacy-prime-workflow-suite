import { SupabaseClient } from '@supabase/supabase-js';

export interface SendNotificationParams {
  userId:    string;
  companyId: string;
  type: 'estimate-received' | 'proposal-submitted' | 'payment-received' | 'change-order' | 'general' | 'task-reminder';
  title:     string;
  message:   string;
  data?:     Record<string, unknown>;
}

/**
 * Persists a notification to the DB and pushes to all active devices for the user.
 * Push delivery is best-effort — an Expo push failure does NOT throw.
 * Returns the DB-generated notification id, or null on insert failure.
 */
export async function sendNotification(
  supabase: SupabaseClient,
  params: SendNotificationParams
): Promise<string | null> {
  console.log('[sendNotification] Creating notification for user:', params.userId, 'type:', params.type);

  // 1. Persist to notifications table
  const { data: notif, error: insertError } = await supabase
    .from('notifications')
    .insert({
      user_id:    params.userId,
      company_id: params.companyId,
      type:       params.type,
      title:      params.title,
      message:    params.message,
      data:       params.data ?? null,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[sendNotification] DB insert failed:', insertError);
    return null;
  }

  console.log('[sendNotification] Notification persisted:', notif.id);

  // 2. Look up active push tokens for this user
  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', params.userId)
    .eq('is_active', true);

  if (!tokenRows?.length) {
    console.log('[sendNotification] No active push tokens found for user:', params.userId);
    return notif.id;
  }

  // 3. Fire push delivery without blocking the return.
  //    The DB record is already committed — push is best-effort.
  //    Awaiting Expo's API inside a Vercel serverless function risks
  //    FUNCTION_INVOCATION_TIMEOUT, so we fire-and-forget here.
  const messages = tokenRows.map(row => ({
    to:    row.token,
    title: params.title,
    body:  params.message,
    data:  params.data ?? {},
    sound: 'default' as const,
    badge: 1,
  }));

  void (async () => {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'Accept':          'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.warn('[sendNotification] Expo push API returned non-OK:', response.status);
        return;
      }

      const result = await response.json() as {
        data: Array<{ status: string; message?: string; details?: { error?: string } }>;
      };
      console.log('[sendNotification] Push dispatched to', tokenRows.length, 'device(s)');

      const deadTokens: string[] = [];
      result.data?.forEach((ticket, i) => {
        if (ticket.status === 'error') {
          const errCode = ticket.details?.error;
          console.warn('[sendNotification] Expo ticket error for token', tokenRows[i]?.token, ':', errCode, ticket.message);
          if (errCode === 'DeviceNotRegistered') {
            deadTokens.push(tokenRows[i].token);
          }
        }
      });

      if (deadTokens.length > 0) {
        console.log('[sendNotification] Deactivating', deadTokens.length, 'dead token(s)');
        await supabase
          .from('push_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('token', deadTokens);
      }
    } catch (pushErr) {
      console.warn('[sendNotification] Expo push dispatch failed (non-fatal):', pushErr);
    }
  })();

  // Return immediately after DB insert — don't wait for push delivery
  return notif.id;
}
