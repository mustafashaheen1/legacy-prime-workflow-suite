import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

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
    console.log('[Stripe] Amount:', input.amount, input.currency);
    console.log('[Stripe] Plan:', input.subscriptionPlan);

    try {
      // Check if Stripe is configured
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        console.error('[Stripe] STRIPE_SECRET_KEY not configured');
        throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.');
      }

      // Dynamic import to avoid issues if stripe package is not installed
      const Stripe = (await import('stripe')).default;

      // Use a stable API version
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(input.amount * 100), // Convert to cents
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
      console.error('[Stripe] Error creating payment intent:', error.message);
      console.error('[Stripe] Error type:', error.type);
      console.error('[Stripe] Error code:', error.code);

      // Provide more helpful error messages
      if (error.type === 'StripeAuthenticationError') {
        throw new Error('Invalid Stripe API key. Please check your STRIPE_SECRET_KEY.');
      }

      if (error.type === 'StripeConnectionError') {
        throw new Error('Could not connect to Stripe. Please try again.');
      }

      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  });
