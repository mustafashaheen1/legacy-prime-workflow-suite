import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/twilio-sms-status-webhook
 *
 * Twilio calls this webhook automatically as SMS delivery status changes.
 * Logs every status update so you can track delivery in Vercel logs.
 *
 * Status flow: queued → sent → delivered (or undelivered/failed)
 *
 * Set as statusCallback when creating messages via Twilio SDK.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    MessageSid,
    MessageStatus,
    To,
    From,
    ErrorCode,
    ErrorMessage,
  } = req.body;

  const logEntry = {
    messageSid: MessageSid,
    status: MessageStatus,
    to: To,
    from: From,
    errorCode: ErrorCode || null,
    errorMessage: ErrorMessage || null,
    timestamp: new Date().toISOString(),
  };

  // Color-coded log level based on status
  if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
    console.error('[twilio-sms-webhook] DELIVERY FAILED:', JSON.stringify(logEntry));
  } else if (MessageStatus === 'delivered') {
    console.log('[twilio-sms-webhook] DELIVERED:', JSON.stringify(logEntry));
  } else {
    console.log('[twilio-sms-webhook] Status update:', JSON.stringify(logEntry));
  }

  // Twilio expects 200 response — anything else triggers retries
  return res.status(200).json({ received: true });
}
