import React from 'react';

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

export const StripeProvider = ({ children, publishableKey }: { children: React.ReactNode; publishableKey?: string }) => {
  return children as React.ReactElement;
};

export const useStripe = () => ({
  initPaymentSheet: async (params: InitPaymentSheetParams) => ({ error: null as PaymentSheetError | null }),
  presentPaymentSheet: async () => ({ error: null as PaymentSheetError | null }),
  createPaymentMethod: async () => ({ error: null, paymentMethod: null }),
  retrievePaymentIntent: async () => ({ error: null, paymentIntent: null }),
  confirmPayment: async () => ({ error: null, paymentIntent: null }),
});
