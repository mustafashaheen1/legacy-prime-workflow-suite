import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, platform, userId, companyId, tokenSource = 'fcm' } = req.body;

  if (!token || !platform || !userId || !companyId) {
    return res.status(400).json({ error: 'token, platform, userId, and companyId are required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Deactivate all existing tokens for this user+platform except the incoming one.
    // This ensures only the current token stays active — prevents stale tokens
    // from receiving notifications after FCM rotates the device token.
    const { error: deactivateError } = await supabase
      .from('push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('platform', platform)
      .neq('token', token);

    if (deactivateError) {
      console.warn('[API] register-push-token deactivate error (non-fatal):', deactivateError.message);
    }

    // Upsert the new/refreshed token as active.
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          token,
          user_id:      userId,
          company_id:   companyId,
          platform,
          token_source: tokenSource,
          is_active:    true,
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[API] register-push-token error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[API] Push token registered — user:', userId, 'platform:', platform, 'source:', tokenSource, 'token:', token);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[API] register-push-token unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
