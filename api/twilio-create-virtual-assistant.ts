import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessName, greeting, webhookUrl } = req.body;
  if (!businessName || !greeting || !webhookUrl) {
    return res.status(400).json({ error: 'businessName, greeting, and webhookUrl are required' });
  }

  const accountSid = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio not configured.' });
  }

  try {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, greeting || `Thank you for calling ${businessName}. How can I help you today?`);
    const gather = twiml.gather({
      input: ['speech'],
      action: webhookUrl,
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US',
    });
    gather.say({ voice: 'alice' }, 'Please tell us how we can help.');

    return res.status(200).json({ success: true, twiml: twiml.toString() });
  } catch (error: any) {
    console.error('[API] twilio-create-virtual-assistant error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create virtual assistant' });
  }
}
