import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { PaymentElement, useStripe as useStripeElements, useElements, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  amount: number;
}

const stripePromise = loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function PaymentFormContent({ onSuccess, onError, amount }: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const stripe = useStripeElements();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!stripe || !elements) {
      onError('Stripe has not been initialized');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/(tabs)/dashboard',
        },
        redirect: 'if_required',
      });

      if (result.error) {
        onError(result.error.message || 'Payment failed');
        setIsProcessing(false);
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        onSuccess(result.paymentIntent.id);
      }
    } catch (err: any) {
      onError(err.message || 'An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Information</Text>
      <Text style={styles.amount}>Amount: ${amount.toFixed(2)} USD</Text>

      <View style={styles.paymentElementContainer}>
        <PaymentElement />
      </View>

      <TouchableOpacity
        style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
        onPress={handleSubmit}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.payButtonText}>Pay ${amount.toFixed(2)}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.testModeNotice}>
        <Text style={styles.testModeText}>
          🧪 Test Mode: Use card 4242 4242 4242 4242
        </Text>
        <Text style={styles.testModeSubtext}>
          Any future date, any 3-digit CVC
        </Text>
      </View>
    </View>
  );
}

export function StripePaymentForm({ clientSecret, onSuccess, onError, amount }: StripePaymentFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
        },
      }}
    >
      <PaymentFormContent onSuccess={onSuccess} onError={onError} amount={amount} />
    </Elements>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 20,
  },
  paymentElementContainer: {
    marginBottom: 20,
    minHeight: 200,
  },
  payButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  payButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  testModeNotice: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  testModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 4,
  },
  testModeSubtext: {
    fontSize: 11,
    color: '#78350F',
    textAlign: 'center',
  },
});
