import React from 'react';
import { View, Text } from 'react-native';

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  amount: number;
}

// Native platforms use the payment sheet instead of this form
export function StripePaymentForm(_props: StripePaymentFormProps) {
  return (
    <View>
      <Text>Payment form is not used on native platforms</Text>
    </View>
  );
}
