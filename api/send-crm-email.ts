import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './lib/cors.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Legacy Prime';

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const { recipients, subject, body, companyName, attachments } = req.body as {
    recipients: Array<{ email: string; name: string }>;
    subject: string;
    body: string;
    companyName?: string;
    attachments?: Array<{ filename: string; content: string; type: string }>;
  };

  if (!recipients?.length || !subject || !body) {
    return res.status(400).json({ error: 'recipients, subject, and body are required' });
  }

  const fromName = companyName || EMAIL_FROM_NAME;

  // Warn when using Resend's restricted test sender — only delivers to the account owner
  const isRestrictedSender = EMAIL_FROM_ADDRESS === 'onboarding@resend.dev';
  if (isRestrictedSender) {
    console.warn('[CRM Email] Using restricted test sender onboarding@resend.dev — emails will only reach the Resend account owner. Set EMAIL_FROM_ADDRESS to a verified domain email.');
  }


  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const firstName = recipient.name?.split(' ')[0] || 'there';
      const personalizedBody = body.replace(/\{name\}/gi, firstName);
      const html = buildEmailHtml({ name: firstName, body: personalizedBody, companyName: fromName });

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${EMAIL_FROM_ADDRESS}>`,
          to: [recipient.email],
          subject,
          html,
          ...(attachments?.length ? {
            attachments: attachments.map(a => ({
              filename: a.filename,
              content: a.content,
            })),
          } : {}),
        }),
      });

      const data = await r.json() as any;
      if (!r.ok) {
        console.error('[CRM Email] Resend rejected email to', recipient.email, '—', data.message);
        throw new Error(data.message || 'Send failed');
      }
      console.log('[CRM Email] accepted for', recipient.email, '— id:', data.id);
      return { email: recipient.email, id: data.id };
    })
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const failedReasons = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason?.message || 'Unknown error');

  console.log(`[CRM Email] done — sent=${sent} failed=${failed}`);

  // If every email was rejected by Resend, return a server error
  if (sent === 0 && failed > 0) {
    return res.status(500).json({
      error: `Email delivery failed: ${failedReasons[0] || 'Resend rejected all recipients'}`,
      sent: 0,
      failed,
    });
  }

  const senderWarning = isRestrictedSender
    ? 'Using test email sender — emails are only guaranteed to reach the Resend account owner. To send to all recipients, verify a domain at resend.com/domains and set EMAIL_FROM_ADDRESS in your environment.'
    : null;

  return res.status(200).json({ success: true, sent, failed, senderWarning });
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml({ name, body, companyName }: {
  name: string;
  body: string;
  companyName: string;
}): string {
  const bodyHtml = esc(body).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f9fafb; }
    .container { max-width:600px; margin:0 auto; background:#ffffff; }
    .header { background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%); padding:36px 24px; text-align:center; }
    .header h1 { margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.3px; }
    .content { padding:36px 24px; }
    .greeting { font-size:16px; font-weight:600; color:#0f172a; margin:0 0 16px; }
    .body-text { font-size:15px; line-height:1.7; color:#374151; margin:0; }
    .footer { background:#f1f5f9; padding:24px 20px; text-align:center; border-top:1px solid #e2e8f0; font-size:13px; color:#64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${esc(companyName)}</h1>
    </div>
    <div class="content">
      <p class="greeting">Hi ${esc(name)},</p>
      <p class="body-text">${bodyHtml}</p>
    </div>
    <div class="footer">
      <strong>${esc(companyName)}</strong><br>Powered by Legacy Prime Workflow Suite
    </div>
  </div>
</body>
</html>`.trim();
}
