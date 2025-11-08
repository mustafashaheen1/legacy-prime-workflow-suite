import React from "react";
import { View } from "react-native";

export const StripeProvider = ({ children }: { children: React.ReactNode }) => {
  return children as React.ReactElement;
};

export const useStripe = () => ({
  initPaymentSheet: async () => ({ error: null }),
  presentPaymentSheet: async () => ({ error: null }),
  createPaymentMethod: async () => ({ error: null, paymentMethod: null }),
  retrievePaymentIntent: async () => ({ error: null, paymentIntent: null }),
  confirmPayment: async () => ({ error: null, paymentIntent: null }),
});

export const CardField = () => <View />;
export const ApplePayButton = () => <View />;
export const GooglePayButton = () => <View />;
export const PaymentSheet = () => <View />;
export const initPaymentSheet = async () => ({ error: null });
export const presentPaymentSheet = async () => ({ error: null });

export default {
  StripeProvider,
  useStripe,
  CardField,
  ApplePayButton,
  GooglePayButton,
  PaymentSheet,
  initPaymentSheet,
  presentPaymentSheet,
};
