import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false, // Must be disabled for Stripe webhooks
  },
  maxDuration: 30,
};

// Helper to get raw body
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const ownerEmail = process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('[Webhook] Stripe not configured');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-11-20.acacia' as any,
  });

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('[Webhook] No signature found');
      return res.status(400).json({ error: 'No signature' });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      console.log('[Webhook] Verified event:', event.type);
    } catch (err: any) {
      console.error('[Webhook] Signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[Webhook] Payment successful:', session.id);

        // Get payment details
        const amountTotal = session.amount_total ? session.amount_total / 100 : 0;
        const customerEmail = session.customer_details?.email || 'Unknown';
        const customerName = session.customer_details?.name || 'Unknown Customer';

        // Get metadata
        const metadata = session.metadata || {};
        const clientName = metadata.clientName || customerName;
        const estimateId = metadata.estimateId || 'N/A';
        const description = metadata.description || 'Payment';

        // Update estimate status to paid
        if (estimateId && estimateId !== 'N/A') {
          try {
            const updateResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/update-estimate-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                estimateId: estimateId,
                status: 'paid',
                paidDate: new Date().toISOString(),
                paymentId: session.payment_intent,
              }),
            });

            if (updateResponse.ok) {
              console.log('[Webhook] Estimate marked as paid:', estimateId);
            } else {
              const errorData = await updateResponse.json();
              console.error('[Webhook] Failed to update estimate status:', errorData);
            }
          } catch (updateError: any) {
            console.error('[Webhook] Error updating estimate status:', updateError.message);
            // Don't fail the webhook if estimate update fails
          }
        }

        // Send notification email to owner
        if (ownerEmail) {
          const emailSubject = encodeURIComponent('Payment Received - ' + clientName);
          const emailBody = encodeURIComponent(
            `Great news! You've received a payment.\n\n` +
            `Customer: ${customerName}\n` +
            `Client: ${clientName}\n` +
            `Email: ${customerEmail}\n` +
            `Amount: $${amountTotal.toFixed(2)}\n` +
            `Project: ${description}\n` +
            `Estimate ID: ${estimateId}\n` +
            `Payment ID: ${session.payment_intent}\n\n` +
            `The payment has been successfully processed through Stripe.\n\n` +
            `View in Stripe Dashboard:\n` +
            `https://dashboard.stripe.com/payments/${session.payment_intent}`
          );

          // Send email notification
          try {
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10B981;">💰 Payment Received!</h2>
                <p>Great news! You've received a payment through Stripe.</p>

                <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Customer:</td>
                      <td style="padding: 8px 0; font-weight: bold;">${customerName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Email:</td>
                      <td style="padding: 8px 0;">${customerEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
                      <td style="padding: 8px 0; font-weight: bold; color: #10B981; font-size: 18px;">$${amountTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Project:</td>
                      <td style="padding: 8px 0;">${description}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Estimate ID:</td>
                      <td style="padding: 8px 0;">${estimateId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Payment ID:</td>
                      <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${session.payment_intent}</td>
                    </tr>
                  </table>
                </div>

                <p>The payment has been successfully processed and will be deposited into your account according to your Stripe payout schedule.</p>

                <a href="https://dashboard.stripe.com/payments/${session.payment_intent}"
                   style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                  View in Stripe Dashboard
                </a>

                <p style="margin-top: 30px; color: #9CA3AF; font-size: 12px;">
                  This is an automated notification from your Legacy Prime Workflow Suite.
                </p>
              </div>
            `;

            const emailResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: ownerEmail,
                subject: `Payment Received - $${amountTotal.toFixed(2)} from ${clientName}`,
                html: emailHtml,
              }),
            });

            if (emailResponse.ok) {
              console.log('[Webhook] Email notification sent successfully');
            } else {
              const errorData = await emailResponse.json();
              console.error('[Webhook] Failed to send email:', errorData);
            }
          } catch (emailError: any) {
            console.error('[Webhook] Error sending email notification:', emailError.message);
            // Don't fail the webhook if email fails
          }
        }

        // Send confirmation email to customer
        if (customerEmail && customerEmail !== 'Unknown') {
          try {
            const customerEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10B981;">✅ Payment Confirmation</h2>
                <p>Dear ${customerName},</p>
                <p>Thank you for your payment! This email confirms that we have successfully received your payment.</p>

                <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #1F2937;">Payment Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Amount Paid:</td>
                      <td style="padding: 8px 0; font-weight: bold; color: #10B981; font-size: 18px; text-align: right;">$${amountTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Project:</td>
                      <td style="padding: 8px 0; text-align: right;">${description}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Payment Date:</td>
                      <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6B7280;">Transaction ID:</td>
                      <td style="padding: 8px 0; font-family: monospace; font-size: 11px; text-align: right;">${session.payment_intent}</td>
                    </tr>
                  </table>
                </div>

                <div style="background-color: #EFF6FF; border-left: 4px solid #2563EB; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0; color: #1E40AF; font-weight: 600;">What's Next?</p>
                  <p style="margin: 8px 0 0 0; color: #1E40AF;">
                    We will begin work on your project shortly. You'll receive updates as we progress.
                  </p>
                </div>

                <p>If you have any questions about this payment or your project, please don't hesitate to contact us.</p>

                <p style="margin-top: 30px;">
                  Best regards,<br>
                  <strong>${metadata.companyName || 'Legacy Prime Construction'}</strong>
                </p>

                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

                <p style="color: #9CA3AF; font-size: 12px;">
                  This is an automated receipt from ${metadata.companyName || 'Legacy Prime Construction'}.
                  Please keep this email for your records.
                </p>
                <p style="color: #9CA3AF; font-size: 12px;">
                  Payment processed securely by Stripe.
                </p>
              </div>
            `;

            const customerEmailResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: customerEmail,
                subject: `Payment Confirmation - $${amountTotal.toFixed(2)} - ${metadata.companyName || 'Legacy Prime Construction'}`,
                html: customerEmailHtml,
              }),
            });

            if (customerEmailResponse.ok) {
              console.log('[Webhook] Customer confirmation email sent to:', customerEmail);
            } else {
              const errorData = await customerEmailResponse.json();
              console.error('[Webhook] Failed to send customer email:', errorData);
            }
          } catch (customerEmailError: any) {
            console.error('[Webhook] Error sending customer confirmation email:', customerEmailError.message);
            // Don't fail the webhook if email fails
          }
        }

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('[Webhook] Payment intent succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('[Webhook] Payment failed:', paymentIntent.id);

        // Optionally notify owner of failed payment
        if (ownerEmail) {
          console.log('[Webhook] Payment failed notification:', {
            to: ownerEmail,
            paymentIntent: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message,
          });
        }
        break;
      }

      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    // Return success response to Stripe
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error:', error);
    return res.status(500).json({
      error: error.message || 'Webhook handler failed'
    });
  }
}
