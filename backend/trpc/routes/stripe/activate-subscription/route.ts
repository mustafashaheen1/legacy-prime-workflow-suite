import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Stripe Price IDs - these should match your Stripe Dashboard
// You'll need to create these products/prices in Stripe Dashboard
const PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID || 'price_basic',  // Replace with actual price ID
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium',  // Replace with actual price ID
};

export const activateSubscriptionProcedure = publicProcedure
  .input(
    z.object({
      paymentIntentId: z.string(),
      companyId: z.string(),
      email: z.string(),
      companyName: z.string(),
      subscriptionPlan: z.enum(['basic', 'premium']),
      employeeCount: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Stripe] Activating subscription for company:', input.companyId);

    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('[Stripe] STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.');
    }

    // Check if Supabase is configured
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Stripe] Supabase not configured');
      throw new Error('Database is not configured. Please add Supabase environment variables.');
    }

    try {
      // Create clients inside the handler (not at module level)
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-11-20.acacia' as any,
        typescript: true,
      });

      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Verify the payment was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment has not been completed');
      }

      console.log('[Stripe] Payment verified:', paymentIntent.id);

      // 2. Create or retrieve Stripe customer
      let customer: Stripe.Customer;

      // Check if company already has a Stripe customer
      const { data: company } = await supabase
        .from('companies')
        .select('stripe_customer_id')
        .eq('id', input.companyId)
        .single();

      if (company?.stripe_customer_id) {
        customer = await stripe.customers.retrieve(company.stripe_customer_id) as Stripe.Customer;
        console.log('[Stripe] Using existing customer:', customer.id);
      } else {
        customer = await stripe.customers.create({
          email: input.email,
          name: input.companyName,
          metadata: {
            companyId: input.companyId,
            companyName: input.companyName,
            employeeCount: input.employeeCount.toString(),
          },
          description: `${input.companyName} - ${input.subscriptionPlan} plan`,
        });
        console.log('[Stripe] Customer created:', customer.id);
      }

      // 3. Create subscription
      const priceId = PRICE_IDS[input.subscriptionPlan];
      console.log('[Stripe] Creating subscription with price:', priceId);

      // Note: For one-time payments, we don't create a subscription
      // Instead, we just update the company record with subscription info

      // 4. Update company record
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1); // 1 year subscription

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          stripe_customer_id: customer.id,
          subscription_status: 'active',
          subscription_plan: input.subscriptionPlan,
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: subscriptionEndDate.toISOString(),
          employee_count: input.employeeCount,
          settings: {
            maxEmployees: input.subscriptionPlan === 'basic' ? 10 : input.subscriptionPlan === 'premium' ? 25 : 100,
            maxProjects: input.subscriptionPlan === 'basic' ? 50 : input.subscriptionPlan === 'premium' ? 200 : 1000,
          },
        })
        .eq('id', input.companyId);

      if (updateError) {
        console.error('[Stripe] Error updating company:', updateError);
        throw new Error(`Failed to update company: ${updateError.message}`);
      }

      console.log('[Stripe] Company updated successfully');

      return {
        success: true,
        customerId: customer.id,
        subscriptionPlan: input.subscriptionPlan,
        subscriptionEndDate: subscriptionEndDate.toISOString(),
      };
    } catch (error: any) {
      console.error('[Stripe] Error activating subscription:', error.message);
      throw new Error(`Failed to activate subscription: ${error.message}`);
    }
  });
