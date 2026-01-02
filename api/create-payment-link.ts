import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const { amount, description, clientName, estimateId } = req.body;

    if (!amount || !description) {
      return res.status(400).json({ error: 'Amount and description are required' });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia' as any,
    });

    // Create a price for this specific estimate
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(amount * 100), // Convert to cents
      product_data: {
        name: description,
        metadata: {
          clientName: clientName || '',
          estimateId: estimateId || '',
        },
      },
    });

    // Create a payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      metadata: {
        clientName: clientName || '',
        estimateId: estimateId || '',
        description: description,
      },
      after_completion: {
        type: 'hosted_confirmation',
        hosted_confirmation: {
          custom_message: 'Thank you for your payment! We will begin work on your project shortly.',
        },
      },
    });

    console.log('[Payment Link] Created successfully:', paymentLink.url);

    return res.status(200).json({
      success: true,
      paymentLink: paymentLink.url,
      priceId: price.id,
      paymentLinkId: paymentLink.id,
    });
  } catch (error: any) {
    console.error('[Payment Link] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment link'
    });
  }
}
