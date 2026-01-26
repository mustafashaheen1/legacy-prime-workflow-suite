import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      clientName,
      clientEmail,
      clientPhone,
      amount,
      method,
      dueDate,
      message,
      companyId
    } = req.body;

    if (!clientName || !amount || !method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);

    const dueText = dueDate ? `\nDue Date: ${new Date(dueDate).toLocaleDateString()}` : '';
    const customMessage = message ? `\n\n${message}` : '';

    // Send email if requested
    if ((method === 'email' || method === 'both') && clientEmail) {
      await resend.emails.send({
        from: 'Legacy Prime <noreply@legacyprime.com>',
        to: clientEmail,
        subject: `Payment Request - ${formattedAmount}`,
        html: `
          <h2>Payment Request</h2>
          <p>Hello ${clientName},</p>
          <p>This is a request for payment in the amount of <strong>${formattedAmount}</strong>.${dueText}</p>
          ${customMessage}
          <p>Thank you for your business!</p>
          <p>Legacy Prime Construction</p>
        `,
      });
    }

    // Send SMS if requested
    if ((method === 'sms' || method === 'both') && clientPhone) {
      // SMS sending logic would go here
      // For now, just log it
      console.log(`[SMS] Would send payment request to ${clientPhone}: ${formattedAmount}${dueText}`);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[send-payment-request] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
