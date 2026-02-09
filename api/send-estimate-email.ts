/**
 * Send Estimate Request Email
 * Uses Resend HTTP API (no SDK) for Vercel compatibility
 * Platform: iOS, Android, Web
 */

interface EmailRequest {
  to: string;
  toName: string;
  projectName: string;
  companyName: string;
  description: string;
  requiredBy?: string;
  notes?: string;
}

/**
 * Generate HTML email template
 */
function generateEmailHTML(params: EmailRequest): string {
  const { toName, projectName, companyName, description, requiredBy, notes } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; }
    .header p { color: #dbeafe; margin: 8px 0 0; }
    .content { padding: 40px 20px; }
    .greeting { font-size: 18px; font-weight: 600; }
    .message { font-size: 16px; line-height: 1.6; color: #374151; }
    .card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .card-title { font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 12px; }
    .card-value { font-size: 16px; color: #1f2937; margin-bottom: 8px; }
    .label { font-weight: 600; }
    .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 New Estimate Request</h1>
      <p>You have a new project inquiry</p>
    </div>
    <div class="content">
      <p class="greeting">Hi ${toName},</p>
      <p class="message">
        <strong>${companyName}</strong> has requested an estimate for their project.
        Please review the details below and respond at your earliest convenience.
      </p>
      <div class="card">
        <div class="card-title">Project Details</div>
        <div class="card-value"><span class="label">Project:</span> ${projectName}</div>
        <div class="card-value"><span class="label">Company:</span> ${companyName}</div>
        ${requiredBy ? `<div class="card-value"><span class="label">Required By:</span> ${requiredBy}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-title">Work Description</div>
        <div class="card-value">${description}</div>
      </div>
      ${notes ? `<div class="card"><div class="card-title">Additional Notes</div><div class="card-value">${notes}</div></div>` : ''}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p class="message" style="font-size: 14px; color: #6b7280;">
        <strong>What's Next?</strong><br>
        1. Review the project requirements<br>
        2. Prepare your estimate<br>
        3. Respond with your proposal and timeline
      </p>
    </div>
    <div class="footer">
      <p><strong>Legacy Prime Workflow Suite</strong><br>Professional Construction Management Platform</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * API Handler - Uses native fetch to call Resend HTTP API
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as EmailRequest;

    console.log('[Email API] Request to send email to:', body.to);

    // Validate
    if (!body.to || !body.toName || !body.projectName || !body.companyName || !body.description) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
    const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Legacy Prime Workflow Suite';

    if (!RESEND_API_KEY) {
      console.error('[Email API] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call Resend HTTP API directly (no SDK)
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`,
        to: [body.to],
        subject: `New Estimate Request: ${body.projectName}`,
        html: generateEmailHTML(body),
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('[Email API] Resend error:', resendData);
      return new Response(
        JSON.stringify({
          success: false,
          error: resendData.message || 'Failed to send email'
        }),
        { status: resendResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Email API] ✅ Email sent successfully:', resendData.id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: resendData.id,
        message: 'Email sent successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Email API] Exception:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Use Node.js runtime (not edge) for better package compatibility
export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};
