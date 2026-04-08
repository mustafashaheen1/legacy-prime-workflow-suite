import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

/**
 * GET /api/twilio-check-sms-status?messageSid=SMXXXXXXX
 *
 * Fetches the current delivery status of an SMS by its messageSid.
 * Use this to debug delivery issues without needing Twilio console access.
 *
 * Returns: status, errorCode, errorMessage, dateSent, dateUpdated, price, direction, from, to
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messageSid } = req.query;
  if (!messageSid || typeof messageSid !== 'string') {
    return res.status(400).json({ error: 'messageSid query parameter is required' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages(messageSid).fetch();

    const result = {
      messageSid: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      from: message.from,
      to: message.to,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
      direction: message.direction,
      price: message.price,
      priceUnit: message.priceUnit,
    };

    console.log('[twilio-check-sms-status]', JSON.stringify(result));

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[twilio-check-sms-status] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch message status' });
  }
}
