import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, and html or text' });
    }

    // Option 1: Using Resend (recommended - easy setup, generous free tier)
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || 'notifications@yourdomain.com',
          to: to,
          subject: subject,
          html: html || `<p>${text}</p>`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send email via Resend');
      }

      console.log('[Email] Sent via Resend:', data.id);
      return res.status(200).json({ success: true, provider: 'resend', id: data.id });
    }

    // Option 2: Using SendGrid
    if (process.env.SENDGRID_API_KEY) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.FROM_EMAIL || 'notifications@yourdomain.com' },
          subject: subject,
          content: [
            {
              type: html ? 'text/html' : 'text/plain',
              value: html || text,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid error: ${error}`);
      }

      console.log('[Email] Sent via SendGrid');
      return res.status(200).json({ success: true, provider: 'sendgrid' });
    }

    // No email service configured
    console.warn('[Email] No email service configured. Email not sent:', { to, subject });
    return res.status(500).json({
      error: 'No email service configured. Please set RESEND_API_KEY or SENDGRID_API_KEY in environment variables.',
    });
  } catch (error: any) {
    console.error('[Email] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send email',
    });
  }
}
