import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Update company
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

    await supabase.from('companies').update({
      stripe_customer_id: customer.id,
      subscription_status: 'active',
      subscription_plan: subscriptionPlan,
      subscription_start_date: new Date().toISOString(),
      subscription_end_date: subscriptionEndDate.toISOString(),
      employee_count: employeeCount || 1,
    }).eq('id', companyId);

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
