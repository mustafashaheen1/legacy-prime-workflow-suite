import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipients, body } = req.body;
  if (!recipients || !body) {
    return res.status(400).json({ error: 'recipients and body are required' });
  }

  const accountSid = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio not configured.' });
  }

  try {
    const client = twilio(accountSid, authToken);
    const results = await Promise.allSettled(
      recipients.map(async (recipient: { phone: string; name: string }) => {
        const personalizedBody = body.replace('{name}', recipient.name.split(' ')[0]);
        const message = await client.messages.create({ body: personalizedBody, from: fromNumber, to: recipient.phone });
        return { phone: recipient.phone, name: recipient.name, success: true, messageSid: message.sid, status: message.status };
      })
    );
    const totalSent = results.filter(r => r.status === 'fulfilled').length;
    const totalFailed = results.filter(r => r.status === 'rejected').length;
    return res.status(200).json({
      success: true, totalSent, totalFailed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: (r.reason as Error).message }),
    });
  } catch (error: any) {
    console.error('[API] twilio-send-bulk-sms error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send bulk SMS' });
  }
}
