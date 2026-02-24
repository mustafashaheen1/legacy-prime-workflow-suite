import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentIntentId } = req.body;
  if (!paymentIntentId) {
    return res.status(400).json({ error: 'paymentIntentId is required' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.' });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' as any, typescript: true });
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return res.status(200).json({
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    });
  } catch (error: any) {
    console.error('[API] verify-stripe-payment error:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify payment' });
  }
}
