import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { verificationStore } from '../lib/verification-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: 'phoneNumber is required' });
  }

  const accountSid = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio is not configured. Please contact the administrator.' });
  }

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    verificationStore.set(`verification:${phoneNumber}`, { code, phoneNumber, expiresAt, attempts: 0 });

    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body: `Your verification code is: ${code}. Valid for 10 minutes.`,
      from: fromNumber,
      to: phoneNumber,
    });

    return res.status(200).json({ success: true, messageSid: message.sid, expiresAt });
  } catch (error: any) {
    console.error('[API] send-verification-code error:', error);
    if (error.code === 21608) return res.status(400).json({ error: 'The phone number is invalid or cannot receive SMS.' });
    if (error.code === 21211) return res.status(400).json({ error: 'The phone number is invalid.' });
    if (error.code === 21614) return res.status(400).json({ error: 'The phone number is invalid for your country.' });
    return res.status(500).json({ error: error.message || 'Could not send verification code' });
  }
}
