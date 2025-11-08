import React from "react";
export const StripeProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

export const useStripe = () => ({
  initPaymentSheet: async () => ({ error: null }),
  presentPaymentSheet: async () => ({ error: null }),
});

export const CardField = () => null;
export const ApplePayButton = () => null;
export const GooglePayButton = () => null;
