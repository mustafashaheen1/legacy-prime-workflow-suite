import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, body, companyId } = req.body;
  if (!to || !body) {
    return res.status(400).json({ error: 'to and body are required' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;

  // Use company's unique number if available, fall back to global
  let fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;
  if (companyId) {
    const { data } = await supabase.from('companies').select('twilio_phone_number').eq('id', companyId).single();
    if (data?.twilio_phone_number) fromNumber = data.twilio_phone_number;
  }

  // Diagnostic log — shows which vars are present without exposing secrets
  console.log('[twilio-send-sms] env check:', {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? `set (${process.env.TWILIO_ACCOUNT_SID.slice(0, 6)}...)` : 'missing',
    EXPO_PUBLIC_TWILIO_ACCOUNT_SID: process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID ? `set (${process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID.slice(0, 6)}...)` : 'missing',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? `set (len=${process.env.TWILIO_AUTH_TOKEN.length})` : 'missing',
    EXPO_PUBLIC_TWILIO_AUTH_TOKEN: process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN ? `set (len=${process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN.length})` : 'missing',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER || 'missing',
    resolved_sid_prefix: accountSid ? accountSid.slice(0, 6) : 'none',
    to,
  });

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment variables.' });
  }

  try {
    console.log('[twilio-send-sms] Sending:', { from: fromNumber, to, bodyLength: body.length });
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({ body, from: fromNumber, to });
    console.log('[twilio-send-sms] Twilio response:', { sid: message.sid, status: message.status, direction: message.direction, errorCode: message.errorCode, errorMessage: message.errorMessage });
    return res.status(200).json({ success: true, messageSid: message.sid, status: message.status, from: fromNumber, errorCode: message.errorCode || null });
  } catch (error: any) {
    console.error('[twilio-send-sms] Twilio error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    });
    return res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
}
