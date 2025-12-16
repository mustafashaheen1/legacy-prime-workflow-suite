import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import Stripe from 'stripe';

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
    console.log('[Stripe] Starting payment intent creation...');
    console.log('[Stripe] Company:', input.companyName);
    console.log('[Stripe] Amount:', input.amount, input.currency);
    console.log('[Stripe] Plan:', input.subscriptionPlan);

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('[Stripe] STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.');
    }

    console.log('[Stripe] Secret key found, length:', stripeSecretKey.length);

    try {
      console.log('[Stripe] Initializing Stripe client...');
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-11-20.acacia' as any,
        typescript: true,
        timeout: 20000,
        maxNetworkRetries: 1,
      });

      console.log('[Stripe] Client initialized, creating payment intent...');
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

      console.log('[Stripe] Payment intent created successfully:', paymentIntent.id);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      console.error('[Stripe] Error occurred:', error);
      console.error('[Stripe] Error details:', {
        message: error?.message,
        type: error?.type,
        code: error?.code,
        statusCode: error?.statusCode,
        stack: error?.stack,
      });
      throw new Error(`Failed to create payment intent: ${error?.message || 'Unknown error'}`);
    }
  });