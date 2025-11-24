import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover' as any,
});

export const createPaymentIntentProcedure = publicProcedure
  .input(
    z.object({
      amount: z.number().min(1),
      currency: z.string().default('usd'),
      companyName: z.string(),
      email: z.string(),
      subscriptionPlan: z.enum(['basic', 'premium']),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Stripe] Creating payment intent for:', input.companyName);

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        metadata: {
          companyName: input.companyName,
          email: input.email,
          subscriptionPlan: input.subscriptionPlan,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      console.log('[Stripe] Payment intent created:', paymentIntent.id);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      console.error('[Stripe] Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  });
