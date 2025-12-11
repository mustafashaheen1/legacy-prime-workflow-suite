import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover' as any,
});

export const createSubscriptionProcedure = publicProcedure
  .input(
    z.object({
      email: z.string(),
      paymentMethodId: z.string(),
      priceId: z.string(),
      companyName: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Stripe] Creating subscription for:', input.email);

    try {
      const customer = await stripe.customers.create({
        email: input.email,
        payment_method: input.paymentMethodId,
        invoice_settings: {
          default_payment_method: input.paymentMethodId,
        },
        metadata: {
          companyName: input.companyName,
        },
      });

      console.log('[Stripe] Customer created:', customer.id);

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: input.priceId }],
        expand: ['latest_invoice.payment_intent'],
      });

      console.log('[Stripe] Subscription created:', subscription.id);

      return {
        subscriptionId: subscription.id,
        customerId: customer.id,
        status: subscription.status,
      };
    } catch (error: any) {
      console.error('[Stripe] Error creating subscription:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  });
