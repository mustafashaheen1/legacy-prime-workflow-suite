import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

    try {
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

      // 3. Attach the payment method from the PaymentIntent to the customer
      if (paymentIntent.payment_method) {
        await stripe.paymentMethods.attach(
          paymentIntent.payment_method as string,
          { customer: customer.id }
        );

        // Set as default payment method
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentIntent.payment_method as string,
          },
        });

        console.log('[Stripe] Payment method attached to customer');
      }

      // 4. Create recurring subscription
      // Note: For production, you need to create Price objects in Stripe Dashboard
      // For now, we'll create a subscription without a price (you'll need to add this)

      // Calculate the subscription amount based on plan and employee count
      const basePriceBasic = 10;
      const basePricePremium = 20;
      const pricePerEmployeeBasic = 8;
      const pricePerEmployeePremium = 15;

      const monthlyAmount = input.subscriptionPlan === 'basic'
        ? basePriceBasic + (input.employeeCount - 1) * pricePerEmployeeBasic
        : basePricePremium + (input.employeeCount - 1) * pricePerEmployeePremium;

      // For a real implementation, you would use Stripe Price IDs
      // For now, we'll create a subscription with a custom price
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${input.subscriptionPlan.charAt(0).toUpperCase() + input.subscriptionPlan.slice(1)} Plan - ${input.employeeCount} employees`,
                description: `Monthly subscription for ${input.companyName}`,
              },
              unit_amount: Math.round(monthlyAmount * 100), // Convert to cents
              recurring: {
                interval: 'month',
              },
            },
          },
        ],
        metadata: {
          companyId: input.companyId,
          companyName: input.companyName,
          plan: input.subscriptionPlan,
          employeeCount: input.employeeCount.toString(),
        },
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      console.log('[Stripe] Subscription created:', subscription.id);

      // 5. Update company record in database
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          stripe_payment_intent_id: paymentIntent.id,
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.companyId);

      if (updateError) {
        console.error('[Stripe] Error updating company:', updateError);
        throw new Error('Failed to update company subscription status');
      }

      console.log('[Stripe] Company subscription activated successfully');

      // 6. Record the payment in the payments table
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          company_id: input.companyId,
          project_id: null,
          client_id: null,
          amount: paymentIntent.amount / 100, // Convert from cents to dollars
          date: new Date().toISOString(),
          client_name: input.companyName,
          method: 'credit-card',
          notes: `Initial subscription payment - ${input.subscriptionPlan} plan (${input.employeeCount} employees)`,
          receipt_url: paymentIntent.charges?.data[0]?.receipt_url || null,
        });

      if (paymentError) {
        console.warn('[Stripe] Warning: Failed to record payment:', paymentError);
        // Don't throw error - payment was successful, just logging failed
      } else {
        console.log('[Stripe] Payment recorded successfully');
      }

      return {
        success: true,
        customerId: customer.id,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
      };
    } catch (error: any) {
      console.error('[Stripe] Error activating subscription:', error);
      throw new Error(`Failed to activate subscription: ${error.message}`);
    }
  });
