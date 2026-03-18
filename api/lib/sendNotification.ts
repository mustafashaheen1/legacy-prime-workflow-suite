import { SupabaseClient } from '@supabase/supabase-js';
import { getFirebaseMessaging } from './firebase-admin.js';

export interface SendNotificationParams {
  userId:    string;
  companyId: string;
  type: 'estimate-received' | 'proposal-submitted' | 'payment-received' | 'change-order' | 'general' | 'task-reminder';
  title:     string;
  message:   string;
  data?:     Record<string, unknown>;
}

/**
 * Persists a notification to the DB and pushes to all active devices for the user
 * via Firebase Cloud Messaging (iOS, Android, Web).
 *
 * Token routing:
 *   - Legacy Expo tokens (ExponentPushToken[...]) → Expo push API (backward compat)
 *   - FCM tokens (raw FCM registration token)     → Firebase Admin SDK
 *
 * Push delivery is best-effort — a push failure does NOT throw.
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
    .select('token, token_source')
    .eq('user_id', params.userId)
    .eq('is_active', true);

  if (!tokenRows?.length) {
    console.log('[sendNotification] No active push tokens for user:', params.userId);
    return notif.id;
  }

  // Split tokens by type for appropriate delivery path
  const expoTokens = tokenRows.filter(r => r.token.startsWith('ExponentPushToken['));
  const fcmTokens  = tokenRows.filter(r => !r.token.startsWith('ExponentPushToken['));

  const dataPayload: Record<string, string> = {
    type: params.type,
    ...(params.data ? Object.fromEntries(
      Object.entries(params.data).map(([k, v]) => [k, String(v)])
    ) : {}),
  };

  // 3a. Send to FCM tokens via Firebase Admin SDK
  if (fcmTokens.length > 0) {
    try {
      const messaging = await getFirebaseMessaging();
      const deadFcmTokens: string[] = [];

      await Promise.all(
        fcmTokens.map(async (row) => {
          try {
            await messaging.send({
              token: row.token,
              notification: {
                title: params.title,
                body:  params.message,
              },
              data: dataPayload,
              apns: {
                payload: {
                  aps: {
                    badge: 1,
                    sound: 'default',
                  },
                },
              },
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  channelId: params.type === 'task-reminder' ? 'task-reminders' : 'default',
                },
              },
            });
          } catch (err: any) {
            const code = err?.errorInfo?.code || err?.code || '';
            if (
              // FCM HTTP v1 error codes
              code === 'UNREGISTERED' ||
              code === 'INVALID_ARGUMENT' ||
              // Legacy firebase-admin SDK error codes (kept for safety)
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token')
            ) {
              deadFcmTokens.push(row.token);
            } else {
              console.warn('[sendNotification] FCM send error for token:', row.token, code);
            }
          }
        })
      );

      console.log('[sendNotification] FCM dispatched to', fcmTokens.length, 'device(s)');

      if (deadFcmTokens.length > 0) {
        console.log('[sendNotification] Deactivating', deadFcmTokens.length, 'dead FCM token(s)');
        await supabase
          .from('push_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('token', deadFcmTokens);
      }
    } catch (err) {
      console.warn('[sendNotification] FCM dispatch failed (non-fatal):', err);
    }
  }

  // 3b. Send to legacy Expo tokens for backward compatibility
  //     Remove this block once all active devices have re-registered with FCM tokens
  if (expoTokens.length > 0) {
    try {
      const messages = expoTokens.map(row => ({
        to:    row.token,
        title: params.title,
        body:  params.message,
        data:  dataPayload,
        sound: 'default' as const,
        badge: 1,
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'Accept':          'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      if (response.ok) {
        const result = await response.json() as {
          data: Array<{ status: string; details?: { error?: string } }>;
        };
        const deadExpoTokens = expoTokens
          .filter((_, i) => result.data?.[i]?.details?.error === 'DeviceNotRegistered')
          .map(r => r.token);

        if (deadExpoTokens.length > 0) {
          await supabase
            .from('push_tokens')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in('token', deadExpoTokens);
        }
        console.log('[sendNotification] Expo push dispatched to', expoTokens.length, 'legacy device(s)');
      }
    } catch (err) {
      console.warn('[sendNotification] Expo push dispatch failed (non-fatal):', err);
    }
  }

  return notif.id;
}
