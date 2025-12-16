import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';

interface InitPaymentSheetParams {
  paymentIntentClientSecret: string;
  merchantDisplayName: string;
  customerId?: string;
  customerEphemeralKeySecret?: string;
}

interface PaymentSheetError {
  code: string;
  message: string;
}

interface StripeContextValue {
  stripe: Stripe | null;
  elements: StripeElements | null;
}

const StripeContext = React.createContext<StripeContextValue>({ stripe: null, elements: null });

let stripePromise: Promise<Stripe | null> | null = null;

export const StripeProvider = ({ children, publishableKey }: { children: React.ReactNode; publishableKey?: string }) => {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }

  if (!publishableKey) {
    console.warn('Stripe publishableKey not provided. Payment functionality will be limited.');
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
};

export const useStripe = () => {
  const [stripe, setStripe] = React.useState<Stripe | null>(null);
  const [elements, setElements] = React.useState<StripeElements | null>(null);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (stripePromise) {
      stripePromise.then(setStripe);
    }
  }, []);

  return {
    stripe,
    elements,
    setElements,
    clientSecret,

    initPaymentSheet: async (params: InitPaymentSheetParams) => {
      setClientSecret(params.paymentIntentClientSecret);
      return { error: null as PaymentSheetError | null };
    },

    presentPaymentSheet: async () => {
      // This is handled by the PaymentElement component on web
      // The actual confirmation happens in confirmPayment
      return { error: null as PaymentSheetError | null };
    },

    confirmPayment: async (clientSecret: string) => {
      if (!stripe || !elements) {
        return {
          error: {
            code: 'stripe_not_initialized',
            message: 'Stripe has not been initialized'
          } as PaymentSheetError,
          paymentIntent: null
        };
      }

      try {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.origin + '/(auth)/payment-success',
          },
          redirect: 'if_required',
        });

        if (result.error) {
          return {
            error: {
              code: result.error.code || 'payment_failed',
              message: result.error.message || 'Payment failed'
            } as PaymentSheetError,
            paymentIntent: null
          };
        }

        return { error: null, paymentIntent: result.paymentIntent };
      } catch (err: any) {
        return {
          error: {
            code: 'unknown_error',
            message: err.message || 'An unknown error occurred'
          } as PaymentSheetError,
          paymentIntent: null
        };
      }
    },

    createPaymentMethod: async () => {
      if (!stripe || !elements) {
        return { error: { code: 'stripe_not_initialized', message: 'Stripe not initialized' }, paymentMethod: null };
      }

      const result = await stripe.createPaymentMethod({
        elements,
      });

      if (result.error) {
        return { error: result.error, paymentMethod: null };
      }

      return { error: null, paymentMethod: result.paymentMethod };
    },

    retrievePaymentIntent: async (clientSecret: string) => {
      if (!stripe) {
        return { error: { code: 'stripe_not_initialized', message: 'Stripe not initialized' }, paymentIntent: null };
      }

      const result = await stripe.retrievePaymentIntent(clientSecret);

      if (result.error) {
        return { error: result.error, paymentIntent: null };
      }

      return { error: null, paymentIntent: result.paymentIntent };
    },
  };
};
