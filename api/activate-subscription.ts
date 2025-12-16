import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const PLAN_MAP = {
  'basic': 'basic',
  'premium': 'pro',
  'pro': 'pro',
  'enterprise': 'enterprise',
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey) return res.status(500).json({ error: 'Stripe not configured' });
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Database not configured' });

  try {
    const { paymentIntentId, companyId, email, companyName, subscriptionPlan, employeeCount } = req.body;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' as any });

    // Verify payment
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Create customer
    const customer = await stripe.customers.create({
      email,
      name: companyName,
      metadata: { companyId },
    });

    // Update company using Supabase REST API
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        stripe_customer_id: customer.id,
        subscription_status: 'active',
        subscription_plan: PLAN_MAP[subscriptionPlan] || 'basic',
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: subscriptionEndDate.toISOString(),
        employee_count: employeeCount || 1,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update company: ${error}`);
    }

    return res.status(200).json({
      success: true,
      customerId: customer.id,
      subscriptionPlan,
      subscriptionEndDate: subscriptionEndDate.toISOString(),
    });
  } catch (error: any) {
    console.error('[Activate] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
