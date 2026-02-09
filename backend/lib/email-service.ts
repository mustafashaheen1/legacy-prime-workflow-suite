/**
 * Email Service Module
 * Supports multiple email providers
 * Cross-platform: iOS, Android, Web
 */

import { Resend } from 'resend';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize AWS SES (alternative)
const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Email configuration
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Legacy Prime Workflow Suite';
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
const EMAIL_FROM = `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`;

/**
 * Email notification parameters
 */
export interface EstimateRequestEmailParams {
  to: string;
  toName: string;
  subjectName: string;
  projectName: string;
  companyName: string;
  description: string;
  requiredBy?: string;
  notes?: string;
  requestId: string;
  requestUrl?: string;
}

/**
 * Send Estimate Request Email via Resend
 */
export async function sendEstimateRequestEmailResend(
  params: EstimateRequestEmailParams
): Promise<{ success: boolean; messageId?: string; error?: any }> {
  try {
    const { to } = params;

    console.log('[Email] Sending via Resend to:', to);

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: `New Estimate Request: ${params.projectName}`,
      html: generateEstimateRequestEmailHTML(params),
      text: generateEstimateRequestEmailText(params),
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return { success: false, error };
    }

    console.log('[Email] Sent successfully via Resend:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Email] Resend exception:', error);
    return { success: false, error };
  }
}

/**
 * Send Estimate Request Email via AWS SES
 */
export async function sendEstimateRequestEmailSES(
  params: EstimateRequestEmailParams
): Promise<{ success: boolean; messageId?: string; error?: any }> {
  try {
    const { to, projectName } = params;

    console.log('[Email] Sending via AWS SES to:', to);

    const command = new SendEmailCommand({
      Source: EMAIL_FROM_ADDRESS,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: `New Estimate Request: ${projectName}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: generateEstimateRequestEmailHTML(params),
            Charset: 'UTF-8',
          },
          Text: {
            Data: generateEstimateRequestEmailText(params),
            Charset: 'UTF-8',
          },
        },
      },
    });

    const response = await sesClient.send(command);

    console.log('[Email] Sent successfully via AWS SES:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('[Email] AWS SES exception:', error);
    return { success: false, error };
  }
}

/**
 * Generate HTML email template
 */
function generateEstimateRequestEmailHTML(params: EstimateRequestEmailParams): string {
  const { toName, projectName, companyName, description, requiredBy, notes, requestUrl } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Estimate Request</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0; color: #dbeafe; font-size: 16px; }
    .content { padding: 40px 20px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 16px; }
    .message { font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 24px; }
    .card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .card-title { font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .card-value { font-size: 16px; color: #1f2937; margin-bottom: 12px; }
    .card-value:last-child { margin-bottom: 0; }
    .label { font-weight: 600; color: #374151; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; }
    .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 24px 0; }
    @media only screen and (max-width: 600px) {
      .content { padding: 30px 16px; }
      .header { padding: 30px 16px; }
      .header h1 { font-size: 24px; }
    }
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
      <p class="message"><strong>${companyName}</strong> has requested an estimate for their project. Please review the details below and respond at your earliest convenience.</p>
      <div class="card">
        <div class="card-title">Project Details</div>
        <div class="card-value"><span class="label">Project:</span> ${projectName}</div>
        <div class="card-value"><span class="label">Company:</span> ${companyName}</div>
        ${requiredBy ? `<div class="card-value"><span class="label">Required By:</span> ${new Date(requiredBy).toLocaleDateString()}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-title">Work Description</div>
        <div class="card-value">${description}</div>
      </div>
      ${notes ? `<div class="card"><div class="card-title">Additional Notes</div><div class="card-value">${notes}</div></div>` : ''}
      ${requestUrl ? `<center><a href="${requestUrl}" class="button">View Request Details</a></center>` : ''}
      <div class="divider"></div>
      <p class="message" style="font-size: 14px; color: #6b7280;">
        <strong>What's Next?</strong><br>
        1. Review the project requirements<br>
        2. Prepare your estimate<br>
        3. Respond with your proposal and timeline<br>
        4. Get in touch with ${companyName} to discuss details
      </p>
    </div>
    <div class="footer">
      <p><strong>Legacy Prime Workflow Suite</strong><br>Professional Construction Management Platform<br><br>This is an automated notification. Please do not reply to this email.<br>Contact ${companyName} directly to discuss the project.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email
 */
function generateEstimateRequestEmailText(params: EstimateRequestEmailParams): string {
  const { toName, projectName, companyName, description, requiredBy, notes, requestUrl } = params;

  return `
Hi ${toName},

${companyName} has requested an estimate for their project.

PROJECT DETAILS:
- Project: ${projectName}
- Company: ${companyName}
${requiredBy ? `- Required By: ${new Date(requiredBy).toLocaleDateString()}` : ''}

WORK DESCRIPTION:
${description}

${notes ? `ADDITIONAL NOTES:\n${notes}\n` : ''}

${requestUrl ? `View full details: ${requestUrl}\n` : ''}

WHAT'S NEXT:
1. Review the project requirements
2. Prepare your estimate
3. Respond with your proposal and timeline
4. Get in touch with ${companyName} to discuss details

---
Legacy Prime Workflow Suite
Professional Construction Management Platform

This is an automated notification.
Contact ${companyName} directly to discuss the project.
  `.trim();
}

/**
 * Main email sending function
 */
export async function sendEstimateRequestEmail(
  params: EstimateRequestEmailParams
): Promise<{ success: boolean; messageId?: string; service?: string; error?: any }> {
  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    const result = await sendEstimateRequestEmailResend(params);
    if (result.success) {
      return { ...result, service: 'resend' };
    }
    console.warn('[Email] Resend failed, trying AWS SES...');
  }

  // Fallback to AWS SES
  if (process.env.AWS_ACCESS_KEY_ID) {
    const result = await sendEstimateRequestEmailSES(params);
    if (result.success) {
      return { ...result, service: 'ses' };
    }
  }

  console.error('[Email] All email services failed');
  return { success: false, error: 'All email services failed' };
}
