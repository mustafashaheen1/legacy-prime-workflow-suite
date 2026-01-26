import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clientName, phone, message, companyId } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // SMS sending logic would integrate with Twilio or similar service
    // For now, just log it
    console.log(`[SMS] Would send to ${phone}: ${message}`);

    // TODO: Integrate with SMS service like Twilio
    // Example:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone
    // });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[send-sms] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
