import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export const verifyPaymentProcedure = publicProcedure
  .input(
    z.object({
      paymentIntentId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Stripe] Verifying payment:', input.paymentIntentId);

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

      console.log('[Stripe] Payment status:', paymentIntent.status);

      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      console.error('[Stripe] Error verifying payment:', error);
      throw new Error(`Failed to verify payment: ${error.message}`);
    }
  });
