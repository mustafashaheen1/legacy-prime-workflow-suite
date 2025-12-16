import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const verifyPaymentProcedure = publicProcedure
  .input(
    z.object({
      paymentIntentId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Stripe] Verifying payment:', input.paymentIntentId);

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

      const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);

      console.log('[Stripe] Payment status:', paymentIntent.status);

      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      console.error('[Stripe] Error verifying payment:', error.message);
      throw new Error(`Failed to verify payment: ${error.message}`);
    }
  });
