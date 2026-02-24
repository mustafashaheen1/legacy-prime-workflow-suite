import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message, twimlUrl } = req.body;
  if (!to) {
    return res.status(400).json({ error: 'to is required' });
  }

  const accountSid = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio not configured.' });
  }

  try {
    const client = twilio(accountSid, authToken);
    const twiml = new twilio.twiml.VoiceResponse();
    if (message) twiml.say({ voice: 'alice' }, message);
    const call = await client.calls.create({
      twiml: twimlUrl ? undefined : twiml.toString(),
      url: twimlUrl,
      to,
      from: fromNumber,
    });
    return res.status(200).json({ success: true, callSid: call.sid, status: call.status });
  } catch (error: any) {
    console.error('[API] twilio-make-call error:', error);
    return res.status(500).json({ error: error.message || 'Failed to make call' });
  }
}
