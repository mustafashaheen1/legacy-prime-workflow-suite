import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipients, message, companyId } = req.body;

    if (!recipients || !Array.isArray(recipients) || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Bulk SMS sending logic would integrate with Twilio or similar service
    // For now, just log it
    console.log(`[Bulk SMS] Would send to ${recipients.length} recipients: ${message}`);
    recipients.forEach((recipient: any) => {
      console.log(`  - ${recipient.clientName}: ${recipient.phone}`);
    });

    // TODO: Integrate with SMS service like Twilio for bulk sending
    // Example:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // const promises = recipients.map(recipient =>
    //   client.messages.create({
    //     body: message,
    //     from: process.env.TWILIO_PHONE_NUMBER,
    //     to: recipient.phone
    //   })
    // );
    // await Promise.all(promises);

    return res.status(200).json({
      success: true,
      sent: recipients.length
    });
  } catch (error: any) {
    console.error('[send-bulk-sms] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
